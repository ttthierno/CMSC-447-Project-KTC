# KonTraCk PostgreSQL and System Design

> Original package notes retained for reference. Relative references below describe the supplied KTC_Database_and_System_Design archive, including documents and diagrams that are not duplicated in this source repository. For the integrated application's startup and current implementation scope, use the root README and DATABASE-INTEGRATION.md. Sample exports and original validation records below are design-package fixtures, not exports or new test runs produced by this application.

This package implements the PostgreSQL persistence layer for the KTC Punch List Documentation System, based on the supplied SRS version 1.0, Sprint 1 presentation and original ERD. The System Design Document follows the supplied CMSC 447 template.

## Contents

- `KTC_System_Design_Document.docx`: completed design, ten embedded draw.io diagrams, all 108 database fields, all 44 functional requirements, and the course appendices.
- `database/001_schema.sql`: 12 tables, keys, indexes, data types, geometry validation and PDF page constraints.
- `database/002_access_and_workflows.sql`: runtime roles, row security, permissions, workflow, audit history and export functions.
- `database/comments.sql`: database table and column descriptions.
- `database/compose.yaml`: PostgreSQL 17 development deployment with persistent storage.
- `database/seed_demo.sql`: optional synthetic fixture, with its actual sample assets under `database/examples/sample_export/assets/`.
- `database/tests/integration.sql`: 62 assertions, all fixtures rolled back.
- `database/examples/`: parameterized SQL, a Prisma transaction example, markup JSON and a portable sample export.
- `database/data_dictionary.json` and `requirements_traceability.json`: machine-readable design references.
- `diagrams/`: ten individual `.drawio` sources, matching PNG exports and a combined ten-page `.drawio` file.

The original source documents are unchanged. The `Sample and Requirements` folder was empty; the SDD template and example in the main KTC folder supplied the document requirements. Signatures, customer approval and individual contribution evidence remain for the team to complete. No contribution or approval is asserted on anyone's behalf.

## Start with Docker

Run from the `database` directory with Docker Desktop or another Docker engine running:

```powershell
Copy-Item .env.example .env
# Edit .env and replace the example password with a generated secret.
docker compose up -d
docker compose exec db psql -U ktc_owner -d ktc -c "TABLE ktc.schema_migration;"
```

The database listens on localhost port 55432 by default. Change `KTC_DB_PORT` if that port is occupied. The password in `.env.example` is a placeholder, and `.env` must not be committed. PostgreSQL's data remains in the named Docker volume. Initialization SQL runs only on a **new empty volume**; apply subsequent migrations explicitly without deleting the volume.

Apply optional comments and run the integration suite without passing passwords in command history:

```powershell
docker compose cp comments.sql db:/tmp/ktc-comments.sql
docker compose exec db psql -X -U ktc_owner -d ktc -v ON_ERROR_STOP=1 -f /tmp/ktc-comments.sql
docker compose cp tests/integration.sql db:/tmp/ktc-integration.sql
docker compose exec db psql -X -U ktc_owner -d ktc -v ON_ERROR_STOP=1 -f /tmp/ktc-integration.sql
```

Expect `passed_checks = 62` and `ROLLBACK`. Run tests in a development/test database using an owner permitted to `SET ROLE ktc_app` and `ktc_worker`.

## Install into an existing PostgreSQL server

Create a new empty database with a dedicated migration owner. Use PostgreSQL 17. A DBA must create the `ktc_app` and `ktc_worker` roles or allow the migration owner to create them. The roles are cluster-wide; use a dedicated cluster or coordinate role names with its administrator.

With `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` and a protected PostgreSQL password file configured, run:

```powershell
psql -X -v ON_ERROR_STOP=1 -f 001_schema.sql
psql -X -v ON_ERROR_STOP=1 -f 002_access_and_workflows.sql
psql -X -v ON_ERROR_STOP=1 -f comments.sql
psql -X -v ON_ERROR_STOP=1 -f tests/integration.sql
```

