"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import { alpha } from "@mui/material/styles";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { palette } from "@/theme/palette";
import type { Integration, Project, Suite } from "@/types/database";

interface Props {
  open: boolean;
  /** If omitted, a project selector is shown inside the dialog */
  projectId?: string;
  /** If provided, suite selector is pre-filled and hidden */
  preselectedSuiteId?: string;
  onClose: () => void;
  onTriggered?: (testRunId: string, pipelineUrl: string | null) => void;
}

export default function TriggerAutomatedRunDialog({
  open,
  projectId,
  preselectedSuiteId,
  onClose,
  onTriggered,
}: Props) {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectId ?? "");
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [suites, setSuites] = useState<Suite[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState(
    preselectedSuiteId ?? "",
  );
  const [environment, setEnvironment] = useState<"dev" | "qa" | "uat">("qa");
  const [tagFilter, setTagFilter] = useState<"all" | "smoke" | "regression">(
    "all",
  );
  const [cicdCount, setCicdCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeIntegration =
    integrations.find((i) => i.type === "gitlab" && i.is_active) ?? null;

  // Fetch project list only when no projectId prop is provided
  const fetchProjects = useCallback(async () => {
    if (projectId) return;
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  }, [projectId]);

  const fetchProjectData = useCallback(async (pid: string) => {
    if (!pid) {
      setIntegrations([]);
      setSuites([]);
      return;
    }
    setLoading(true);
    try {
      const [intRes, suiteRes] = await Promise.all([
        fetch(`/api/integrations?project_id=${pid}`),
        fetch(`/api/projects/${pid}/suites`),
      ]);
      if (intRes.ok) setIntegrations(await intRes.json());
      if (suiteRes.ok) setSuites(await suiteRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      const initialProjectId = projectId ?? "";
      setSelectedProjectId(initialProjectId);
      setSelectedSuiteId(preselectedSuiteId ?? "");
      setEnvironment("qa");
      setTagFilter("all");
      setError(null);
      setCicdCount(null);
      setIntegrations([]);
      setSuites([]);
      Promise.all([fetchProjects(), fetchProjectData(initialProjectId)]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when selected project changes (only relevant when no projectId prop)
  useEffect(() => {
    if (!open) return;
    setSelectedSuiteId("");
    setCicdCount(null);
    fetchProjectData(selectedProjectId);
  }, [selectedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedSuiteId) {
      setCicdCount(null);
      return;
    }
    setLoadingCount(true);
    fetch(
      `/api/projects/${selectedProjectId}/test-cases?suite_id=${selectedSuiteId}&automation_status=in_cicd`,
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown[]) =>
        setCicdCount(Array.isArray(data) ? data.length : 0),
      )
      .catch(() => setCicdCount(null))
      .finally(() => setLoadingCount(false));
  }, [selectedSuiteId, selectedProjectId]);

  const handleTrigger = async () => {
    if (!activeIntegration || !selectedSuiteId) return;
    setTriggering(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/gitlab/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_id: activeIntegration.id,
          suite_id: selectedSuiteId,
          environment,
          tag_filter: tagFilter,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to trigger pipeline");
        return;
      }
      onTriggered?.(data.test_run_id, data.pipeline_url ?? null);
      onClose();
      router.push(`/runs/${data.test_run_id}`);
    } catch {
      setError("Failed to reach server");
    } finally {
      setTriggering(false);
    }
  };

  const canTrigger = Boolean(
    activeIntegration && selectedSuiteId && (cicdCount ?? 0) > 0 && !triggering,
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Trigger Automated Run</DialogTitle>
      <DialogContent>
        {/* Project selector — only shown when no projectId prop was passed */}
        {!projectId && (
          <FormControl fullWidth size="small" sx={{ mb: 2, mt: 0.5 }}>
            <InputLabel>Project</InputLabel>
            <Select
              value={selectedProjectId}
              label="Project"
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {loading && selectedProjectId ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            {selectedProjectId && !activeIntegration && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                No active GitLab CI integration configured for this project. Add
                one on the Integrations page.
              </Alert>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {!preselectedSuiteId && (
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Suite</InputLabel>
                <Select
                  value={selectedSuiteId}
                  label="Suite"
                  onChange={(e) => setSelectedSuiteId(e.target.value)}
                  disabled={!activeIntegration}
                >
                  {suites.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name} ({s.prefix})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Environment</InputLabel>
              <Select
                value={environment}
                label="Environment"
                onChange={(e) =>
                  setEnvironment(e.target.value as "dev" | "qa" | "uat")
                }
                disabled={!activeIntegration}
              >
                <MenuItem value="dev">dev</MenuItem>
                <MenuItem value="qa">qa</MenuItem>
                <MenuItem value="uat">uat</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Tag Filter</InputLabel>
              <Select
                value={tagFilter}
                label="Tag Filter"
                onChange={(e) =>
                  setTagFilter(e.target.value as "all" | "smoke" | "regression")
                }
                disabled={!activeIntegration}
              >
                <MenuItem value="all">All tests</MenuItem>
                <MenuItem value="smoke">Smoke only</MenuItem>
                <MenuItem value="regression">Regression only</MenuItem>
              </Select>
            </FormControl>

            {selectedSuiteId && (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: palette.background.surface2,
                  border: `1px solid ${palette.divider}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                {loadingCount ? (
                  <CircularProgress size={14} />
                ) : (
                  <Chip
                    label={cicdCount ?? 0}
                    size="small"
                    sx={{
                      height: 22,
                      fontWeight: 700,
                      bgcolor:
                        (cicdCount ?? 0) > 0
                          ? alpha(palette.success.main, 0.15)
                          : alpha(palette.warning.main, 0.15),
                      color:
                        (cicdCount ?? 0) > 0
                          ? palette.success.main
                          : palette.warning.main,
                    }}
                  />
                )}
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {loadingCount
                    ? "Counting automated test cases..."
                    : (cicdCount ?? 0) > 0
                      ? `in_cicd test case${cicdCount !== 1 ? "s" : ""} will be included`
                      : "No in_cicd test cases found in this suite"}
                </Typography>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={triggering}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={
            triggering ? <CircularProgress size={14} /> : <PlayArrowIcon />
          }
          onClick={handleTrigger}
          disabled={!canTrigger}
        >
          {triggering ? "Triggering..." : "Trigger Pipeline"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
