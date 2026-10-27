# Teammate update: impact and resolution

The changes affect the previous setup. Applying the earlier integration as-is would overlap with the revised App shell and omit the required username when creating demo accounts. The merged package uses the teammate's current code as the base and preserves its visual design.

## Compared sources

- New teammate ZIP: CMSC-447-Project-KTC-master.zip.
- Matching GitHub master commit: f5c93775417f69ec148f0ba32633fbd978312b66, "Implement authentication and project dashboard functionality".
- Earlier integration base: c47ec4c1b9a93993326ec001efd35b29fe3a029c.
- All 128 tracked files in the new base match the supplied archive, allowing for line endings. The merge is local; GitHub has not been changed.

## What affected compatibility

| Teammate change | Effect | Resolution |
|---|---|---|
| Required unique User.username and username migrations | Earlier seed omitted a required column | Keep upstream schema/migrations; seed unique demo usernames and preserve existing names |
| Username auth/client plugins, Signup and Settings | Replacing auth configuration would break the new flow | Keep both plugins and account screens; test signup, profile editing and username login |
| New shell, fonts, collapsible sidebar and theme | Previous App/CSS replacement would overwrite design | Keep upstream layout/styles/assets; change only project-aware destinations and add scoped functional styles |
| Project request/error handling and defensive dashboard rendering | Blindly copying old pages would lose fixes | Preserve upstream trim/error/null handling and adapt only API calls and UUID types |
| Session checks on old Prisma routes | Those routes still use legacy integer project records | Retain session enforcement and use the KTC actor/membership model for every business request |
| Integration's live PDF/anchor/version contract | Legacy frontend assumes integer IDs and editable locations | Adapt IDs, PDF credentials, required anchors, immutable coordinates and versioned edits |

## Files intentionally retained unchanged

- All existing CSS files: App.css, index.css, Projects.css, ProjectDashboard.css and loading styles.
- Ranade assets and license; Home, Login, Signup, UserSetup and both loading-screen variants.
- Prisma schema and all nine upstream migrations, including both username migration directories.
- The App shell's visible labels, icons, header, sidebar and collapse/expand structure.

## Necessary frontend changes

- App.tsx: load scoped additions and route Drawings/Punch List/Team to the active project's UUID. With no selected project, these links lead to Projects. No shell redesign.
- Projects/NewProject/ProjectDashboard: same cards and layout, authenticated same-origin API requests, UUID types, valid New Punch Item destination, actual role labels and review-state count.
- Plans: retain the drawing-list/viewer structure and theme; support credentials, page navigation, zoom, Fit, Pan, marker placement/restoration and page rotation. Toolbar wrapping avoids clipped controls. The active drawing filename gets readable dark text on its existing pale background.
- NewPunchItem/PunchItem/PunchList/Team: UUID-aware requests, required drawing location/description, versioned title/description edit, conflict reload, correct role/status choices, and protected PDF/photo URLs. Original grids/cards remain.
- No global light-theme overrides, alternate header or hide-drawing-list control from the earlier integration.

## Other implementation work

- Preserve KTC schema, RLS, original PDF storage/hashes, all-page metadata, role checks, optimistic concurrency, immutable anchors, comments/photos/assignment and database bridge.
- Retain reproducible install/setup/build/demo commands and lockfiles; add Node 24 .nvmrc.
- Prevent repeat setup from rewriting the tracked example PDF, and expose useful PostgreSQL startup diagnostics.
- Add tests for populated username migration and username API compatibility.
- Replace stale merge documentation with explicit Windows + Ubuntu WSL commands and PR instructions, including a later-teammate-push path.

## Verification and boundaries

Build passes. All 24 Node test results and 62 database checks pass. Real browser creation, editing, rotated marker restoration, sidebar resizing and restart persistence pass. Lint has two warnings and no errors. Full results and remaining dependency/build warnings are in VERIFICATION.md.

This machine has WSL 2 for docker-desktop but no Ubuntu distribution; the Ubuntu execution path needs validation after installation. The Windows implementation was tested. Existing public legacy projects are not automatically imported into KTC; a populated team database needs a separate staged data migration. The earlier demo folder and its saved data remain intact. Earlier presentation screenshots show the prior layout and were not rewritten in this merge-only task.
