# What changed and why

Merged baseline: `ttthierno/CMSC-447-Project-KTC`, branch `master`, commit `f5c93775417f69ec148f0ba32633fbd978312b66`. The newer teammate application ZIP matched all 128 tracked files at this baseline after line-ending normalization.

| Area | Change needed | Result |
|---|---|---|
| Local setup | Root commands, environment generation, migrations, and demo seed | Repeatable PostgreSQL 17.10 demo without Docker |
| Server compilation | Replace frontend-oriented TypeScript settings with a Node build | Express compiles and starts from server/dist |
| Authentication | Guard application routes; map verified Better Auth account IDs to KTC UUIDs | Server-derived actor on every business request |
| Database | Use the supplied ktc schema for project records | UUIDs, foreign keys, row security, immutable anchors, versions, and audit triggers work together |
| Privileges | Separate authentication, application-runtime, and setup-owner connections | Application queries cannot run as the schema owner or bypass row security |
| Compatibility | Add 003_application_bridge.sql | Account identity and UI priority work with the supplied design; SQL 001/002 stay unchanged |
| API/UI contract | Convert integer identifiers to UUID strings; translate roles/status labels | Original UI works with the new database |
| PDF handling | Parse PDFs, record every page, hash original bytes, and use private storage | Files and metadata persist; unauthorized downloads are rejected |
| Viewer | Page navigation, zoom, Fit, Pan, and the existing collapsible sidebar | Complete drawing workspace can be demonstrated |
| Marker geometry | Normalize coordinates to the unrotated CropBox; transform for PDF rotation | Restoration after reload, zoom, and drawing-container resize |
| Creation | Require drawing, page, location, title, and description | Every new item has a valid anchor |
| Editing | Edit title/description; require the saved version | Stale concurrent edits return 409; anchors stay fixed |
| Existing features | Retain comments, photos, assignment, priority, and workflow transitions | Features use integrated records and protected storage |
| Teammate UI retention | Existing CSS, fonts, Home/Login/Signup/Settings screens and sidebar retained; only contextual destinations change | Preserves design and layout while linking to actual project workflows |
| Reproducibility | npm lockfiles, fixtures, API/database tests, and guides | Reviewable changes and clean installation |

## Additional merge resolutions

- Retained both username plugins, required username field and both upstream username migrations unchanged.
- Updated the fresh demo seed to supply unique usernames; existing users are left unchanged.
- Retained teammate project input trimming, error reporting and null-safe dashboard collections.
- Prevented repeat setup from regenerating the tracked PDF fixture.
- Added scoped PDF-toolbar wrapping, scroll behavior and selected-drawing text contrast; no global theme overrides.
- Added two compatibility tests and a Windows/WSL guide with a current-base patch.
- Added readable PostgreSQL startup failure diagnostics and a Node 24 .nvmrc.

## Sprint 2 alignment

| Current JIRA reference | Working demonstration / evidence |
|---|---|
| SCRUM-70 | Versioned schema plus explicit compatibility migration |
| SCRUM-75, SCRUM-76, SCRUM-77, SCRUM-107 | Upload, persist, retrieve, and display a project PDF |
| SCRUM-78 | Navigation, pan, and zoom |
| SCRUM-80, SCRUM-81 | Place an item and store normalized drawing-relative coordinates |
| SCRUM-83, SCRUM-106 | Restore markers from PostgreSQL on the correct page |
| SCRUM-90 | Rotation math and browser checks across zoom, reload, and viewer-container resize |
| SCRUM-51 / authentication work | Verified sign-in and project access controls |

This mapping records what the program demonstrates. It does not alter JIRA statuses, establish stakeholder approval (SCRUM-102), or claim all long-term SRS requirements are finished. The assumption that Sprint 2 tasks finish on time is a planning assumption, not test evidence.

## Boundaries

- The database contains markup/export structures and functions. Full markup tools, a generated export archive, and a background export worker are not exposed by this application.
- Production email, hosting, object storage, monitoring, operational backup/restore, load testing, and a broad browser/device matrix remain separate work.
- Legacy integer-ID project records remain in original public tables but are not automatically imported into ktc. Read the database guide before using an existing populated database.
