# create-php-starter v2.2.0 — Feature Reference

## What is this?

`create-php-starter` is a Node.js CLI that scaffolds production-ready PHP projects in seconds. You run one command, answer a few questions, and get a complete project structure — with auth, database config, Docker, CI/CD, testing, and more already wired in.

It is a **unified PHP + Laravel scaffolding platform** covering both raw PHP projects and full Laravel applications.

---

## Startup Experience

Every run opens with an animated ASCII bat character that draws itself line-by-line in the terminal (~1s), then clears to reveal the **Wayne Manor banner** — a styled two-panel display showing:

- The bat logo in full
- A personalised greeting using your saved author name
- Current version and working directory
- Your saved presets (left column)
- Quick-tip flag reference (right column)

The animation is skipped automatically on non-TTY environments (pipes, CI, `--dry-run` piped to `cat`).

All visual output — spinners, success/failure panels, the summary box — uses a unified Batman/Alfred theme: cyan accent colours, bat-signal yellow used sparingly, Alfred/Wayne Manor flavour text on every spinner step.

---

## Two Modes

The first question after launch is the mode gate:

```
? What kind of project are you scaffolding?
  ❯ Custom PHP  — Vanilla / MVC / API  (raw PHP, no framework)
    Laravel     — Framework-based app with optional React frontend
```

Everything branches from here.

---

## Custom PHP Mode

Raw PHP projects — no framework, you control the structure.

### Stacks

| Stack | What it generates |
|-------|------------------|
| **Vanilla** | SPA-ready HTML shell, CSS layers (main/layout/components/animations), modular JS (app.js, router.js), optional PHP backend |
| **MVC** | `app/Controllers/`, `app/Models/`, `app/Views/`, front controller, route stubs |
| **API** | PHP backend only — health-check endpoint, config, includes, no frontend assets |

### Complexity Levels (Vanilla only)

| Level | What changes |
|-------|-------------|
| **Simple** | Base folder structure only |
| **Medium** | Adds `assets/js/services/`, `assets/js/lib/`, image subfolders, `api/v1/` |
| **Complex** | Adds `assets/js/store/`, `assets/js/middleware/`, `assets/js/modules/`, `api/webhooks/`, auth forced on, database forced on |

### Optional Features (all stacks)

| Feature | What it writes |
|---------|---------------|
| **Contact form** | `api/contact.php` with rate limiting (5 req/min), session-based rate limiter |
| **PHPMailer** | `composer.json`, `vendor/` via Composer, `includes/mailer.php` SMTP wrapper |
| **Auth** | `api/auth/` — login, register, logout, forgot-password, reset-password endpoints + `pages/public/` login/forgot/reset pages + `pages/user/dashboard.php` + `includes/auth-check.php` |
| **Admin panel** | `api/admin/dashboard.php` (stats query), `pages/admin/dashboard.php` (HTML panel) |
| **Database** | `config/database.php` (PDO singleton), `database/database.sql` (users, password_resets, sessions tables) |
| **Phosphor Icons** | Adds CDN `<script>` tag to `index.php` |

### Always Generated (Custom PHP)

- `.env` + `.env.example` — DB credentials, SMTP, app settings
- `.htaccess` — PHP extension removal, SPA fallback routing, blocks `/vendor/`, blocks `.env`
- `.gitignore` + `.gitattributes`
- `README.md` + `ARCHITECTURE.md` — project-specific documentation
- `.editorconfig` — consistent indentation across editors
- `.vscode/extensions.json` — recommends PHP Intelephense, PHP CS Fixer, GitLens

---

## Laravel Mode

Framework-based projects using `composer create-project laravel/laravel`.

### Stacks

| Stack | What it configures |
|-------|--------------------|
| **API** | JSON API with Swagger docs (`l5-swagger`), `spatie/laravel-data` for typed DTOs |
| **Web** | Blade views, full web routing |
| **Full** | API + Blade/Inertia, both route groups, auth-ready |
| **Minimal** | Bare Laravel install — you wire everything |

### Auth Packages

| Option | Package |
|--------|---------|
| **Sanctum** *(default)* | `laravel/sanctum` — token + session auth, SPA-friendly |
| **Passport** | `laravel/passport` — full OAuth2 server |
| **None** | Skip auth, add manually later |

### Database Drivers

| Driver | Config written |
|--------|---------------|
| **MySQL** *(default)* | `DB_CONNECTION=mysql`, port 3306 |
| **PostgreSQL** | `DB_CONNECTION=pgsql`, port 5432 |
| **MongoDB** | `DB_CONNECTION=mongodb`, port 27017, installs `mongodb/laravel-mongodb` |
| **SQLite** | `DB_CONNECTION=sqlite`, creates `database/database.sqlite` file |

### Frontend Options (Laravel only)

| Option | What it does |
|--------|-------------|
| **None** *(default)* | API only, no frontend |
| **React (Vite)** | Scaffolds a decoupled `/frontend` SPA via `npm create vite@latest`, patches `config/cors.php` with `FRONTEND_URL` |
| **Inertia** | Installs `inertiajs/inertia-laravel` + `tightenco/ziggy`, writes `resources/js/app.jsx`, `resources/views/app.blade.php` |

