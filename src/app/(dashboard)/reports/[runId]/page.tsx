'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import NextLink from 'next/link';
import PageTransition from '@/components/animations/PageTransition';
import KpiCards from '@/components/reports/KpiCards';
import PlatformBarChart from '@/components/reports/PlatformBarChart';
import StatusDonutChart from '@/components/reports/StatusDonutChart';
import ReportExport from '@/components/reports/ReportExport';
import { useAuth } from '@/components/providers/AuthProvider';

interface ReportData {
  run: {
    name: string;
    status: string;
    projects?: { name: string };
  };
  summary: {
    totalCases: number;
    pass: number;
    fail: number;
    blocked: number;
    skip: number;
    not_run: number;
    passRate: number;
  };
  platformBreakdown: Record<
    string,
    { total: number; pass: number; fail: number; blocked: number; skip: number; not_run: number }
  >;
  statusDistribution: {
    pass: number;
    fail: number;
    blocked: number;
    skip: number;
    not_run: number;
  };
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.runId as string;
  const { isLoading: authLoading } = useAuth();

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    const res = await fetch(`/api/reports/test-run/${runId}`);
    if (res.ok) setReport(await res.json());
    else router.push('/reports');
    setLoading(false);
  }, [runId, router]);

  useEffect(() => {
    if (!authLoading) fetchReport();
  }, [authLoading, fetchReport]);

  if (authLoading || loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!report) return null;

  return (
    <PageTransition>
      <Box>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component={NextLink}
            href="/reports"
            underline="hover"
            color="text.secondary"
            fontSize="0.875rem"
          >
            Reports
          </Link>
          <Typography fontSize="0.875rem" color="text.primary">
            {report.run.name}
          </Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <IconButton
            onClick={() => router.push('/reports')}
            size="small"
            sx={{ color: 'text.secondary' }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="h4" sx={{ fontWeight: 700, flex: 1 }}>
            {report.run.name}
          </Typography>
          <ReportExport
            data={{
              runName: report.run.name,
              totalCases: report.summary.totalCases,
              pass: report.summary.pass,
              fail: report.summary.fail,
              blocked: report.summary.blocked,
              skip: report.summary.skip,
              not_run: report.summary.not_run,
              passRate: report.summary.passRate,
              platformBreakdown: report.platformBreakdown,
            }}
          />
        </Box>

        <KpiCards
          totalCases={report.summary.totalCases}
          pass={report.summary.pass}
          fail={report.summary.fail}
          blocked={report.summary.blocked}
          passRate={report.summary.passRate}
        />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 3,
          }}
        >
          <PlatformBarChart data={report.platformBreakdown} />
          <StatusDonutChart
            data={report.statusDistribution}
            passRate={report.summary.passRate}
          />
        </Box>
      </Box>
    </PageTransition>
  );
}
