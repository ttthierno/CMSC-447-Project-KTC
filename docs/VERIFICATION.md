# Merged verification results - 27 October 2026

Baseline: `f5c93775417f69ec148f0ba32633fbd978312b66` from `ttthierno/CMSC-447-Project-KTC`, master. All 128 tracked files matched the supplied newer ZIP after line-ending normalization. The prior integration was based on c47ec4c; its patch is superseded.

Environment: Windows x64, Node 24.19.0, npm 10.9.2, PostgreSQL 17.10, Prisma 6.19.3, Vite 8.3.5. WSL inventory showed docker-desktop only. No Ubuntu/WSL execution is claimed; the guide includes installing Ubuntu and rerunning validation there.

## Results

| Check | Result |
|---|---|
| Clean install | All three npm lockfiles installed in the new merged checkout. Root and frontend audits reported zero vulnerabilities. |
| Fresh setup | Nine Prisma migrations, KTC schema/workflows/bridge, demo accounts and project initialized successfully. |
| Build | Server and frontend TypeScript plus Vite production build pass. |
| API, geometry and merge tests | 24 results pass: 20 API subtests + parent, geometry, username migration, username API compatibility. |
| Supplied SQL tests | All 62 checks pass; test transaction rolled back. |
| Populated username upgrade | Ran the original migration history with existing users, account/password value, session, project and membership in a rollback-only schema. Username backfill preserves those values and enforces NOT NULL and uniqueness. |
| Username compatibility | Real signup, case-insensitive duplicate rejection, email login, name/username editing and username login pass. |
| Repeat setup | No pending Prisma migrations; fixture bytes unchanged; edited browser-created item persists. |
| UI smoke check | Real login, project/dashboard loading, sidebar collapse, two PDF pages, zoom, rotated-page item creation, description edit, marker reopen and full restart verified. |
| Lint | Zero errors; two set-state-in-effect warnings in Projects and Team. |

## Security and workflow coverage

Anonymous project access is denied. Outsiders cannot read project records or PDF bytes. Role restrictions reject inspector upload and reviewer creation. Valid PDF uploads retain original bytes; malformed PDF content is rejected. Missing/invalid anchors, blank descriptions and cross-project drawing references fail. Edits require a version, cannot change the anchor, and reject stale/concurrent saves with 409. Valid review-state transitions, comments and sign-out work. Database runtime queries without an actor expose no project rows; the runtime role is not a superuser.

The supplied database suite separately tests row security, role restrictions, immutable anchors, events, memberships and markup/export database functions. It does not prove a complete markup/export application workflow.

## Browser persistence and geometry evidence

The merged browser run created an item on rotated page 2 with unrotated anchor (0.23565925, 0.36195509). The edited description remained available at version 2 after stopping all services, repeating setup and restarting. The existing synthetic project contains that local verification item; the shipped seed starts with only its standard example item.

On page 1, the saved seed marker measured exactly (0.25, 0.50) at 125% zoom. On rotated page 2, its expected display coordinate is (0.63804491, 0.23565925). Measured coordinates at page widths 757 and 583 CSS pixels were (0.63804491, 0.23565925) and (0.63802530, 0.23562500), respectively. The difference is below 0.00004 per axis and consistent with subpixel rounding. Sidebar collapse/expand caused the width change. This is a targeted browser check, not a full device matrix.

## Design preservation and necessary exceptions

App.css, index.css, Projects.css, ProjectDashboard.css, font assets/licenses, both loading-screen variants, Home, Login, Signup and UserSetup are unchanged from the teammate commit. Both username migrations and Prisma schema are unchanged. The sidebar/header markup and collapse behavior remain intact; project-dependent link destinations now resolve to the selected project.

Functional exceptions: PDF tools and scroll handling, a drawing-label contrast correction scoped to Plans, UUID/session API wiring, anchor-required creation, title/description editing and a saved-version/conflict message, role choices/status labels, and a ready-for-review count in the existing dashboard heading. Existing cards/grids and theme files were retained. The earlier integration's global CSS overrides and hide-drawing-list layout were not carried forward.

## Known limits

- Existing integer-ID public business tables are preserved but not imported into KTC. No team database or uploaded-file set was supplied. See DATABASE-INTEGRATION.md before a real-data cutover.
- The unchanged teammate CSS produces a late duplicate @import warning; Vite still builds and the bundled Ranade font loads. The main JS bundle is about 971 kB and the PDF worker about 1.27 MB before gzip. Performance targets were not measured.
- A current server npm audit reports three high-severity entries from one deepmerge-ts stack-exhaustion advisory through Prisma configuration tooling. No untested major upgrade was applied: https://github.com/advisories/GHSA-ggr8-5vv4-36mx
- Photo handling is retained, but the HTTP suite does not include a photo-upload round trip. Production email/hosting, backup restoration, load tests, tablet/touch coverage and stakeholder acceptance are not established by this package.
- No remote GitHub push, PR or merge was performed. Newer remote commits arriving after the comparison require the guide's fetch/merge/retest step.
