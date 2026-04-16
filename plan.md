# Plan: Extend `create-php-starter` into a Unified PHP Scaffolding CLI (v2.0.0)

## Clarifications

### Does the package name change?
**No.** `create-php-starter` still fits because both modes are PHP-based. Version bumps to `2.0.0`,
same npm package, no rename needed. The install command stays:
```bash
npm install -g create-php-starter
# or via npx (works immediately once published):
npx create-php-starter my-app
```

### What is the distinction between the two modes?

| | Custom PHP mode (existing) | Laravel mode (new) |
|---|---|---|
| **What it is** | Raw PHP, no framework — you build the structure | Framework-based — Laravel does routing, ORM, middleware |
| **Best for** | Lightweight sites, custom APIs, learning projects | Production apps, SaaS, larger REST APIs |
| **Entry point** | `index.php` or a hand-rolled router | `artisan` + Laravel's service container |
| **Dependencies** | PHPMailer (optional) | Composer + Laravel ecosystem packages |
| **DB layer** | Raw PDO / custom config | Eloquent ORM |
| **Frontend** | Vanilla JS, optional CDN libraries | React (Vite standalone or Inertia) |

They are two different paradigms. The CLI asks which world you want **first**, then branches.

---

## Current State

`create-php-starter` v1.1.2 already is a CLI. It has:
- `bin` entry in `package.json`
- `inquirer` for interactive prompts
- `chalk` + `ora` for output
- `shelljs` for shell commands
- Full scaffold engine (Vanilla / MVC / API with auth, admin, PHPMailer, database, Phosphor Icons)

---

## How the Tool Works After the Upgrade

### Entry Point — Mode Selection

The very first question after launch is the mode gate:

```
? What kind of project are you scaffolding?
  ❯ Custom PHP  — Vanilla / MVC / API (raw PHP, no framework)
    Laravel     — Framework-based app with optional React frontend
```

- **Custom PHP** → existing prompt flow, completely unchanged
- **Laravel** → new Laravel prompt flow (stack, DB, frontend, auth, packages)

Both modes share the same service layer (EnvConfigurator, GitInitializer, PackageInstaller).

---

### Flag-Based Invocation

```
create-php-starter <project-name> [options]

Core:
  --mode      php | laravel                                     (default: prompts)
  --stack     vanilla | mvc | api          [php mode]           (default: prompts)
              api | web | full | minimal    [laravel mode]       (default: api)
  --frontend  none | react-vite | inertia  [laravel mode only]  (default: none)
  --auth      sanctum | passport | none    [laravel mode]       (default: sanctum)
              yes | no                     [php mode]           (default: prompts)
  --db        mysql | pgsql | mongodb | sqlite                  (default: mysql)

Extras:
  --docker    Include Docker setup (docker-compose.yml, Dockerfile)
  --ci        Include GitHub Actions CI/CD workflow
  --testing   Include testing setup (Pest for Laravel, PHPUnit for PHP, Vitest for React)
  --ts        Use TypeScript for React frontend (react-ts Vite template)
  --preset    Name of a saved preset from ~/.webstarterrc.json

Meta:
  --no-git    Skip git initialization
  --yes       Accept all defaults, skip all prompts
  --dry-run   Show what would be created without writing anything
  --verbose   Print every shell command as it runs
  --version   Print version and exit
  --help      Print usage and exit
```

Examples:
```bash
# Fully interactive — one new question at the top, then existing flow
create-php-starter

# Laravel API + PostgreSQL + Sanctum
create-php-starter my-app --mode=laravel --stack=api --db=pgsql --auth=sanctum

# Laravel full-stack + React (Inertia) + TypeScript + Docker + CI
create-php-starter my-app --mode=laravel --stack=full --frontend=inertia --ts --docker --ci

# Laravel SPA backend + React Vite (TS) + MongoDB + Pest testing
create-php-starter my-app --mode=laravel --frontend=react-vite --db=mongodb --ts --testing

# Custom PHP MVC — identical to v1 behavior
create-php-starter my-app --mode=php --stack=mvc --db=mysql

# Dry run — see exactly what would be created, nothing written to disk
create-php-starter my-app --mode=laravel --stack=api --dry-run

# Saved personal preset — zero prompts, zero flags
create-php-starter my-app --preset=my-api

# Add a feature to an existing project
create-php-starter add sanctum
create-php-starter add docker
create-php-starter add github-actions
```

---

