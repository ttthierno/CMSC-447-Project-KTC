# KonTraCk: Windows + WSL merge guide

Prepared 27 October 2026. Use this guide and the NEW `KonTrack_Sprint2_Merged_Integration.patch`. The earlier patch targets an older frontend and is superseded.

## What is ready

The supplied teammate ZIP matches all 128 tracked files at GitHub commit `f5c93775417f69ec148f0ba32633fbd978312b66`, allowing for Windows line endings. The local merge uses that commit as its base, preserves the teammate's theme and username features, and adds the Sprint 2 database/workflow integration. Nothing has been pushed or merged on GitHub.

The source ZIP is a complete, runnable snapshot for inspection. The patch is the recommended way to add the changes to the real repository while retaining its history. Do not upload the extracted ZIP over the repository and do not apply both the old and new patches.

## 1. Prerequisite subset: open a normal Ubuntu WSL session

On Windows, right-click Start and open Terminal or PowerShell. Run these commands in **PowerShell**, not Ubuntu:

```powershell
wsl --list --verbose
```

On this computer, the check showed only `docker-desktop`. That is Docker's internal environment, not the Ubuntu development session used below. If Ubuntu-24.04 is already listed on another computer, skip installation and open it. Otherwise open PowerShell as Administrator and run:

```powershell
wsl --install -d Ubuntu-24.04
```

Restart Windows if requested. Launch Ubuntu-24.04 from Start, finish its first-run setup, and create a normal Linux username/password. Password entry in Linux does not display characters. Then open it from a normal PowerShell window:

```powershell
wsl -d Ubuntu-24.04
```

If your existing distribution is named `Ubuntu`, substitute that exact name. All commands from step 2 onward run inside **Ubuntu Bash**, unless explicitly marked otherwise. Run `whoami`; it must show your normal user, not root. Do not run the application with sudo. No GitHub Desktop, Windows Git installation, Docker service, or separate PostgreSQL installation is required for this demo.

## 2. Prerequisite subset: install Git, Node.js and GitHub CLI

In **Ubuntu Bash**:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential unzip gh
git --version
gh --version
```

If Ubuntu cannot locate `gh`, follow the official GitHub CLI Linux installation page linked at the end, then return here. Install Node through nvm inside Ubuntu; a Windows Node installation does not replace this step:

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh \
  -o /tmp/ktc-nvm-install.sh
bash /tmp/ktc-nvm-install.sh
source ~/.bashrc
command -v nvm
nvm install 24
nvm alias default 24
nvm use 24
npm install --global npm@10.9.2
node --version
npm --version
```

Expected: Node v24.x and npm 10.9.2. These tools run under your Linux user; do not prefix npm with sudo. Node 24 is also recorded in the repository's `.nvmrc`. Internet access is needed for these installations and the initial project dependency installation.

## 3. Prerequisite subset: authenticate and identify your commits

Replace the name and email below with your own Git identity. Use the verified email or GitHub noreply address shown in your GitHub account settings.

```bash
git config --global user.name "Your Name"
git config --global user.email "YOUR_GITHUB_COMMIT_EMAIL"
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status
```

Follow the one-time code and browser URL printed by GitHub CLI. If the browser does not open from WSL, open that URL in your Windows browser and enter the code there. Authenticate as an account with access to `ttthierno/CMSC-447-Project-KTC`. Do not paste a password or token into a Git command. GitHub CLI is a terminal tool; GitHub Desktop is not needed.

## 4. Clone a separate review copy and select the tested base

Use Linux's own filesystem under `~/src`, not OneDrive or `/mnt/c`, for the working repository and PostgreSQL data. The Windows patch file can still be read through `/mnt/c`.

```bash
mkdir -p ~/src
cd ~/src
git clone -c core.autocrlf=false \
  https://github.com/ttthierno/CMSC-447-Project-KTC.git KTC-Sprint2-review
cd KTC-Sprint2-review
git fetch origin
git switch -c sprint2-database-integration \
  f5c93775417f69ec148f0ba32633fbd978312b66
git status --short
git rev-parse HEAD
```

Expected: no short-status output and the exact commit above. This branch starts from the teammate version that was actually checked. Step 8 incorporates any further pushes before your PR. If the folder or branch already exists, use a fresh name instead of overwriting it. Keep any unrelated uncommitted work in the original checkout.

## 5. Apply the new patch

These paths are for the current Windows account and supplied output folder. If you downloaded the files elsewhere, change `PATCH_DIR` to that folder's WSL path. Quote the path if it contains spaces.

```bash
PATCH_DIR='/mnt/c/Users/chase/Documents/Codex/2026-10-26/usi/outputs'
PATCH="$PATCH_DIR/KonTrack_Sprint2_Merged_Integration.patch"
ls -l "$PATCH"
git apply --check "$PATCH"
git apply --index "$PATCH"
git diff --cached --check
git diff --cached --stat
git status --short
```

