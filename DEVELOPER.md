# DEVELOPER.md — How `create-php-starter` Works

A practical map of the scaffolder for anyone debugging it, extending it, or adding a new mode/addon. Written for the moment you sit down and need to change behaviour without re-reading the whole repo.

---
alr
## 1. The two-mode CLI

The package ships a single binary (`bin: ./index.js` in `package.json`). Everything routes through `index.js`:

```
parseArgs (src/args.js)
  └── meta flags (--version, --help)
  └── add subcommand        → src/addons/<feature>.js
  └── --preset <name>       → loads config + dispatches to a mode scaffolder
  └── interactive flow      → promptMode → mode-specific prompts → mode-specific scaffold
```

Two **modes** are supported:

| Mode      | Entry prompts                      | Entry scaffold              |
| --------- | ---------------------------------- | --------------------------- |
| `php`     | `src/php/prompts.js`               | `src/php/scaffold.js`       |
| `laravel` | `src/laravel/prompts.js`           | `src/laravel/scaffold.js`   |

Mode is resolved in this order: `--mode` flag → preset's saved `mode` → interactive `promptMode()` gate.

---

## 2. The two scaffolders at a glance

### 2a. `php` mode — pure file generation

`src/php/scaffold.js` builds projects with **no Composer required** unless the user picks `phpMailer`. Every file is generated from inline JS template strings (e.g. `mainCSS()`, `loginPHP()`). The flow is:

1. `buildFolderList(...)` → list of dirs to mkdir.
2. Write dotfiles (`.env`, `.htaccess`, `.gitignore`, `.gitattributes`).
3. Branch on `framework`: `vanilla` | `mvc` | `api`.
4. Write per-feature files (`auth`, `admin`, `database`, `contactForm`).
5. If `phpMailer`: write `composer.json` and run `installPHPMailer` (`src/composer.js`) — this is the **only** Composer call in php mode.
6. Optional: Docker, CI, Testing, Git init.
7. Print summary, offer preset save.

### 2b. `laravel` mode — composer + npm orchestration

`src/laravel/scaffold.js` shells out heavily. It expects `php`, `composer`, `git`, and `node` in `PATH` (enforced by `src/preflight.js`). The flow is:

1. `composer create-project laravel/laravel "<name>"`.
2. Write `.env` from `src/stubs/laravel/env.stub` via `EnvConfigurator.writeEnvFiles`.
3. `php artisan key:generate --force`.
4. `getComposerPackages(config)` → three buckets:
   - **prod** (e.g. `laravel/sanctum`, `inertiajs/inertia-laravel`)
   - **dev** (currently empty, but wired up)
   - **mongo** — installed separately with `--ignore-platform-req=ext-mongodb`
5. If `testing` → `composer require pestphp/pest pestphp/pest-plugin-laravel --dev -W` then `pest --init`.
6. Write base classes from stubs (`ApiResponse`, `BaseService`, `BaseRepository`, etc.).
7. Add `/health` route — also creates `routes/api.php` and registers it in `bootstrap/app.php` for Laravel 11+.
8. Frontend branch:
   - `react-vite` → `npx -y create-vite@5 frontend --template react[-ts]` then `npm install` inside `frontend/`.
   - `inertia` → write `app.{jsx,tsx}` + Welcome page, patch `routes/web.php`, install Inertia npm deps, patch `vite.config.js` to inject the React plugin.
9. Optional: Pest health-check stub, Docker, CI, dev files (`.editorconfig`, `.vscode`), Git.

> **Important:** every Composer/npm command in this file is non-interactive (`--no-interaction` / `npx -y`). If you add a new shell-out, keep that invariant or shelljs will hang silently.

---

## 3. Where packages get installed

This is the bit people get wrong most often. There are exactly four places that install packages:

| Caller                                    | Tool                | Where                                  |
| ----------------------------------------- | ------------------- | -------------------------------------- |
| `composerRequire(...)`                    | `composer require`  | `src/services/PackageInstaller.js`     |
| Inline `exec(...)` for `pest` / `vite`    | `composer` / `npx`  | `src/laravel/scaffold.js`              |
| `installPHPMailer(...)`                   | `composer require`  | `src/composer.js` (php mode only)      |
| `setupReact(...)`                         | `npm install`       | `src/services/TestingSetup.js`         |

When debugging "package X wasn't installed":