## Database Support — All Modes

| Driver | Flag | PHP mode | Laravel mode |
|--------|------|----------|--------------|
| MySQL | `mysql` | PDO config written | `DB_CONNECTION=mysql` in .env |
| PostgreSQL | `pgsql` | PDO config written | `DB_CONNECTION=pgsql` in .env |
| MongoDB | `mongodb` | `config/mongodb.php` helper written | `jenssegers/mongodb` installed |
| SQLite | `sqlite` | PDO config written | `DB_CONNECTION=sqlite`, creates `database/database.sqlite` |

Port defaults: MySQL → 3306, PostgreSQL → 5432, MongoDB → 27017, SQLite → no port.

---

## React Frontend Support (Laravel Mode Only)

**`react-vite`** — Decoupled SPA, Laravel is a pure API
- Runs `npm create vite@latest frontend -- --template react` (or `react-ts` if `--ts`)
- Sets up `/frontend` directory alongside the Laravel project
- CORS configured via `config/cors.php`

**`inertia`** — Server-driven SPA, tightly coupled to Laravel
- Installs `inertiajs/inertia-laravel` and `tightenco/ziggy` via Composer
- Runs `npm install @inertiajs/react react react-dom` (adds TypeScript deps if `--ts`)
- Sets up `resources/js/app.jsx` (or `.tsx`) and `resources/views/app.blade.php`

**`none`** — API only, no frontend (default)

---

## New File Structure

```
create-php-starter/
├── index.js                              # Entry: mode gate → branch to php or laravel
├── src/
│   ├── args.js                           # NEW: parse CLI flags with minimist
│   ├── config.js                         # EXISTING: ~/.webstarterrc.json (unchanged)
│   ├── composer.js                       # EXISTING: PHPMailer installer (unchanged)
│   ├── docs.js                           # EXISTING: README/architecture generator (unchanged)
│   ├── icons.js                          # EXISTING: unchanged
│   ├── preflight.js                      # NEW: dependency checks before scaffolding
│   │
│   ├── php/                              # EXISTING logic, relocated here
│   │   ├── prompts.js                    # EXISTING prompts.js (moved, accepts flag defaults)
│   │   └── scaffold.js                   # EXISTING scaffold.js (moved, unchanged logic)
│   │
│   ├── laravel/                          # NEW: Laravel mode
│   │   ├── prompts.js                    # NEW: Laravel-specific prompt flow
│   │   └── scaffold.js                   # NEW: Laravel scaffold orchestrator
│   │
│   ├── services/                         # NEW: shared across both modes
│   │   ├── EnvConfigurator.js            # NEW: writes .env from stub with token replacement
│   │   ├── GitInitializer.js             # NEW: git init + first commit
│   │   ├── PackageInstaller.js           # NEW: composer require + npm install
│   │   ├── DockerGenerator.js            # NEW: writes docker-compose.yml + Dockerfile
│   │   ├── CiGenerator.js                # NEW: writes .github/workflows/ci.yml
│   │   ├── TestingSetup.js               # NEW: writes phpunit.xml / vitest.config.js + sample tests
│   │   ├── DryRunner.js                  # NEW: collects planned actions, prints, exits
│   │   └── SummaryPrinter.js             # NEW: structured end-of-run summary block
│   │
│   └── stubs/
│       ├── php/                          # EXISTING inline strings → extracted to files
│       │   ├── env.stub
│       │   ├── htaccess.stub
│       │   ├── index.stub
│       │   ├── database-mysql.stub
│       │   ├── database-pgsql.stub
│       │   ├── database-mongodb.stub
│       │   ├── database-sqlite.stub
│       │   ├── editorconfig.stub         # NEW: .editorconfig for all projects
│       │   └── vscode-extensions.stub    # NEW: .vscode/extensions.json
│       └── laravel/
│           ├── env.stub                  # NEW: Laravel .env template with tokens
│           ├── ApiResponse.stub          # NEW: App\Traits\ApiResponse
│           ├── BaseService.stub          # NEW: abstract BaseService
│           ├── BaseRepository.stub       # NEW: abstract BaseRepository
│           ├── BaseController.stub       # NEW: controller using ApiResponse trait
│           ├── FormRequest.stub          # NEW: App\Http\Requests\BaseRequest
│           ├── ExceptionHandler.stub     # NEW: JSON-first exception handler
│           ├── inertia-app.stub          # NEW: resources/js/app.jsx
│           ├── inertia-app-ts.stub       # NEW: resources/js/app.tsx (TypeScript)
│           ├── pint.stub                 # NEW: pint.json code style config
│           ├── docker-compose.stub       # NEW: docker-compose.yml (PHP-FPM + Nginx + DB)
│           ├── dockerfile.stub           # NEW: Dockerfile for Laravel
│           ├── ci-laravel.stub           # NEW: .github/workflows/ci.yml (Pest + Pint)
│           └── pest-healthcheck.stub     # NEW: tests/Feature/HealthCheckTest.php
├── package.json                          # name stays, bump to v2.0.0
└── README.md
```