Run one command at a time and stop if a command fails. `git apply --check` should print nothing. The actual apply stages the supplied additions and modifications; it does not make a commit. Review the staged changes with `git diff --cached` (press q to leave the pager).

If the check fails, confirm that HEAD is the tested base, the working tree was clean before applying, and you selected the new patch. Do not use a force overwrite, `--reject`, or the old patch as a workaround. On the tested base, a second application is unnecessary and should fail because the changes are already present.

## 6. Install and run the merged application

Stay in the repository root in **Ubuntu Bash**:

```bash
nvm use
npm ci
npm ci --prefix server
npm ci --prefix frontend
npm run setup
npm run build
npm run demo
```

Keep this terminal running. Open `http://localhost:5173` in your Windows browser. Sign in with `admin@kontrack.demo` and the synthetic demo password `KonTrack-Demo-2026!`. The username displayed for a fresh administrator is `demo_admin`.

Setup creates an isolated PostgreSQL 17.10 database, applies nine Prisma migrations including the teammate's username migrations, applies the three KTC SQL migrations, and seeds Example project. It does not connect to or import your team's existing database. No extra database server is required.

Ports: PostgreSQL 55437, API 3000, frontend 5173. Stop any earlier KonTraCk demo before starting this one. On the current Windows machine the older demo was stopped for verification; its source, saved database and uploads were left intact. Copying this package to WSL starts a separate fresh demo.

## 7. Verify before committing

Open a second Windows Terminal tab, start the same Ubuntu distribution, and run:

```bash
cd ~/src/KTC-Sprint2-review
nvm use
npm test
npm run test:database
npm --prefix frontend run lint
git diff --cached --check
```

Expected: 24 passing Node test results and 62 passing database checks. Lint currently has two warnings and no errors. The Node total includes 20 API subtests, their parent result, one geometry test and two merge-compatibility tests. The migration test uses a temporary schema inside a rolled-back transaction; username tests use disposable synthetic accounts.

In the browser, confirm these steps:

- Projects -> Example project -> Plans. Confirm the teammate's dark/gold theme, Ranade font, header, and collapsible sidebar.
- Open both PDF pages; page 2 is rotated. Try zoom, Fit, Pan, and sidebar collapse/expand.
- Select Place punch item, click the PDF, enter a title and description, and create the item.
- Edit the description and Save item. Confirm the version increases. Open View saved marker on drawing; reload and confirm the same page and location.
- Open Settings. Confirm username/name display, Edit Profile, and Log Out remain available. The automated tests cover profile updates and username uniqueness.
- In terminal 1, press Ctrl+C. Run `npm run setup` again with the demo stopped, then `npm run demo`. Reopen your item and confirm its saved values survive the restart.

Automated and browser verification were performed on Windows x64, Node 24.19.0 and npm 10.9.2. Ubuntu/WSL execution has not been tested on this machine because no Ubuntu distribution was installed. Run the checks above in your WSL session before merging.

## 8. Commit locally, then incorporate any newer teammate push

In terminal 2, from the repository root:

```bash
git diff --cached --name-only
git status --short
git commit -m "Integrate Sprint 2 database while preserving teammate frontend"
git fetch origin
git merge origin/master
```

The commit must contain source, migrations, fixtures, tests and documentation. It must not contain `.local`, `server/.env`, `server/storage`, `node_modules`, or build output. Those paths are ignored by the package. Do not add them with `git add -f`.

If master still ends at the tested teammate commit, Git reports Already up to date. If master advanced, Git merges those later commits into your feature branch. Review that result and repeat setup/build/tests/browser checks before pushing. If dependencies changed, stop the demo and rerun the three `npm ci` commands first.

If Git reports conflicts:

```bash
git status
git diff --name-only --diff-filter=U
nano path/to/conflicted-file
```

For each listed file, remove the conflict markers and combine the required changes. Preserve the newest teammate UI; retain username plugins/migrations and the KTC authentication, UUID, file-access and version checks. Do not choose an entire ours/theirs tree blindly. Save in nano with Ctrl+O, Enter, then exit with Ctrl+X. Stage only each file you resolved:

```bash
git add path/to/conflicted-file
git diff --name-only --diff-filter=U
git diff --cached --check
git commit
```

The unresolved-file command must print nothing before the commit. A Git editor may open for the merge message; save and close it. If you need to stop this later merge without losing the already committed integration, use `git merge --abort`. After resolving, rerun setup with the demo stopped, build, restart, and repeat step 7. A conflict resolution is not verified merely because Git accepted it.

## 9. Push a feature branch and review the PR in your Windows browser

After all checks pass:

```bash
git status --short
git push -u origin sprint2-database-integration
gh pr create --base master --head sprint2-database-integration \
  --title "Integrate Sprint 2 database and preserve teammate frontend" \
  --body-file docs/PR-DESCRIPTION.md
```

If you used a different feature-branch name, substitute it in both commands. These commands publish the branch and create a PR; they do not merge master. Open the PR URL printed by GitHub CLI in your Windows browser. Confirm base is master and compare is your feature branch. Inspect Files changed, check that the teammate's CSS/font files and username migrations are retained, and have the team review the workflow and data-migration boundary.

When your team is ready and required checks/reviews are satisfied, use GitHub's permitted Merge pull request or Squash and merge button, then confirm. If the button is unavailable, follow the repository's required checks/reviews. Do not force-push master to bypass them.

If you lack write permission, create a fork through GitHub's browser UI, push the feature branch to that fork, and open a PR with base repository `ttthierno/CMSC-447-Project-KTC`, base master. The owner or an authorized maintainer performs the final merge.

## 10. Update the local master after GitHub merges

Stop the demo with Ctrl+C before switching branches. Ensure your working tree is clean, then run:

```bash
git switch master
git pull --ff-only origin master
nvm use
npm ci
npm ci --prefix server
npm ci --prefix frontend
npm run setup
npm run build
npm run demo
```

Keep the feature branch until the team has verified the merged result. If a PR must be undone later, use a reviewed revert commit/PR. A code revert does not undo database migrations or restore uploaded files.

## Existing data and recovery

The new business APIs read the `ktc` schema. Existing integer-ID projects in the original public tables remain stored but are not automatically shown by these APIs. No populated team database or uploaded-file collection was supplied, so no legacy project-data import has been completed. This package is ready for a fresh classroom demo; a populated team database needs a separate staged import and reconciliation before cutover. See `docs/DATABASE-INTEGRATION.md`.

Keep database and uploaded files together when making backups. Keep the earlier demo folder intact until you have confirmed the new one. Do not copy raw Windows PostgreSQL data directories into WSL; use a logical PostgreSQL dump/restore and copy uploads if moving real data between platforms. Never run `prisma migrate reset` to resolve a migration conflict on a database you want to preserve.

Before the first commit, the patch can be reversed only if its files have not been edited since applying it:

```bash
git apply --reverse --check "$PATCH"
git apply --reverse --index "$PATCH"
```

If that check fails, preserve the current work and investigate; do not overwrite files to force a reversal. Reversing source changes does not remove or restore local database/storage contents.

## Troubleshooting

- Port already used: stop the earlier demo with Ctrl+C. Do not delete `.local`. With the demo stopped, `KTC_DB_VERBOSE=true npm run setup` prints PostgreSQL startup diagnostics.
- PostgreSQL refuses root: use your normal Ubuntu user and rerun without sudo. Keep the repository under `~/src` so Linux permissions work normally.
- Missing PostgreSQL binary: repeat root `npm ci` with normal scripts and optional dependencies enabled. Do not copy Windows `node_modules` into WSL or install with `--ignore-scripts`/`--omit=optional`.
- Missing Prisma client: rerun `npm run setup`; it generates the client before migrations/seeding. Keep the existing username migrations unchanged.
- Browser cannot connect: confirm terminal 1 still shows both services ready and use localhost rather than 0.0.0.0. WSL normally forwards localhost to Windows. Investigate local WSL forwarding/firewall settings if that connection still fails; do not expose the demo to the internet as a workaround.
- Login from a fresh setup: use the seeded email/password above. New signups require email verification; this local demo prints verification links in its server terminal and does not send real email.
- Existing accounts upgraded from the earlier demo receive `user_<integer ID>` usernames. The seed preserves them; it does not rename accounts on every setup.
- Expected non-blocking warnings: the teammate CSS contains a late duplicate font import, Vite reports the large PDF bundle, and lint reports two existing effect warnings. Server audit also reports three high-severity dependency entries from Prisma's deepmerge-ts chain. No untested major-version upgrade was included; review the audit before deployment.

## Official references

- [Microsoft: install a WSL distribution](https://learn.microsoft.com/en-us/windows/wsl/install)
- [Microsoft: keep Linux projects in the Linux filesystem](https://learn.microsoft.com/en-us/windows/wsl/interop)
- [nvm: installation and WSL support](https://github.com/nvm-sh/nvm)
- [Node.js downloads and release choices](https://nodejs.org/en/download)
- [GitHub CLI Linux installation](https://github.com/cli/cli/blob/trunk/docs/install_linux.md)
- [GitHub CLI authentication](https://cli.github.com/manual/gh_auth_login)
- [GitHub: authenticating Git with gh](https://docs.github.com/en/github-cli/github-cli/authenticating-with-github-cli)
- [Git: apply and check a patch](https://git-scm.com/docs/git-apply)
- [GitHub: create a pull request](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request)
