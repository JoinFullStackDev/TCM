'use client';

import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';

interface ReportData {
  runName: string;
  totalCases: number;
  pass: number;
  fail: number;
  blocked: number;
  skip: number;
  not_run: number;
  passRate: number;
  platformBreakdown: Record<
    string,
    { total: number; pass: number; fail: number; blocked: number }
  >;
}

interface ReportExportProps {
  data: ReportData;
}

export default function ReportExport({ data }: ReportExportProps) {
  const handleExcelExport = useCallback(async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['Metric', 'Value'],
      ['Test Run', data.runName],
      ['Total Cases', data.totalCases],
      ['Passed', data.pass],
      ['Failed', data.fail],
      ['Blocked', data.blocked],
      ['Skipped', data.skip],
      ['Not Run', data.not_run],
      ['Pass Rate', `${data.passRate}%`],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    const platformRows = [
      ['Platform', 'Total', 'Pass', 'Fail', 'Blocked', 'Pass Rate'],
      ...Object.entries(data.platformBreakdown).map(([platform, stats]) => [
        platform.charAt(0).toUpperCase() + platform.slice(1),
        stats.total,
        stats.pass,
        stats.fail,
        stats.blocked,
        stats.total > 0 ? `${Math.round((stats.pass / stats.total) * 100)}%` : '0%',
      ]),
    ];
    const platformSheet = XLSX.utils.aoa_to_sheet(platformRows);
    XLSX.utils.book_append_sheet(wb, platformSheet, 'Platform Breakdown');

    XLSX.writeFile(wb, `report-${data.runName.replace(/\s+/g, '-')}.xlsx`);
  }, [data]);

  const handlePdfExport = useCallback(async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`Test Run Report: ${data.runName}`, 20, 20);

    doc.setFontSize(12);
    doc.text(`Total Cases: ${data.totalCases}`, 20, 40);
    doc.text(`Passed: ${data.pass}`, 20, 50);
    doc.text(`Failed: ${data.fail}`, 20, 60);
    doc.text(`Blocked: ${data.blocked}`, 20, 70);
    doc.text(`Skipped: ${data.skip}`, 20, 80);
    doc.text(`Not Run: ${data.not_run}`, 20, 90);
    doc.text(`Pass Rate: ${data.passRate}%`, 20, 100);

    doc.setFontSize(14);
    doc.text('Platform Breakdown', 20, 120);

    let y = 135;
    doc.setFontSize(10);
    for (const [platform, stats] of Object.entries(data.platformBreakdown)) {
      const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;
      doc.text(
        `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${stats.pass}/${stats.total} (${passRate}%)`,
        20,
        y,
      );
      y += 10;
    }

    doc.save(`report-${data.runName.replace(/\s+/g, '-')}.pdf`);
  }, [data]);

  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Button
        variant="outlined"
        startIcon={<PictureAsPdfOutlinedIcon />}
        onClick={handlePdfExport}
        size="small"
      >
        Export to PDF
      </Button>
      <Button
        variant="outlined"
        startIcon={<TableChartOutlinedIcon />}
        onClick={handleExcelExport}
        size="small"
      >
        Export to Excel
      </Button>
    </Box>
  );
}