Add `--ts` to either React option for TypeScript: uses `react-ts` Vite template or installs TS deps + writes `app.tsx` + `tsconfig.json`.

### Laravel Architecture Stubs (always written)

These files establish a consistent base architecture in every Laravel project:

| File | Purpose |
|------|---------|
| `app/Traits/ApiResponse.php` | `success()`, `error()`, `paginated()` — consistent JSON response format across all controllers |
| `app/Services/BaseService.php` | Abstract service layer with CRUD delegation to repository |
| `app/Repositories/BaseRepository.php` | Abstract Eloquent repository with `find`, `all`, `create`, `update`, `delete`, `paginate` |
| `app/Http/Controllers/BaseController.php` | Extends `Controller`, uses `ApiResponse` trait |
| `app/Http/Requests/BaseRequest.php` | Overrides `failedValidation` to always return JSON `422` matching `ApiResponse` format |
| `app/Exceptions/Handler.php` | Catches `ValidationException`, `ModelNotFoundException`, `AuthenticationException`, `HttpException` and formats all as JSON |
| `pint.json` | Laravel Pint code style config |
| `routes/api.php` | Appended with `/api/health` check endpoint |

Folders also created: `app/Services/`, `app/Repositories/`, `app/Traits/`, `app/Enums/`

### Always Generated (Laravel)

- `.env` + `.env.example` — pre-filled with correct `DB_CONNECTION`, `DB_PORT`, `DB_DATABASE` for chosen driver
- `php artisan key:generate` — run automatically after `.env` is written
- `.editorconfig`
- `.vscode/extensions.json` — adds Laravel Blade Snippets, Laravel Artisan, ESLint/Prettier if React

---

## Extra Features (Both Modes)

### `--docker`

Generates Docker files tailored to your stack.

**Laravel:**
- `docker-compose.yml` — `app` (PHP-FPM), `nginx`, `db` (MySQL/Postgres/Mongo depending on `--db`)
- `Dockerfile` — PHP 8.2-FPM, Composer install, `artisan optimize`
- `docker/nginx.conf` — FastCGI pass to PHP-FPM, SPA fallback

**Custom PHP:**
- `docker-compose.yml` — Apache + PHP + DB service

```bash
docker-compose up -d   # full stack running immediately
```

### `--ci`

Generates `.github/workflows/ci.yml`.

**Laravel CI:** PHP 8.2 setup → Composer install → `php artisan migrate` → `php artisan test` (Pest) → `./vendor/bin/pint --test` (code style)

**Custom PHP CI:** PHP 8.2 setup → Composer install → PHPUnit

React frontend (if selected) gets a separate job: Node 20 → `npm ci` → `npm run build`

### `--testing`

**Laravel:** Installs `pestphp/pest` + `pestphp/pest-plugin-laravel`, writes `tests/Feature/HealthCheckTest.php` — a Pest test that hits `/api/health` and asserts `{ success: true, status: "ok" }`.

**Custom PHP:** Writes `phpunit.xml` + `tests/ExampleTest.php`.

**React (Vite):** Writes `vitest.config.js/ts`, `src/setupTests.js/ts`, `src/__tests__/App.test.jsx/tsx`.

### `--ts` (Laravel + React only)

- `react-vite` mode: uses `--template react-ts` Vite template
- `inertia` mode: installs TypeScript + `@types/react` + `@types/react-dom`, writes `app.tsx`, `tsconfig.json`, `vite.config.ts`

---

## CLI Flags Reference

```
create-php-starter [project-name] [options]

Core:
  --mode        php | laravel                                     (default: prompts)
  --stack       vanilla | mvc | api          [php mode]
                api | web | full | minimal    [laravel mode]
  --frontend    none | react-vite | inertia  [laravel mode only]
  --auth        sanctum | passport | none    [laravel mode]
  --db          mysql | pgsql | mongodb | sqlite                  (default: mysql)

Features:
  --docker      Include Docker setup
  --ci          Include GitHub Actions CI/CD
  --testing     Include testing setup
  --ts          TypeScript for React frontend

Presets:
  --preset      Name of a saved preset from ~/.webstarterrc.json

Meta:
  --no-git      Skip git init
  --yes         Accept all defaults, skip optional prompts
  --dry-run     Print what would be created, write nothing
  --verbose     Print every shell command
  --version     Print version
  --help        Print flag reference
```

Any flag pre-fills the corresponding prompt — only the unanswered questions are asked interactively.

---

## `add` Subcommand

Run inside an existing project to retroactively add features.

```bash
cd my-existing-project

create-php-starter add sanctum        # composer require + publish + migrate
create-php-starter add docker         # generates docker-compose.yml + Dockerfile
create-php-starter add github-actions # generates .github/workflows/ci.yml
create-php-starter add pest           # installs Pest + writes HealthCheckTest
```

Each addon detects whether it's inside a Laravel project (checks for `artisan`) or a Custom PHP project and runs the appropriate logic. Safe to run on projects not created by this tool.

---

## Named Presets

Save your preferred configuration once, use it anywhere:

```
? Save these settings as a preset for next time? Yes
? Preset name: my-api
✔  Saved to ~/.webstarterrc.json
```

Then on any machine:

```bash
create-php-starter my-app --preset=my-api
# No prompts — pulls mode, stack, auth, db, docker, ci, testing from saved config
```

Stored in `~/.webstarterrc.json`:

```json
{
  "authorName": "Your Name",
  "presets": {
    "my-api": {
      "mode": "laravel",
      "stack": "api",
      "auth": "sanctum",
      "db": "pgsql",
      "docker": true,
      "ci": true,
      "testing": true
    }
  }
}
```

---

## Pre-flight Checks

Before touching the filesystem, the CLI checks that required tools are installed:

| Mode | Required tools |
|------|---------------|
| Custom PHP | `php`, `composer`, `git` |
| Laravel | `php`, `composer`, `git`, `node` |

If anything is missing, you get a clear message with the install URL for that tool — the scaffold never starts partially.

---

## Dry Run

Preview exactly what would be created without writing a single file:

```bash
create-php-starter my-app --mode=laravel --stack=api --db=pgsql --auth=sanctum --docker --ci --testing --dry-run
```

```
[dry-run] Would run:     composer create-project laravel/laravel "my-app"
[dry-run] Would install: laravel/sanctum, darkaonline/l5-swagger, spatie/laravel-data
[dry-run] Would install: pestphp/pest, pestphp/pest-plugin-laravel (dev)
[dry-run] Would write:   .env from stub
[dry-run] Would run:     Generate app key
[dry-run] Would create:  app/Services/, app/Repositories/, app/Traits/, app/Enums/
[dry-run] Would write:   ApiResponse, BaseService, BaseRepository, BaseController, BaseRequest, ExceptionHandler
[dry-run] Would write:   Docker files
[dry-run] Would write:   GitHub Actions CI
[dry-run] Would install: Install Pest
[dry-run] Would write:   .editorconfig, .vscode/extensions.json, pint.json
[dry-run] Would run:     git init + initial commit

Nothing was written to disk.
```

---

## Rollback on Failure

The entire scaffold is wrapped in a `try/catch`. If any step fails (Composer error, disk full, permission denied), the partial project directory is deleted automatically and the error step is named:

```
✖  Scaffold failed at: composer require laravel/sanctum
   Package not found: laravel/sanctum
   Partial project cleaned up.
```

You never end up with a half-built project left on disk.

---

## Project Name Collision

If a folder with your project name already exists, you're given a choice — not a crash:

```
? A folder named "my-app" already exists. What do you want to do?
  ❯ Overwrite it
    Cancel
```

---

## End-of-Run Summary

Every successful scaffold prints a structured summary:

```
 ┌─────────────────────────────────────────────┐
 │   my-app scaffolded successfully             │
 ├─────────────────────────────────────────────┤
 │  Mode      Laravel                           │
 │  Stack     api                               │
 │  Auth      Sanctum                           │
 │  Database  PostgreSQL (port 5432)            │
 │  Frontend  None (API only)                   │
 │  Docker    Yes                               │
 │  CI        GitHub Actions                    │
 │  Testing   Pest                              │
 │  Git       Initialized, first commit         │
 ├─────────────────────────────────────────────┤
 │  Next steps:                                 │
 │    cd my-app                                 │
 │    cp .env.example .env                      │
 │    php artisan key:generate                  │
 │    php artisan migrate                       │
 │    php artisan serve                         │
 └─────────────────────────────────────────────┘
```

---

## Requirements

| Tool | Version | When required |
|------|---------|--------------|
| Node.js | >= 16 | Always |
| PHP | >= 7.4 | Any PHP scaffold |
| Composer | Any | Any PHP scaffold |
| Git | Any | Unless `--no-git` |
| Node.js/npm | >= 16 | Laravel mode, React frontend |

---

## Install

```bash
# Use immediately without installing
npx create-php-starter

# Install globally
npm install -g create-php-starter
create-php-starter
```

---

## Example Commands

```bash
# Fully interactive — mode gate first, then questions
create-php-starter

# Laravel API + PostgreSQL + Sanctum — no prompts
create-php-starter my-api --mode=laravel --stack=api --db=pgsql --auth=sanctum

# Laravel full-stack + Inertia + TypeScript + Docker + CI + Pest
create-php-starter my-app --mode=laravel --stack=full --frontend=inertia --ts --docker --ci --testing

# Laravel decoupled SPA + React (Vite) + MongoDB + TypeScript
create-php-starter my-spa --mode=laravel --frontend=react-vite --db=mongodb --ts

# Custom PHP MVC — identical to v1 behavior
create-php-starter my-site --mode=php --stack=mvc --db=mysql

# Preview everything that would be created, write nothing
create-php-starter my-app --mode=laravel --stack=api --dry-run

# Saved preset — zero prompts, zero flags
create-php-starter my-app --preset=my-api

# Add Docker to an existing project
cd existing-project && create-php-starter add docker

# Add Sanctum to an existing Laravel project
cd existing-laravel && create-php-starter add sanctum
```
