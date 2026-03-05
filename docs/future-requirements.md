# Future Requirements — SOON: Enhanced Capabilities

These features are **not in MVP scope** but should be kept in mind during architectural and data model decisions to avoid costly rework later.

| ID | Feature | Priority | Doc |
|---|---|---|---|
| S1 | Enhanced Playwright Automation Integration | Must Have | [features/s1-enhanced-playwright.md](features/s1-enhanced-playwright.md) |
| S2 | Automated Test Triggering (Playwright + GitLab CI) | Must Have | [features/s2-automated-test-triggering.md](features/s2-automated-test-triggering.md) |
| S3 | Performance Testing Integration | Must Have | [features/s3-performance-testing.md](features/s3-performance-testing.md) |
| S4 | Slack Integration | Must Have | [features/s4-slack-integration.md](features/s4-slack-integration.md) |
| S5 | GitLab Integration | Must Have | [features/s5-gitlab-integration.md](features/s5-gitlab-integration.md) |
| S6 | Advanced Test Case Features | — | [features/s6-advanced-test-cases.md](features/s6-advanced-test-cases.md) |
| S7 | Collaboration Features | — | [features/s7-collaboration.md](features/s7-collaboration.md) |

## Architectural Implications for MVP

Key things to design for now even though these ship later:

- **Webhook / API layer** — S1, S2, S3 all post results into the system. The API should be extensible from day one.
- **External integrations table** — S4 (Slack) and S5 (GitLab) need per-project integration configs. Plan the schema.
- **Test case type field** — S3 introduces "Performance" as a type alongside functional. Keep the type enum extensible.
- **Custom fields** — S6 adds user-defined fields. Consider a flexible metadata / custom-fields pattern in the data model.
- **Activity / audit log** — S7 needs an activity feed. The version history from N2 can feed into this if designed broadly.
- **Comments system** — S7 adds threaded comments with @mentions. Plan a polymorphic comments table early.
