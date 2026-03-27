import { NextResponse } from "next/server";
import { z } from "zod";
import {
  withAuth,
  validationError,
  notFound,
  serverError,
} from "@/lib/api/helpers";
import type { GitLabCIConfig } from "@/types/database";

const bodySchema = z.object({
  integration_id: z.string().uuid(),
  suite_ids: z.array(z.string().uuid()).min(1),
  environment: z.enum(["dev", "qa", "uat"]),
  tag_filter: z.enum(["smoke", "regression", "all"]).optional().default("all"),
});

export async function POST(req: Request) {
  const auth = await withAuth("manage_integrations");
  if (!auth.ok) return auth.response;
  const { user, supabase } = auth.ctx;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return validationError(err);
  }

  const { integration_id, suite_ids, environment, tag_filter } = body;

  const { data: integration, error: intErr } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", integration_id)
    .single();

  if (intErr || !integration) {
    return notFound("Integration");
  }

  if (integration.type !== "gitlab" || !integration.is_active) {
    return NextResponse.json(
      { error: "Integration is not an active GitLab CI integration" },
      { status: 400 },
    );
  }

  const { data: suites, error: suiteErr } = await supabase
    .from("suites")
    .select("id, name, project_id")
    .in("id", suite_ids);

  if (suiteErr || !suites || suites.length === 0) {
    return notFound("Suites");
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

  const runName =
    suites.length === 1
      ? `${suites[0].name} – ${environment.toUpperCase()}`
      : `${suites.length} Suites – ${environment.toUpperCase()}`;

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
      start_date: new Date().toISOString(),
    })
    .select()
    .single();

  if (runErr || !testRun) {
    return serverError(`Failed to create test run: ${runErr?.message}`);
  }

  const runCaseInserts = testCases.map((tc) => ({
    test_run_id: testRun.id,
    test_case_id: tc.id,
    overall_status: "not_run",
  }));

  await supabase.from("test_run_cases").insert(runCaseInserts);

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
  const appUrl =
    process.env.APP_URL ?? `https://${(req as Request).headers.get("host")}`;
  formData.append(
    "variables[TCM_WEBHOOK_URL]",
    `${appUrl}/api/webhooks/playwright`,
  );
  formData.append(
    "variables[TCM_WEBHOOK_API_KEY]",
    process.env.WEBHOOK_API_KEY ?? "",
  );
  formData.append("variables[TCM_PROJECT_ID]", integration.project_id);

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
