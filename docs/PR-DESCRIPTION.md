The teammate update adds username-based profiles and a revised frontend. This integrates the Sprint 2 PostgreSQL design without replacing that theme, sidebar, account screens, fonts, or existing page styles.

Project/PDF/item APIs now use the KTC schema with server-derived identity, project membership enforcement, protected files, normalized anchors, and versioned edits. Frontend changes connect those APIs and add the necessary PDF navigation/zoom/pan/placement and item-edit controls. Both username plugins and the original username migrations remain in place; the fresh demo seed supplies usernames.

Validation: clean npm installation; nine Prisma migrations; TypeScript/Vite build; 24 passing Node test results; 62 supplied database checks; browser create/edit/marker workflow. Username migration was checked against populated pre-username tables, and signup/profile/username login compatibility was tested. Lint has two warnings and no errors. The verification document records platform limits and known dependency/build warnings.

Existing public integer-ID business tables are preserved but are not automatically imported into KTC. Review docs/DATABASE-INTEGRATION.md before connecting a populated team database. This package provides a local classroom demo, not a production cutover.