Each migration runs in one transaction. If migration 2 fails, correct the reported issue and rerun migration 2; do not rerun already committed migration 1. For a deployed database, use a new numbered migration for changes. The package does not contain a destructive reset script.

To load the optional demonstration fixture once:

```powershell
psql -X -v ON_ERROR_STOP=1 -f seed_demo.sql
```

The sample account is an identity mapping, not a working login or password. To view its assets through the application, upload the provided PDF and PNG to the exact `storage_ref` keys. The sample ZIP is a format example, not evidence of an implemented application worker.

## Connect the application securely

Create separate API and worker LOGIN roles, using independently generated passwords or the approved deployment authentication mechanism. Grant the API login `ktc_app`, and the worker login `ktc_worker`. Neither login may own the database tables, have superuser/BYPASSRLS privileges, or inherit the migration owner's privileges.

After verifying the user's external identity, a privileged provisioning path creates an `app_user` with its issuer and subject. The API login cannot provision accounts or grant itself `can_create_projects`. The operator grants project-creation permission to approved accounts; `ktc.create_project` then creates both a project and its initial administrator membership.

Every API transaction must set the verified account UUID with:

```sql
SELECT set_config('app.user_id', $1::text, true);
```

Use a bound parameter from the verified session, never an arbitrary request-supplied user ID. The `true` argument makes the setting transaction-local. The setting is a trusted backend context; anyone with direct access to the API database login can choose it. End users therefore must not receive SQL credentials. See `examples/prisma-transaction.ts` for the pooled-connection pattern.

Prisma introspection can generate models after SQL installation. Keep the SQL constraints, policies, grants and triggers under migration control. Do not replace this schema with an incomplete ORM-generated schema using `db push`.

## Important behavior

- Roles are administrator, inspector, contractor and reviewer. The SDD includes the complete permission matrix.
- A drawing upload commits its PDF metadata and every parsed page together. Uploaded drawing bytes and page metadata are immutable; a PDF revision gets a new drawing ID.
- Items use one-based page numbers and exact normalized CropBox coordinates. Their original page anchor is immutable.
- Item updates increment `version`. Include the previously read version in the update predicate and handle zero updated rows as a stale/inaccessible result.
- Assignments require an active account and active membership in the same project. Clear or reassign items before deactivating a member.
- Markups can target a drawing page directly or an item on that exact page.
- Runtime hard deletion is disabled. Archive projects and deactivate membership to preserve history.
- Export request and queue functions are implemented. The application worker still needs ZIP assembly, verified object I/O, crash recovery and authorized downloads.
- The database cannot validate the actual contents of a PDF/image or implement browser marker rendering. Those application responsibilities are specified in the SDD.

## Diagram index

| SDD figure | Editable file |
|---|---|
| 1 | `01_system_architecture.drawio` |
| 2 | `02_create_item_sequence.drawio` |
| 3 | `03_component_decomposition.drawio` |
| 4 | `04_implementation_classes.drawio` |
| 5 | `08_punch_item_workflow.drawio` |
| 6 | `05_access_and_drawing_schema.drawio` |
| 7 | `06_punch_item_and_evidence_schema.drawio` |
| 8 | `07_markup_and_export_schema.drawio` |
| 9 | `09_persistent_file_structure.drawio` |
| 10 | `10_export_sequence.drawio` |

Open individual files or `KTC_System_Design_All_Diagrams.drawio` in draw.io. Diagrams are editable native shapes and connectors. The PNGs were exported by draw.io and are the same drawings embedded in the SDD.

## Validation

Validated on PostgreSQL 17.9: 62 integration assertions, two concurrent-session checks, optional seed execution, custom-format backup restoration and persistence after a server restart. The Word document was rendered and visually reviewed. Detailed results are in `database/tests/validation.txt`.

The local validation database was shut down cleanly. This package does not provision UMBC AWS or leave a production database running. Configure production identity, storage, upload limits, TLS, backups and recovery objectives as described in the SDD.