1. Run with `--verbose` — shelljs prints every command and its output.
2. Confirm the install actually fired by tracing through the bucket assembly in `getComposerPackages` and the frontend branch.
3. Confirm the cwd. `exec(cmd, step, silent, cwd)` accepts an explicit cwd; never rely on `process.cwd()` mid-scaffold (we used to `shell.cd` and it leaked state on errors).

---

## 4. The `add` subcommand

`create-php-starter add <feature>` is dispatched from `index.js` and resolved against `src/addons/<feature>.js`. The whitelist lives in `index.js`:

```js
const VALID_ADDONS = ['sanctum', 'docker', 'github-actions', 'pest'];
```

Each addon module exports a single `run(cli)` async function. It must:

- Validate it is being run inside a real project (`fs.existsSync('artisan')` for Laravel addons).
- Skip cleanly if already installed (`docker-compose.yml` exists, `vendor/laravel/sanctum` exists, etc.).
- Be **idempotent** — users will rerun.
- Use `exec()` from `PackageInstaller.js`, not raw `shell.exec`, so error reporting is consistent.

To add a new addon:

1. Create `src/addons/<name>.js` exporting `{ run }`.
2. Append `<name>` to `VALID_ADDONS` in `index.js`.
3. Document it in the help text in `index.js`.

---

## 5. Stubs

Stubs are static templates kept under `src/stubs/`:

- `src/stubs/laravel/*.stub` — Laravel base classes, env file, Inertia entry, Pint config, etc.
- `src/stubs/php/*.stub` — `editorconfig`, VS Code extensions for php mode.

Tokens are `{{LIKE_THIS}}` and replaced via `EnvConfigurator.applyTokens`. Use `writeStub(stubName, destPath, tokens)` in `laravel/scaffold.js` — it auto-`mkdir -p`s the parent dir and bails early with a clear error if the stub is missing.

---

## 6. Safety rules (do not break these)

These guards exist because of past incidents. Don't soften them.

- **Path traversal:** every project dir is validated by `assertSafePath(target, base)`. The project must be a direct child of `cwd`, never an absolute path or `..`.
- **`safeRmRf`** is the only allowed cleanup — never call `shell.rm('-rf', userInput)` directly.
- **PHP comment injection:** `phpHeader()` in `src/php/scaffold.js` strips `*/` from author/note before embedding into block comments.
- **PHP namespace strings in composer commands:** when passing to a shell, double the backslashes (`Laravel\\Sanctum\\...`). Already correct; just don't "fix" it.

---

## 7. Adding a new flag

Every CLI flag has four touchpoints:

1. `src/args.js` — declare under `boolean`/`string`, set a default, normalize.
2. `src/laravel/prompts.js` and/or `src/php/prompts.js` — accept it as a `defaults.<flag>` override and skip the corresponding prompt.
3. The mode's scaffold — branch on `config.<flag>`.
4. `index.js` HELP text — add it under the right section.

Forgetting (2) is the most common bug: the flag works in `--yes` mode but the interactive flow re-prompts and overwrites it.

---

## 8. Dry run

`--dry-run` plumbs through to a `DryRunner` (`src/services/DryRunner.js`). Each scaffolder branches on `config.dryRun` early and registers intended actions instead of running them. When you add a new step to a scaffolder, **also add a corresponding `dry.exec/write/install/mkdir` line** in the dry-run block above — otherwise users using `--dry-run` get a misleading preview.

---

## 9. Testing the CLI manually

```bash
# From a scratch dir
node /path/to/create-web-starter/index.js my-app --mode=laravel --frontend=inertia --ts --testing --verbose

# Dry run (no fs writes, no shell-outs)
node /path/to/create-web-starter/index.js my-app --mode=laravel --dry-run

# Addon flow (run from inside a scaffolded Laravel project)
cd my-app && node /path/to/create-web-starter/index.js add sanctum
```

`--verbose` is the single most useful debugging flag — it disables shelljs `silent` and you see the exact composer/npm output.

---

## 10. Release / publish

The package is published to npm as `create-php-starter`. The `bin` entry is `./index.js` which carries a `#!/usr/bin/env node` shebang. Before publishing:

- Bump `version` in `package.json`.
- Run a real scaffold end-to-end (laravel + inertia + ts + testing + docker + ci is the broadest path).
- `.npmignore` keeps `node_modules`, `notes/`, `plan.md`, `detail.md` out of the published tarball.
