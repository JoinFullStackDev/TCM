import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { GitLabCIConfig } from "@/types/database";

const bodySchema = z.object({
  integration_id: z.string().uuid(),
  suite_ids: z.array(z.string().uuid()).min(1),
  environment: z.enum(["dev", "qa", "uat"]),
  tag_filter: z.enum(["smoke", "regression", "all"]).optional().default("all"),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "sdet"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", details: err },
      { status: 400 },
    );
  }

  const { integration_id, suite_ids, environment, tag_filter } = body;

  // Fetch integration
  const { data: integration, error: intErr } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", integration_id)
    .single();

  if (intErr || !integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  if (integration.type !== "gitlab" || !integration.is_active) {
    return NextResponse.json(
      { error: "Integration is not an active GitLab CI integration" },
      { status: 400 },
    );
  }

  // Fetch suites and verify they all belong to the integration project
  const { data: suites, error: suiteErr } = await supabase
    .from("suites")
    .select("id, name, project_id")
    .in("id", suite_ids);

  if (suiteErr || !suites || suites.length === 0) {
    return NextResponse.json({ error: "No suites found" }, { status: 404 });
  }

  const wrongProject = suites.find(
    (s) => s.project_id !== integration.project_id,
  );
  if (wrongProject) {
    return NextResponse.json(
      { error: "One or more suites do not belong to the integration project" },
      { status: 403 },
    );
  }

  // Fetch in_cicd test cases across all selected suites
  const { data: testCases } = await supabase
    .from("test_cases")
    .select("id, display_id")
    .in("suite_id", suite_ids)
    .eq("automation_status", "in_cicd");

  if (!testCases || testCases.length === 0) {
    return NextResponse.json(
      { error: "No automated test cases found in the selected suites" },
      { status: 400 },
    );
  }

  const testIdsRegex = `(${testCases.map((tc) => tc.display_id).join("|")})`;

  // Build run name
  const runName =
    suites.length === 1
      ? `${suites[0].name} – ${environment.toUpperCase()}`
      : `${suites.length} Suites – ${environment.toUpperCase()}`;

  // suite_id is nullable — set only when a single suite is selected
  const suiteFk = suite_ids.length === 1 ? suite_ids[0] : null;

  const { data: testRun, error: runErr } = await supabase
    .from("test_runs")
    .insert({
      project_id: integration.project_id,
      suite_id: suiteFk,
      name: runName,
      environment,
      status: "in_progress",
      is_automated: true,
      source: "ci_trigger",
      created_by: user.id,
    })
    .select()
    .single();

  if (runErr || !testRun) {
    return NextResponse.json(
      { error: `Failed to create test run: ${runErr?.message}` },
      { status: 500 },
    );
  }

  // Add all matched test cases to test_run_cases with not_run status
  const runCaseInserts = testCases.map((tc) => ({
    test_run_id: testRun.id,
    test_case_id: tc.id,
    overall_status: "not_run",
  }));

  await supabase.from("test_run_cases").insert(runCaseInserts);

  // Call GitLab trigger API
  const cfg = integration.config as GitLabCIConfig;
  const formData = new FormData();
  formData.append("token", cfg.trigger_token);
  formData.append("ref", environment);
  formData.append("variables[TARGET_BRANCH]", environment);
  formData.append("variables[TEST_IDs_REGEX]", testIdsRegex);
  formData.append("variables[ENVIRONMENT]", environment);
  formData.append("variables[TEST_RUN_ID]", testRun.id);
  if (tag_filter && tag_filter !== "all") {
    formData.append("variables[TEST_TAG]", tag_filter);
  }

  let gitlabRes: Response;
  try {
    gitlabRes = await fetch(cfg.trigger_url, {
      method: "POST",
      body: formData,
    });
  } catch (fetchErr) {
    await supabase
      .from("test_runs")
      .update({
        status: "aborted",
        description: `Failed to reach GitLab: ${String(fetchErr)}`,
      })
      .eq("id", testRun.id);
    return NextResponse.json(
      { error: "Failed to reach GitLab trigger URL" },
      { status: 502 },
    );
  }

  if (!gitlabRes.ok) {
    const errText = await gitlabRes.text().catch(() => "Unknown error");
    await supabase
      .from("test_runs")
      .update({
        status: "aborted",
        description: `GitLab trigger failed (${gitlabRes.status}): ${errText}`,
      })
      .eq("id", testRun.id);
    return NextResponse.json(
      { error: `GitLab returned ${gitlabRes.status}`, details: errText },
      { status: 502 },
    );
  }

  const gitlabData = (await gitlabRes.json()) as {
    id?: number;
    web_url?: string;
    status?: string;
  };
  const pipelineUrl = gitlabData.web_url ?? null;

  if (pipelineUrl) {
    await supabase
      .from("test_runs")
      .update({ gitlab_pipeline_url: pipelineUrl })
      .eq("id", testRun.id);
  }

  return NextResponse.json({
    test_run_id: testRun.id,
    pipeline_url: pipelineUrl,
  });
}