---

## Tier 1 — Robustness (What Breaks First Without These)

### Pre-flight Dependency Checks (`src/preflight.js`)

Runs before any scaffolding. Checks that required tools are installed and exits with a clear
message if not:

```js
'use strict';
const shell = require('shelljs');
const chalk = require('chalk');

const CHECKS = {
  php:      { cmd: 'php --version',      label: 'PHP',      url: 'https://www.php.net/downloads' },
  composer: { cmd: 'composer --version', label: 'Composer', url: 'https://getcomposer.org'       },
  git:      { cmd: 'git --version',      label: 'Git',      url: 'https://git-scm.com'           },
  node:     { cmd: 'node --version',     label: 'Node.js',  url: 'https://nodejs.org'            },
};

function run(required = ['php', 'composer', 'git']) {
  const missing = [];
  for (const key of required) {
    if (!shell.which(CHECKS[key].cmd.split(' ')[0])) {
      missing.push(CHECKS[key]);
    }
  }
  if (missing.length === 0) return;

  console.error(chalk.red.bold('\n✖  Missing required dependencies:\n'));
  for (const dep of missing) {
    console.error(chalk.red(`   ${dep.label}: ${dep.url}`));
  }
  process.exit(1);
}

module.exports = { run };
```

### Project Name Collision Detection

Before scaffolding, check if the target folder already exists:

```js
if (fs.existsSync(projectName)) {
  const { action } = await inquirer.prompt([{
    name: 'action', type: 'list',
    message: `A folder named "${projectName}" already exists. What do you want to do?`,
    choices: ['Overwrite it', 'Pick a different name', 'Cancel']
  }]);
  if (action === 'Cancel') process.exit(0);
  if (action === 'Overwrite it') shell.rm('-rf', projectName);
  if (action === 'Pick a different name') { /* re-prompt project name */ }
}
```

### Rollback on Failure

Wrap the entire scaffold in try/catch. On any error, delete the partial project and show what failed:

```js
try {
  await createLaravelProject(config, cli);
} catch (err) {
  console.error(chalk.red(`\n✖  Scaffold failed at: ${err.step}`));
  console.error(chalk.dim(`   ${err.message}`));
  if (fs.existsSync(config.projectName)) {
    shell.rm('-rf', config.projectName);
    console.error(chalk.dim('   Partial project cleaned up.'));
  }
  process.exit(1);
}
```

### Shell Exit Code Checking

Every `shell.exec()` call must check its return code and throw on failure:

```js
function exec(cmd, step) {
  const result = shell.exec(cmd, { silent: !verbose });
  if (result.code !== 0) {
    throw Object.assign(new Error(result.stderr || 'Command failed'), { step });
  }
  return result;
}
```

---

## Tier 2 — DX (What Every Serious CLI Has)

### `--version` and `--help`

```bash
create-php-starter --version   # → 2.0.0
create-php-starter --help      # → full flag reference
```

Implemented by reading `version` from `package.json` and printing the flag table.

### `--dry-run` Mode (`src/services/DryRunner.js`)

Each service registers its planned actions instead of executing them. On dry-run, print the plan
and exit — nothing is written to disk:

```bash
create-php-starter my-app --mode=laravel --stack=api --db=pgsql --dry-run
```
```
[dry-run] Would run:    composer create-project laravel/laravel my-app
[dry-run] Would install: laravel/sanctum, darkaonline/l5-swagger, spatie/laravel-data
[dry-run] Would create:  app/Services/, app/Repositories/, app/Traits/, app/Enums/
[dry-run] Would write:   app/Traits/ApiResponse.php, app/Services/BaseService.php
[dry-run] Would write:   .env  (pgsql, port 5432, db: my-app)
[dry-run] Would run:    git init + initial commit

Nothing was written to disk.
```

### `--verbose` Mode

