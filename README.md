# create-php-starter

[![npm version](https://img.shields.io/npm/v/create-php-starter.svg)](https://www.npmjs.com/package/create-php-starter)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D16-brightgreen)](https://nodejs.org)

Complexity-aware PHP + JavaScript project scaffolding CLI. Generates a clean, production-ready structure with optional authentication, admin panel, PHPMailer, Phosphor Icons, and more — in seconds.

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

## Prompt Flow

The CLI guides you through a short set of questions:

1. **Framework** — Vanilla SPA, MVC, or API-only
2. **Project name** — Slugified automatically
3. **Project type** — Portfolio, Business, SaaS, E-Commerce, Custom *(Vanilla only)*
4. **Complexity** — Simple, Medium, or Complex *(Vanilla only)*
5. **PHP backend** — Include `api/`, `config/`, `includes/` *(Vanilla only)*
6. **Features** — Contact form, PHPMailer, Phosphor Icons, Auth, Admin panel, Database layer

Your author name is saved to `~/.webstarterrc.json` on first run — you won't be asked again.

---

## Framework Options

### Vanilla (default)
Full SPA-ready structure: HTML shell with SEO/OG meta, CSS layers, modular JS, and an optional PHP backend.

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
├── index.php         Production HTML shell (SEO, OG, Twitter Card, SPA mounts)
├── .env              DB and SMTP credentials (gitignored)
├── .env.example      Committed reference copy
├── .htaccess
├── composer.json
├── README.md
└── ARCHITECTURE.md
```

**Complexity scaling:**
- Simple — base folders only
- Medium — adds `utils/`, `assets/js/pages/user/`, auth pages, admin panel option
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
│   └── web.php       Route definition stubs
├── public/
│   └── index.php     MVC entry point (route all traffic here)
├── config/
├── includes/
└── ...
```

### API
PHP-only backend — no frontend assets generated.

```
project-name/
├── api/              Endpoint folders
├── config/           env.php, constants.php, response.php
├── includes/         helpers.php, rate-limiter.php
├── database/         schema.sql (if selected)
├── uploads/
├── index.php         JSON health-check endpoint
├── .env
└── .env.example
```

---

## Requirements

| Requirement | Version |
|-------------|--------|
| Node.js | >= 16 |
| PHP *(optional)* | >= 7.4 |
| Composer *(optional)* | Any |

PHP and Composer are only needed if you enable PHPMailer or PHP backend features. The CLI will help you install Composer automatically if it isn't found.

---

## License

MIT — [mrwayne-dev](https://github.com/mrwayne-dev)
