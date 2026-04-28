# create-php-starter

[![npm version](https://img.shields.io/npm/v/create-php-starter.svg)](https://www.npmjs.com/package/create-php-starter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org)

Unified PHP + Laravel project scaffolding CLI. Scaffold raw PHP (Vanilla / MVC / API) or a full Laravel app with optional React frontend, auth, Docker, CI, and testing — in seconds.

---

## Install & Quick Start

```bash
npx create-php-starter
```

Or install globally:

```bash
npm install -g create-php-starter
create-php-starter
```

---

## Modes

The CLI opens with a mode selector:

- **Custom PHP** — Vanilla SPA, MVC, or API-only (raw PHP, no framework)
- **Laravel** — Framework-based app with optional React/Inertia frontend, Sanctum/Passport auth, Docker, CI, and testing

---

## Usage

```
create-php-starter [project-name] [options]
create-php-starter add <feature>
```

### Core Options

| Flag | Values | Description |
|------|--------|-------------|
| `--mode` | `php` \| `laravel` | Project mode (default: interactive prompt) |
| `--stack` | `vanilla` \| `mvc` \| `api` *(php)* | PHP stack |
| | `api` \| `web` \| `full` \| `minimal` *(laravel)* | Laravel app type |
| `--frontend` | `none` \| `react-vite` \| `inertia` | Frontend setup (Laravel only) |
| `--auth` | `sanctum` \| `passport` \| `none` *(laravel)* | Auth driver |
| | `yes` \| `no` *(php)* | Include auth scaffolding |
| `--db` | `mysql` \| `pgsql` \| `mongodb` \| `sqlite` | Database driver (default: mysql) |

### Extra Flags

| Flag | Description |
|------|-------------|
| `--docker` | Add Docker setup (docker-compose.yml, Dockerfile) |
| `--ci` | Add GitHub Actions CI/CD workflow |
| `--testing` | Add testing setup (Pest / PHPUnit / Vitest) |
| `--ts` | Use TypeScript for the React frontend |
| `--preset <name>` | Load a saved preset from `~/.webstarterrc.json` |
| `--no-git` | Skip git initialization |
| `--yes` | Accept all defaults, skip optional prompts |
| `--dry-run` | Show what would be created without writing anything |
| `--verbose` | Print every shell command as it runs |

### `add` Subcommand

Retrofit features into an existing project:

```bash
create-php-starter add sanctum
create-php-starter add docker
create-php-starter add github-actions
create-php-starter add pest
```

---

## Examples

```bash
# Fully interactive
create-php-starter

# Laravel API with PostgreSQL + Sanctum
create-php-starter my-api --mode=laravel --stack=api --db=pgsql --auth=sanctum

# Laravel full stack with Inertia + React (TypeScript) + Docker + CI
create-php-starter my-app --mode=laravel --frontend=inertia --ts --docker --ci

# PHP MVC project
create-php-starter my-app --mode=php --stack=mvc --db=mysql

# Load a saved preset
create-php-starter my-app --preset=my-api

# Preview without writing files
create-php-starter my-app --mode=laravel --dry-run
```

---

## PHP Mode — Project Structures

### Vanilla

Full SPA-ready structure with HTML shell, CSS layers, modular JS, and optional PHP backend.

```
project-name/
├── assets/
│   ├── css/          main, layout, components, animations
│   ├── js/           app.js, router.js, components/, pages/public|user|admin/
│   ├── fonts/
│   └── images/
├── api/              PHP endpoints
├── config/           env.php, constants.php, response.php
├── includes/         header.php, helpers.php, rate-limiter.php
├── pages/
│   ├── public/       login.php, forgot-password.php, reset-password.php
│   ├── user/         dashboard.php
│   └── admin/        dashboard.php
├── database/         schema.sql (Complex only)
├── index.php
├── .env
├── .env.example
├── .htaccess
├── composer.json
├── README.md
└── ARCHITECTURE.md
```

**Complexity scaling:**
- Simple — base folders only
- Medium — adds `utils/`, auth pages, admin panel option
- Complex — adds `database/`, auth + admin always included, full SPA page set

### MVC

PHP MVC structure routed through a single front controller.

```
project-name/
├── app/
│   ├── Controllers/  BaseController.php stub
│   ├── Models/       BaseModel.php stub
│   └── Views/
├── routes/
│   └── web.php
├── public/
│   └── index.php     Front controller
├── config/
└── includes/
```

### API

PHP-only backend with no frontend assets.

```
project-name/
├── api/
├── config/           env.php, constants.php, response.php
├── includes/         helpers.php, rate-limiter.php
├── database/         schema.sql (if selected)
├── uploads/
├── index.php         JSON health-check endpoint
├── .env
└── .env.example
```

---

## Laravel Mode — What Gets Scaffolded

Depending on your selected options, the Laravel scaffold can include:

- Fresh Laravel installation via Composer
- React (Vite) or Inertia.js frontend
- TypeScript support
- Sanctum or Passport authentication
- MySQL, PostgreSQL, MongoDB, or SQLite configuration
- Docker setup (`docker-compose.yml`, `Dockerfile`)
- GitHub Actions CI/CD workflow
- Pest or PHPUnit testing setup

---

## Presets

Save your answers on first run and reuse them:

```bash
create-php-starter my-app --preset=my-api
```

Presets are stored in `~/.webstarterrc.json`. Your author name is also saved on first run — you won't be asked again.

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | >= 16 |
| PHP *(optional)* | >= 7.4 |
| Composer *(optional)* | Any |
| Git *(optional)* | Any |

PHP, Composer, and Git are only required when scaffolding features that use them. The CLI checks for these at startup and will guide you if anything is missing.

---

## License

MIT — [mrwayne-dev](https://github.com/mrwayne-dev)

  cd ~/cps-test && rm -rf lara-inertia && node
  /home/mrwayne/Documents/wayne/web_dev/create-web-starter/index.js lara-inertia --mode=laravel        
  --stack=full --frontend=inertia --ts --auth=sanctum --db=mysql --testing --verbose