When passed, `shell.exec()` runs without `{ silent: true }` — every command prints to stdout.
Invaluable for debugging failed scaffolds.

### Update Notifier

Uses the `update-notifier` npm package. Checks for newer versions in the background on each run.
If a newer version exists, prints at the very end of output:

```
  Update available: 2.0.0 → 2.1.0
  Run npm install -g create-php-starter to update.
```

```bash
npm install update-notifier
```

### Structured Summary Block (`src/services/SummaryPrinter.js`)

Replaces the single `chalk.green` line with a full summary printed after every scaffold:

```
 ┌─────────────────────────────────────────┐
 │   my-app scaffolded successfully        │
 ├─────────────────────────────────────────┤
 │  Mode      Laravel                      │
 │  Stack     API                          │
 │  Auth      Sanctum                      │
 │  Database  PostgreSQL (port 5432)       │
 │  Frontend  React + Inertia (TypeScript) │
 │  Docker    Yes                          │
 │  CI        GitHub Actions               │
 │  Git       Initialized, first commit    │
 ├─────────────────────────────────────────┤
 │  Next steps:                            │
 │    cd my-app                            │
 │    cp .env.example .env                 │
 │    php artisan key:generate             │
 │    php artisan migrate                  │
 │    npm install && npm run dev           │
 │    php artisan serve                    │
 └─────────────────────────────────────────┘
```

### Named Presets (saved to `~/.webstarterrc.json`)

The config file already saves `authorName`. Extend it to save named presets:

```json
{
  "authorName": "Michael Mgbah",
  "presets": {
    "my-api": {
      "mode": "laravel", "stack": "api", "db": "pgsql",
      "auth": "sanctum", "docker": true, "ci": true, "testing": true
    },
    "quick-php": {
      "mode": "php", "stack": "mvc", "db": "mysql"
    }
  }
}
```

Save a preset after any scaffold run:
```
? Save these settings as a preset for next time? (y/N)
? Preset name: my-api
✔  Saved to ~/.webstarterrc.json
```

Use it instantly on any machine:
```bash
create-php-starter my-app --preset=my-api
```

---

## Tier 3 — Feature Additions (Production-Quality Output)

### Docker Support (`--docker`)

Generates `docker-compose.yml` + `Dockerfile` for the project.

Laravel docker-compose includes: PHP-FPM service, Nginx service, DB service (MySQL/Postgres/Mongo
based on `--db`), and volume mounts for the project.

Custom PHP docker-compose includes: Apache/Nginx + PHP service + DB service.

```bash
create-php-starter my-app --mode=laravel --docker
# docker-compose up -d  → full stack running immediately
```

### GitHub Actions CI/CD (`--ci`)

Generates `.github/workflows/ci.yml` tailored to the chosen stack:

- **Laravel**: runs Pest tests + Laravel Pint linting on every push/PR
- **Custom PHP**: runs PHPUnit + PHP-CS-Fixer check
- **React frontend**: runs ESLint + Vitest (added as a separate job)

### Testing Setup (`--testing`)

| Mode | What gets installed/written |
|------|-----------------------------|
| Laravel | Installs **Pest**, writes `tests/Feature/HealthCheckTest.php`, `phpunit.xml` tweaks |
| Custom PHP | Writes `phpunit.xml`, `tests/ExampleTest.php` |
| React (Vite) | Writes `vitest.config.js`, `src/__tests__/App.test.jsx` sample |
| React (TypeScript) | Same as above with `.tsx` extensions + type imports |

Pest is the modern Laravel testing framework — it's what production Laravel projects use over
plain PHPUnit. Including it signals awareness of the current ecosystem.

### TypeScript for React (`--ts`)

When `--frontend=react-vite` or `--frontend=inertia` is combined with `--ts`:
- Vite: uses `--template react-ts`
- Inertia: installs TypeScript deps, writes `app.tsx`, `tsconfig.json`, `vite.config.ts`
- ESLint + Prettier configs are TypeScript-aware

### `.editorconfig` (Always Generated)

Written automatically for every project regardless of mode. Standardizes indentation and line
endings across editors/contributors. One file, zero effort, signals professional habits:

```ini
root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.{js,jsx,ts,tsx,json,css}]
indent_size = 2
```

### VS Code Workspace File (Always Generated)

Writes `.vscode/extensions.json` recommending the right extensions for the chosen stack:

