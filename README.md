# KonTraCk - Sprint 2

This version connects the existing React / Express application to the supplied KTC PostgreSQL design. The working Sprint 2 path is: sign in, open a project, upload and view a PDF, place an item, edit its description, and restore its saved location after reload, zoom, and layout changes.

## Start on Windows or Ubuntu WSL

Use Node.js 24 and npm 10.9.2. The verified environment used Windows x64 and Node 24.19. Internet access is needed for the first dependency installation. Docker and a separately installed PostgreSQL server are not required.

From the repository root:

```bash
npm ci
npm ci --prefix server
npm ci --prefix frontend
npm run setup
npm run build
npm run demo
```

Open **http://localhost:5173**. Keep the terminal open. Press Ctrl+C to stop the demo. Later runs only need `npm run demo`; run `npm run build` after changing server code. The frontend updates automatically during a demo run.

Use npm 10 for this verified workflow (`npx --yes npm@10.9.2 ci`, adding `--prefix server` or `--prefix frontend` for those directories). Do not install with `--ignore-scripts`: Prisma and the bundled PostgreSQL distribution need their normal setup steps.

With dependencies installed, direct equivalents are `node scripts/setup.mjs`, `node scripts/demo.mjs`, `node scripts/build.mjs`, and `node scripts/test.mjs`.

## Demo accounts

Fresh accounts have usernames demo_admin, demo_inspector, demo_contractor, demo_reviewer and demo_outsider. Existing upgraded accounts retain migration-generated usernames such as user_1.

All accounts below are synthetic and use **KonTrack-Demo-2026!**. They are created only by the local demo seed.

| Email | Role in Example project | Demonstration |
|---|---|---|
| admin@kontrack.demo | Administrator | Create projects, upload drawings, manage members, edit items |
| inspector@kontrack.demo | Inspector | Create and edit anchored items |
| contractor@kontrack.demo | Contractor | Work on assigned items and submit evidence |
| reviewer@kontrack.demo | Reviewer | Read project content |
| outsider@kontrack.demo | No membership | Verify that unrelated projects are unavailable |

The seeded project includes a two-page synthetic PDF, with a 90-degree rotation on page 2, and a saved example item on page 1. Use **Plans → Place punch item**, then select a location on the drawing. The form requires a title and description. **View saved marker on drawing** returns to its original page.

## Data and ports

- PostgreSQL: `127.0.0.1:55437`, database `ktc_demo`; API: port 3000; frontend: port 5173. All listeners are local to this computer.
- `.local/postgres/` holds the persistent database. `.local/database.json` holds randomly generated local credentials.
- `server/.env` is generated on first setup. `server/storage/` holds original PDFs and photos.
- These runtime folders, credentials, and build outputs are excluded from Git. Preserve database and file storage together when backing up a demo.
- Setup can be repeated with the demo stopped. It applies missing migrations without duplicating the seeded project/accounts or resetting edited content.
- Start only one copy at a time. Resolve a port conflict by stopping the other demo, not by deleting database files.

## Verify

With `npm run demo` running in one terminal, use a second terminal:

```bash
npm run build
npm test
npm run test:database
npm --prefix frontend run lint
```

API tests create an isolated test project and clean it up. Merge compatibility tests also check username migration, signup, uniqueness, profile changes and username login. The supplied database suite runs inside a rolled-back transaction. Both target this local demo only.



