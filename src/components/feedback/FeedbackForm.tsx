'use client';

import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,application/pdf,text/plain';

type SubmissionType = 'bug' | 'feature_request';
type Severity = 'critical' | 'high' | 'medium' | 'low';
type Environment = 'production' | 'staging' | 'development';

interface Project {
  id: string;
  name: string;
}

interface FieldErrors {
  title?: string;
  description?: string;
  severity?: string;
  loom_url?: string;
  submitter_email?: string;
  general?: string;
}

export default function FeedbackForm() {
  const [submissionType, setSubmissionType] = useState<SubmissionType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [loomUrl, setLoomUrl] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [environment, setEnvironment] = useState<Environment | ''>('');
  const [projectId, setProjectId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/feedback/projects')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .catch(() => {});
  }, []);

  function validateForm(): boolean {
    const newErrors: FieldErrors = {};
    if (title.trim().length < 3) newErrors.title = 'Title must be at least 3 characters';
    if (title.trim().length > 500) newErrors.title = 'Title must be at most 500 characters';
    if (description.trim().length < 10) newErrors.description = 'Description must be at least 10 characters';
    if (submissionType === 'bug' && !severity) newErrors.severity = 'Severity is required for bug reports';
    if (loomUrl && !/^https?:\/\/.+/.test(loomUrl)) newErrors.loom_url = 'Must be a valid URL';
    if (submitterEmail && !/^[^@]+@[^@]+\.[^@]+$/.test(submitterEmail)) {
      newErrors.submitter_email = 'Must be a valid email address';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const newFiles = Array.from(e.target.files ?? []);
    const combined = [...files, ...newFiles];

    if (combined.length > MAX_FILES) {
      setFileError(`Maximum ${MAX_FILES} files allowed`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    for (const f of newFiles) {
      if (f.size > MAX_FILE_SIZE) {
        setFileError(`"${f.name}" exceeds the 10MB limit`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setFiles(combined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const formData = new FormData();
      formData.set('submission_type', submissionType);
      formData.set('title', title.trim());
      formData.set('description', description.trim());
      if (severity) formData.set('severity', severity);
      if (stepsToReproduce.trim()) formData.set('steps_to_reproduce', stepsToReproduce.trim());
      if (expectedBehavior.trim()) formData.set('expected_behavior', expectedBehavior.trim());
      if (actualBehavior.trim()) formData.set('actual_behavior', actualBehavior.trim());
      if (loomUrl.trim()) formData.set('loom_url', loomUrl.trim());
      if (submitterName.trim()) formData.set('submitter_name', submitterName.trim());
      if (submitterEmail.trim()) formData.set('submitter_email', submitterEmail.trim());
      if (environment) formData.set('environment', environment);
      if (projectId) formData.set('project_id', projectId);
      // Honeypot — always empty, hidden from user
      formData.set('_hp_field', '');

      for (const file of files) {
        formData.append('files[]', file);
      }

      const res = await fetch('/api/feedback', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.details?.fieldErrors) {
          const fieldErrors: FieldErrors = {};
          for (const [key, msgs] of Object.entries(data.details.fieldErrors)) {
            (fieldErrors as Record<string, string>)[key] = Array.isArray(msgs) ? msgs[0] : String(msgs);
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ general: data?.error ?? 'Submission failed. Please try again.' });
        }
        return;
      }

      setSubmittedId(data.id);
    } catch {
      setErrors({ general: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submittedId) {
    return (
      <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Feedback Received
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Thank you for your submission. Our team will review it shortly.
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Reference: {submittedId}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Submit Feedback
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Report a bug or suggest a feature improvement.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          {/* Honeypot — visually hidden */}
          <Box
            component="input"
            name="_hp_field"
            type="text"
            tabIndex={-1}
            aria-hidden="true"
            defaultValue=""
            sx={{ position: 'absolute', left: '-9999px', opacity: 0 }}
          />

          {/* Submission type */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Type *
            </Typography>
            <ToggleButtonGroup
              value={submissionType}
              exclusive
              onChange={(_, val) => val && setSubmissionType(val)}
              size="small"
            >
              <ToggleButton value="bug" sx={{ gap: 1, px: 2 }}>
                <BugReportOutlinedIcon fontSize="small" />
                Bug Report
              </ToggleButton>
              <ToggleButton value="feature_request" sx={{ gap: 1, px: 2 }}>
                <LightbulbOutlinedIcon fontSize="small" />
                Feature Request
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Title */}
          <TextField
            fullWidth
            label="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={!!errors.title}
            helperText={errors.title ?? `${title.length}/500`}
            sx={{ mb: 2 }}
            disabled={isSubmitting}
            inputProps={{ maxLength: 500 }}
          />

          {/* Description */}
          <TextField
            fullWidth
            multiline
            minRows={4}
            label="Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={!!errors.description}
            helperText={errors.description}
            sx={{ mb: 2 }}
            disabled={isSubmitting}
          />

          {/* Severity — only for bugs */}
          {submissionType === 'bug' && (
            <FormControl fullWidth sx={{ mb: 2 }} error={!!errors.severity}>
              <InputLabel>Severity *</InputLabel>
              <Select
                label="Severity *"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                disabled={isSubmitting}
              >
                <MenuItem value="critical">Critical</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="low">Low</MenuItem>
              </Select>
              {errors.severity && <FormHelperText>{errors.severity}</FormHelperText>}
            </FormControl>
          )}

          {/* Steps to reproduce — bugs only */}
          {submissionType === 'bug' && (
            <>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Steps to Reproduce"
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                sx={{ mb: 2 }}
                disabled={isSubmitting}
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Expected Behavior"
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                sx={{ mb: 2 }}
                disabled={isSubmitting}
              />
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Actual Behavior"
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                sx={{ mb: 2 }}
                disabled={isSubmitting}
              />
            </>
          )}

          {/* Environment */}
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Environment</InputLabel>
            <Select
              label="Environment"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as Environment | '')}
              disabled={isSubmitting}
            >
              <MenuItem value="">Not specified</MenuItem>
              <MenuItem value="production">Production</MenuItem>
              <MenuItem value="staging">Staging</MenuItem>
              <MenuItem value="development">Development</MenuItem>
            </Select>
          </FormControl>

          {/* Project */}
          {projects.length > 0 && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Project</InputLabel>
              <Select
                label="Project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={isSubmitting}
              >
                <MenuItem value="">Not specified</MenuItem>
                {projects.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Loom URL */}
          <TextField
            fullWidth
            label="Loom Recording URL"
            placeholder="https://www.loom.com/share/..."
            value={loomUrl}
            onChange={(e) => setLoomUrl(e.target.value)}
            error={!!errors.loom_url}
            helperText={errors.loom_url}
            sx={{ mb: 2 }}
            disabled={isSubmitting}
          />

          {/* File attachments */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
              Attachments
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              PNG, JPG, WEBP, GIF, MP4, WEBM, PDF, TXT — max 10MB each, up to 5 files
            </Typography>

            <Button
              variant="outlined"
              size="small"
              startIcon={<AttachFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting || files.length >= MAX_FILES}
            >
              Add File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {fileError && (
              <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                {fileError}
              </Alert>
            )}

            {files.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1.5 }}>
                {files.map((file, i) => (
                  <Chip
                    key={`${file.name}-${i}`}
                    label={`${file.name} (${(file.size / 1024).toFixed(0)} KB)`}
                    onDelete={() => removeFile(i)}
                    deleteIcon={<CloseIcon />}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Submitter info */}
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
            Your Info (optional)
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' }, mb: 2 }}>
            <TextField
              fullWidth
              label="Name"
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
              disabled={isSubmitting}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={submitterEmail}
              onChange={(e) => setSubmitterEmail(e.target.value)}
              error={!!errors.submitter_email}
              helperText={errors.submitter_email}
              disabled={isSubmitting}
            />
          </Box>

          {errors.general && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.general}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={isSubmitting}
            startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isSubmitting ? 'Submitting…' : 'Submit Feedback'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