- PHP mode: PHP Intelephense, PHP CS Fixer, GitLens
- Laravel mode: same + Laravel Artisan, Laravel Blade Snippets
- React: ESLint, Prettier, ES7 React Snippets
- TypeScript: TypeScript Hero

### Laravel Pint Config (Laravel Mode, Always)

Generates `pint.json` with configured rules. Laravel Pint ships with Laravel 10+ but needs a
config file to match your code style preferences. Auto-generated so the project is style-consistent
from commit one.

### Laravel Additional Stubs (Laravel Mode)

Beyond ApiResponse + BaseService + BaseRepository + BaseController already planned:

| Stub | What it provides |
|------|-----------------|
| `BaseRequest.stub` | `App\Http\Requests\BaseRequest` — consistent validation failure format |
| `ExceptionHandler.stub` | Custom `Handler.php` that returns JSON errors matching ApiResponse format |
| `HealthCheckTest.stub` | `tests/Feature/HealthCheckTest.php` — Pest test that hits `/api/health` |

These three together mean the project has consistent error formatting, consistent request validation
responses, and at least one passing test on day one.

---

## Tier 4 — The Big Architectural Ideas

### The `add` Subcommand

Run inside an existing project to retroactively add features. Uses the same service classes as
the initial scaffold — no duplication:

```bash
cd my-existing-laravel-app
create-php-starter add sanctum       # installs + publishes + writes stubs
create-php-starter add telescope     # installs + publishes
create-php-starter add docker        # generates docker-compose.yml + Dockerfile
create-php-starter add github-actions # generates .github/workflows/ci.yml
create-php-starter add pest          # installs Pest, converts existing tests
```

Each `add` command is a small module in `src/addons/`:

```
src/
└── addons/
    ├── sanctum.js
    ├── telescope.js
    ├── docker.js
    ├── github-actions.js
    └── pest.js
```

The `index.js` entry point checks if the first argument is `add` and routes to the addon runner
instead of the scaffold flow. The addon runner detects whether it's inside a Laravel project or
Custom PHP project and runs the right logic.

This transforms the tool from a one-shot scaffolder into a development companion.

### Plugin / Custom Stack Definitions

Instead of stacks being hardcoded in `PackageInstaller.js`, stacks are JSON files loaded at
runtime. The tool ships with built-in stacks, but developers can define their own in
`~/.create-php-starter/stacks/`:

```json
// ~/.create-php-starter/stacks/my-saas-api.json
{
  "name": "my-saas-api",
  "extends": "laravel-api",
  "description": "My personal SaaS API stack",
  "packages": [
    "spatie/laravel-permission",
    "barryvdh/laravel-ide-helper",
    "spatie/laravel-activitylog"
  ],
  "stubs": {
    "app/Traits/HasRoles.php": "~/.create-php-starter/stubs/HasRoles.stub"
  },
  "folders": ["app/Policies", "app/Observers"]
}
```

At startup, `PackageInstaller` merges user-defined stacks with built-in ones. Custom stacks show
up in the prompt list automatically. Your exact personal setup, on any machine, without flags.

---

## Updated New Files Summary

| File | Purpose |
|------|---------|
| `src/args.js` | Flag parser (minimist) |
| `src/preflight.js` | Dependency checks (PHP, Composer, Git, Node) |
| `src/php/prompts.js` | Existing prompts.js, relocated + accepts flag defaults |
| `src/php/scaffold.js` | Existing scaffold.js, relocated |
| `src/laravel/prompts.js` | Laravel prompt flow |
| `src/laravel/scaffold.js` | Laravel scaffold orchestrator |
| `src/services/EnvConfigurator.js` | Writes .env from stub |
| `src/services/GitInitializer.js` | git init + first commit |
| `src/services/PackageInstaller.js` | composer require + npm install, multi-mode |
| `src/services/DockerGenerator.js` | docker-compose.yml + Dockerfile |
| `src/services/CiGenerator.js` | .github/workflows/ci.yml |
| `src/services/TestingSetup.js` | phpunit.xml / vitest.config.js + sample tests |
| `src/services/DryRunner.js` | Collects planned actions, prints, exits |
| `src/services/SummaryPrinter.js` | Structured end-of-run summary block |
| `src/addons/*.js` | `add` subcommand modules (sanctum, docker, etc.) |

---

## What Stays Completely Unchanged

