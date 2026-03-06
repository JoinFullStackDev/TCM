# TestForge — Overview

## Executive Summary

TestForge is a QA operations platform built to replace Google Sheets-based test plans. It centralizes test planning, execution tracking, automation integration, and reporting across multiple projects while preserving the spreadsheet-like workflow QA teams are accustomed to.

**Status:** MVP (N1-N8) is complete. Post-MVP enhancements (dashboard, suite merge, assignee management, grid-level test run execution) are shipped.

## Current State

### What was replaced

Google Sheets workbooks with project-level files, multiple tabs per suite, and columns for ID, steps, test data, expected results, pass/fail status, automation status, platform tracking, bug links, and execution dates.

### Pain points solved

| Problem | Solution |
|---------|----------|
| Multiple large files become unwieldy | Unified project/suite/case hierarchy with fast grid view |
| Manual effort to generate metrics | Automated reporting with KPI cards, charts, dashboard |
| No CI/CD or bug tracking connection | Playwright webhook, Slack notifications, bug link tracking |
| Hard to find test cases across files | Global grid view with filtering by suite, status, platform, tags |
| No systematic automation tracking | Automation status management with CI/CD sync |

## Product Vision

An intuitive, web-based QA command center that preserves spreadsheet-like usability while adding:

- Role-aware dashboards with personalized insights
- Test tracking across projects, suites, and platforms
- Execution management with assignee controls and real-time status
- Automation integration (Playwright, Slack, with extensibility for k6/JMeter/GitLab)
- Reporting and cross-project visibility
- Suite management operations (merge, reorder, group)
