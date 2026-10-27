# Database integration

## Implemented arrangement

Original Prisma migrations still maintain Better Auth's public User, session, account, and verification tables. Account IDs and password hashes are preserved. The teammate username migration fills existing rows with user_<id> and displayUsername=name before enforcing a required unique username. Fresh demo accounts use demo_<role>; repeat seeding does not overwrite existing usernames. Project data now uses the supplied ktc schema through parameterized node-postgres queries.

`ktc.ensure_auth_user(integer)` maps a verified account to a KTC UUID using auth_issuer='better-auth' and auth_subject=account ID. Only the authentication database role can call this bridge. The session supplies the account ID; a client cannot choose its actor.

Each business operation uses one connection and transaction, selects ktc_app, sets its actor with transaction-local set_config, commits or rolls back, and then releases the connection. Row security evaluates the correct membership without leaking identity between requests.

| Connection | Purpose |
|---|---|
| ktc_owner | Local setup, migrations, demo seed, and rollback-only database checks |
| ktc_auth / DATABASE_URL | Better Auth tables and identity bridge |
| ktc_runtime / KTC_DATABASE_URL | Member of ktc_app; project data under row security |

Setup applies all nine original Prisma migrations, including the teammate username backfill and its following empty migration, then 001_schema.sql, 002_access_and_workflows.sql, and 003_application_bridge.sql. The third migration retains UI priority and adds the bridge. Supplied SQL 001/002 is unchanged.

ADMIN maps to administrator; INSPECTOR, CONTRACTOR, and REVIEWER map to the corresponding lower-case database roles. API COMPLETED maps to database closed. Database rules enforce the open → in progress → ready for review → closed workflow and role restrictions.

Coordinates use the unrotated CropBox: x increases rightward and y downward, each in [0,1]. The viewer transforms them for 0/90/180/270-degree page rotation. Edits cannot alter drawing, page, or anchor.

## What has been merged

The application and database design packages have been integrated and tested against a new isolated local PostgreSQL database. No remote database was accessed. No populated team database dump was supplied, so no existing project records were converted.

Original public Project, Drawing, PunchItem, ProjectMember, comment, and photo tables remain intact but are no longer read by the new project APIs. Switching a populated database without an import would make its old projects absent from the new project list. Preserving tables is not completed data migration.

## Before using an existing team database

1. Verify a database backup and a matching copy of uploaded files. Start with a staging restore.
2. Inspect migration history and run database/legacy_preflight.sql read-only against the restore. Legacy project rows require an explicit import before switching applications.
3. Preserve account tables. Map accounts to KTC UUIDs and old project/drawing/member/item IDs to new UUIDs in durable mapping tables.
4. Parse every original PDF, save actual page metadata and hashes, and copy original bytes to project-scoped storage.
5. Resolve incomplete legacy items. Missing drawings/pages, blank descriptions, invalid coordinates, and cross-project references cannot be silently discarded or assigned invented locations.
6. Map roles/statuses explicitly. The compatibility API maps generic MEMBER to INSPECTOR; confirm imported members' intended permissions. Preserve comments/photos and attribute authors only with evidence.
7. Apply migrations and least-privilege grants in staging. Configure separate auth/application connections, a new secret, and the intended origin. Never connect the API as owner.
8. Compare counts, hashes, roles, and sampled anchors; run access/workflow/concurrency tests. Rehearse restoring database and files before a cutover.

scripts/setup.mjs intentionally targets the isolated demo and is not a production migration command. A populated legacy-data importer is outside this package because the required source database and files were not supplied.
