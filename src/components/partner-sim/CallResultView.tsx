'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import JsonBlock from './JsonBlock';
import { PARTNER_API_PREFIX } from '@/lib/partner-sim/transport';
import { HttpChip } from './StatusChip';
import { problemCode, type CallResult } from './types';

/** The Partner API only answers JSON; HTML means the request reached a website instead. */
export function looksLikeWebPage(call: CallResult): boolean {
  return (call.headers['content-type'] ?? '').includes('text/html');
}

/** One request to the Partner API and its answer, as the simulator saw them. */
export default function CallResultView({
  call,
  requestBody,
  defaultExpanded = true,
}: {
  call: CallResult;
  requestBody?: unknown;
  defaultExpanded?: boolean;
}) {
  const replayed = call.headers['idempotent-replayed'];
  return (
    <Accordion defaultExpanded={defaultExpanded} disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
          <HttpChip status={call.status} code={problemCode(call.body)} />
          <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {call.method} {call.url}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {call.durationMs} ms
          </Typography>
          {replayed && (
            <Typography variant="caption" color="warning.main">
              Idempotent-Replayed: {replayed}
            </Typography>
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {call.error && (
          <Typography color="error" variant="body2" sx={{ mb: 1.5 }}>
            {call.error}
          </Typography>
        )}
        {looksLikeWebPage(call) && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            This answer is a web page, not the Partner API. Either the base URL is wrong, or this FullStackRx host
            doesn&apos;t serve <code>{PARTNER_API_PREFIX}</code> yet (an older build answers with the website).
          </Alert>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">
              Request headers
            </Typography>
            <JsonBlock value={call.requestHeaders} maxHeight={200} />
            {requestBody !== undefined && (
              <>
                <Typography variant="overline" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                  Request body
                </Typography>
                <JsonBlock value={requestBody} />
              </>
            )}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">
              Response headers
            </Typography>
            <JsonBlock value={call.headers} maxHeight={200} />
            <Typography variant="overline" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
              Response body
            </Typography>
            <JsonBlock value={call.body} />
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