- `src/config.js` — author name persistence (extended for presets, not rewritten)
- `src/composer.js` — PHPMailer installer
- `src/docs.js` — README / architecture doc generator
- All existing Custom PHP scaffold logic — moved to `src/php/`, not modified
- All existing `inquirer` prompts — moved to `src/php/prompts.js`, extended to accept defaults
- `chalk` + `ora` usage throughout

Existing users running `create-php-starter` with no flags see one new question at the top
("Custom PHP or Laravel?") and then the exact same flow as v1 if they pick Custom PHP.

---

## Build Order

### Phase 1 — Foundation (Day 1)
1. `npm install minimist update-notifier` — add dependencies
2. Write `src/args.js` — full flag parser including new flags
3. Write `src/preflight.js` — dependency checks
4. Move `src/prompts.js` → `src/php/prompts.js`, `src/scaffold.js` → `src/php/scaffold.js`
5. Extend `src/php/prompts.js` to accept `defaults` from parsed args
6. Update `index.js` — mode gate, pre-flight, `--version`, `--help`

### Phase 2 — Core Services (Day 1–2)
7. Extract inline template strings from `src/php/scaffold.js` into `src/stubs/php/*.stub`
8. Write `src/services/EnvConfigurator.js` — token replacement, multi-DB support
9. Write `src/services/GitInitializer.js` — git init + first commit
10. Write `src/services/PackageInstaller.js` — multi-mode, multi-DB composer require
11. Write `src/services/DryRunner.js` — dry-run plan collector
12. Write `src/services/SummaryPrinter.js` — end-of-run summary block

### Phase 3 — Laravel Mode (Day 2–3)
13. Write `src/stubs/laravel/*.stub` — all Laravel stubs
14. Write `src/laravel/prompts.js` — Laravel prompt flow
15. Write `src/laravel/scaffold.js` — Laravel scaffold orchestrator
16. Wire Laravel mode into `index.js`

### Phase 4 — Extra Features (Day 3–4)
17. Write `src/services/DockerGenerator.js` + docker stubs
18. Write `src/services/CiGenerator.js` + CI stubs
19. Write `src/services/TestingSetup.js` + test stubs
20. Add `.editorconfig` + `.vscode/extensions.json` to both scaffold paths
21. Add TypeScript (`--ts`) logic to React setup
22. Add rollback (try/catch + shell.rm) around both scaffold paths
23. Add named preset save/load to `src/config.js`

### Phase 5 — `add` Subcommand (Day 4–5)
24. Write `src/addons/sanctum.js`, `docker.js`, `github-actions.js`, `pest.js`
25. Add `add` routing to `index.js`

### Phase 6 — Polish & Publish
26. Bump `package.json` to `2.0.0`, update keywords + description
27. Test: `node index.js test-app` (interactive), `node index.js test-app --mode=laravel --dry-run`
28. `npm publish`

---

## Example Invocations (v2.0.0)

```bash
# Fully interactive — same as v1 with one extra question at the top
create-php-starter

# See what would be created — nothing written
create-php-starter my-app --mode=laravel --stack=api --db=pgsql --dry-run

# Laravel API, full production setup
create-php-starter my-app --mode=laravel --stack=api --db=pgsql --auth=sanctum --docker --ci --testing

# Laravel full-stack + React (TypeScript + Inertia)
create-php-starter my-app --mode=laravel --stack=full --frontend=inertia --ts --docker --testing

# Laravel decoupled SPA + React Vite + MongoDB + TypeScript
create-php-starter my-app --mode=laravel --frontend=react-vite --db=mongodb --ts

# Custom PHP MVC — identical to v1
create-php-starter my-app --mode=php --stack=mvc --db=mysql

# Saved personal preset — zero prompts
create-php-starter my-app --preset=my-api

# Add Docker to an existing Laravel project
cd existing-project && create-php-starter add docker

# Add Sanctum to an existing Laravel project
cd existing-project && create-php-starter add sanctum
```

---

## Estimated Effort

| Phase | Work | Time |
|-------|------|------|
| Phase 1 | Foundation — args, preflight, mode gate | 1 day |
| Phase 2 | Core services — env, git, packages, dry-run, summary | 1 day |
| Phase 3 | Laravel mode — stubs, prompts, scaffold | 1 day |
| Phase 4 | Extra features — Docker, CI, testing, TS, rollback, presets | 1 day |
| Phase 5 | `add` subcommand | 1 day |
| Phase 6 | Polish, test, publish | 0.5 day |
| **Total** | | **~5.5 days** |
