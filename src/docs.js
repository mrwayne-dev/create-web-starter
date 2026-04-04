'use strict';

function generateReadme({ projectName, authorName, projectType, framework, complexity, phpBackend, features }) {
  const date  = new Date().toISOString().split('T')[0];
  const isPhp = phpBackend || framework === 'mvc' || framework === 'api';

  const stack = [];
  if (isPhp) stack.push('PHP >=7.4');
  if (framework !== 'api') {
    stack.push('Vanilla JavaScript (SPA pattern)');
    stack.push('CSS Custom Properties');
  }
  if (features.phpMailer)     stack.push('PHPMailer (Composer)');
  if (features.phosphorIcons) stack.push('Phosphor Icons');

  const stackList = stack.map((s) => `- ${s}`).join('\n');

  const tree = buildTreeAnnotation({ framework, complexity, phpBackend, features });

  let gettingStarted = '```bash\n';
  if (isPhp) {
    gettingStarted += 'edit .env   # fill in DB and SMTP credentials\n';
    if (features.database) gettingStarted += 'mysql -u root -p < database/database.sql\n';
    if (features.phpMailer) gettingStarted += 'composer install\n';
    gettingStarted += 'php -S localhost:8000\n';
  } else {
    gettingStarted += 'php -S localhost:8000\n';
  }
  gettingStarted += '```';

  const featureLines = [];
  featureLines.push(`- Framework: **${framework}** | Type: **${projectType || framework}** | Complexity: **${complexity || 'n/a'}**`);
  if (features.auth)          featureLines.push('- Authentication (login / register / forgot / reset password)');
  if (features.admin)         featureLines.push('- Admin panel (`/pages/admin/dashboard.php`)');
  if (features.contactForm)   featureLines.push('- Contact form with rate limiting');
  if (features.phpMailer)     featureLines.push('- PHPMailer (SMTP email via Composer)');
  if (features.database)      featureLines.push('- Database layer (`database/database.sql` + `config/database.php`)');
  if (features.phosphorIcons) featureLines.push('- Phosphor Icons (via CDN — added to index.php)');

  return `# ${projectName}

> Created by **${authorName}** on ${date} using [create-php-starter](https://www.npmjs.com/package/create-php-starter)

_One-line description of what this project does._

---

## Tech Stack

${stackList}

---

## Folder Structure

\`\`\`
${tree}
\`\`\`

---

## Pages Architecture

This project separates pages into three tiers — mirrored in both the PHP layer and the JS layer:

| Tier | PHP (server-rendered) | JS (SPA modules) |
|------|-----------------------|------------------|
| Public | \`pages/public/\` | \`assets/js/pages/public/\` |
| User | \`pages/user/\` | \`assets/js/pages/user/\` |
| Admin | \`pages/admin/\` | \`assets/js/pages/admin/\` |

- **public/** — no authentication required (login, register, password reset)
- **user/** — requires \`requireAuth()\` — logged-in users only
- **admin/** — requires \`requireAdmin()\` — admin role only

---

## Getting Started

${gettingStarted}

---

## Architecture Notes

- \`assets/js/app.js\` bootstraps the app on \`DOMContentLoaded\`
- \`assets/js/router.js\` maps URL paths to page modules
- \`assets/js/pages/\` contains page-level view modules (split public/user/admin)
- \`assets/js/components/\` contains reusable UI pieces
- \`assets/js/utils/\` contains helpers (DOM, API calls, transitions)
- \`.htaccess\` rewrites unknown paths to \`index.php\` to enable SPA navigation

---

## Features

${featureLines.join('\n')}
`;
}

function buildTreeAnnotation({ framework, complexity, phpBackend, features }) {
  const lines = [];
  const add   = (l) => lines.push(l);

  add('project-name/');
  if (framework === 'mvc') {
    add('|-- public/');
    add('|   +-- index.php              <- front controller entry point');
    add('|-- app/');
    add('|   |-- Controllers/           <- request handlers');
    add('|   |-- Models/                <- database models');
    add('|   +-- Views/                 <- PHP view templates');
    add('|-- routes/');
    add('|   +-- web.php                <- route definitions');
  } else if (framework === 'api') {
    add('|-- index.php                  <- JSON health-check endpoint');
  } else {
    add('|-- index.php                  <- SPA shell (SEO, OG meta, CSS, app.js)');
    add('|-- assets/');
    add('|   |-- css/');
    add('|   |   |-- main.css           <- CSS custom properties + reset');
    add('|   |   |-- layout.css         <- grid, flex, structural layout');
    add('|   |   |-- components.css     <- buttons, cards, forms');
    add('|   |   +-- animations.css     <- keyframes + motion utilities');
    add('|   |-- js/');
    add('|   |   |-- app.js             <- SPA entry point + bootstrapper');
    add('|   |   |-- router.js          <- client-side route definitions');
    add('|   |   |-- pages/');
    add('|   |   |   |-- public/        <- public page modules (home, about, contact)');
    add('|   |   |   |-- user/          <- authenticated user page modules');
    if (features.admin) add('|   |   |   +-- admin/         <- admin page modules');
    add('|   |   |-- components/        <- reusable UI (nav, modals, etc.)');
    add('|   |   +-- utils/             <- helpers: dom.js, api.js, transitions.js');
    if (complexity === 'medium' || complexity === 'complex') {
      add('|   |   |-- services/        <- fetch abstraction / API wrappers');
      add('|   |   +-- lib/             <- third-party adapters');
    }
    if (complexity === 'complex') {
      add('|   |   |-- store/           <- state management');
      add('|   |   |-- middleware/      <- request/response interceptors');
      add('|   |   +-- modules/         <- feature modules (auth/, dashboard/, etc.)');
    }
    add('|   |-- fonts/');
    add('|   |-- images/');
    add('|   +-- favicon/');
    // Phosphor Icons now CDN-only — no icons/ folder generated
  }

  const isPhp = phpBackend || framework === 'mvc' || framework === 'api';
  if (isPhp) {
    add('|-- api/');
    if (features.contactForm) add('|   |-- contact.php           <- contact form handler');
    if (features.auth)        add('|   |-- auth/                 <- login, register, forgot, reset');
    if (features.admin)       add('|   +-- admin/                <- admin-only API endpoints');
    if (framework === 'vanilla' && (complexity === 'medium' || complexity === 'complex')) add('|   +-- v1/                   <- versioned API (reserved)');
    if (framework === 'vanilla' && complexity === 'complex') add('|   +-- webhooks/             <- webhook handlers');
    add('|-- config/');
    add('|   |-- constants.php          <- app constants + error config');
    add('|   |-- env.php                <- .env loader');
    add('|   +-- responses.php          <- jsonSuccess() / jsonError()');
    if (features.database) add('|   +-- database.php          <- PDO singleton');
    add('|-- includes/');
    add('|   |-- headers.php            <- CORS + Content-Type');
    add('|   +-- helpers.php            <- sanitize() + validateEmail()');
    if (features.contactForm)  add('|   +-- rate_limit.php        <- session-based rate limiter');
    if (features.phpMailer)    add('|   +-- mailer.php            <- PHPMailer wrapper');
    if (features.auth)         add('|   +-- auth-check.php        <- requireAuth() / requireAdmin()');
    if (features.auth) {
      add('|-- pages/');
      add('|   |-- public/              <- login.php, forgot-password.php, reset-password.php');
      add('|   +-- user/                <- dashboard.php (auth required)');
      if (features.admin) add('|   +-- admin/               <- dashboard.php (admin required)');
    }
    if (features.database) {
      add('|-- database/');
      add('|   +-- database.sql         <- schema: users, password_resets, sessions');
    }
  }

  add('|-- .env                         <- local credentials (gitignored)');
  add('|-- .env.example                 <- credentials template');
  add('|-- .htaccess');
  add('|-- .gitignore');
  add('+-- uploads/                     <- user uploads (gitignored)');

  return lines.join('\n');
}

function generateArchitecture({ projectName, framework, complexity, phpBackend, features }) {
  const isPhp = phpBackend || framework === 'mvc' || framework === 'api';
  const jsLayers = buildJSLayersDocs(complexity, framework);
  const pagesSection = features.auth ? buildPagesDocs() : '';

  return `# Architecture — ${projectName}

## Why This Structure

No framework overhead — vanilla PHP and JavaScript with clear ownership boundaries per file. Every folder has exactly one responsibility.

---

## The SPA Pattern

\`index.php\` is the single HTML shell. The browser loads it once.

1. \`assets/js/app.js\` — bootstraps on \`DOMContentLoaded\`, initialises router and global components
2. \`assets/js/router.js\` — route table mapping URL paths to page modules
3. \`assets/js/pages/\` — page modules split into \`public/\`, \`user/\`, \`admin/\`
4. \`assets/js/components/\` — reusable UI (nav, modals, cards)
5. \`assets/js/utils/\` — stateless helpers (DOM, fetch wrappers, transitions)

\`.htaccess\` rewrites non-file requests to \`index.php\` so the router handles navigation without server 404s.

---

## CSS Architecture

| File | Owns |
|------|------|
| \`main.css\` | Design tokens (\`--color-*\`, \`--font-*\`) + box-model reset + body defaults |
| \`layout.css\` | Page skeleton, containers, grid + flex structural rules |
| \`components.css\` | Reusable UI patterns: \`.btn\`, cards, form controls |
| \`animations.css\` | \`@keyframes\`, animation utilities, always wrapped in \`prefers-reduced-motion\` |

---

## JS Layers

${jsLayers}

---
${pagesSection}
${isPhp ? buildPHPLayerDocs(features) : ''}
## Environment Setup

| Variable | Purpose |
|----------|---------|
| \`APP_NAME\` | Application name used in emails and titles |
| \`APP_URL\` | Full base URL — used for reset links and CORS |
| \`APP_ENV\` | \`development\` enables error display; \`production\` suppresses it |
| \`DB_HOST / DB_NAME / DB_USER / DB_PASS\` | MySQL connection |
| \`SESSION_LIFETIME\` | Session duration in seconds |
| \`SMTP_*\` | Email sending credentials (PHPMailer) |
`;
}

function buildJSLayersDocs(complexity, framework) {
  if (framework === 'api') return '_No JS layer — API-only project._\n';
  let s = `| Folder | Responsibility |\n|--------|----------------|\n`;
  s += `| \`pages/public/\` | Public page modules — accessible to all visitors |\n`;
  s += `| \`pages/user/\` | Authenticated page modules — logged-in users only |\n`;
  s += `| \`pages/admin/\` | Admin page modules — admin role required |\n`;
  s += `| \`components/\` | Reusable UI pieces imported by multiple pages |\n`;
  s += `| \`utils/\` | Stateless helpers: DOM queries, fetch wrappers, transitions |\n`;
  if (complexity === 'medium' || complexity === 'complex') {
    s += `| \`services/\` | Fetch abstraction layer — typed API call wrappers |\n`;
    s += `| \`lib/\` | Third-party adapters and initialisers |\n`;
  }
  if (complexity === 'complex') {
    s += `| \`store/\` | App-wide state management |\n`;
    s += `| \`middleware/\` | Request/response interceptors (auth headers, error handling) |\n`;
    s += `| \`modules/\` | Feature-based modules (auth/, dashboard/) |\n`;
  }
  return s;
}

function buildPagesDocs() {
  return `## Pages Architecture

PHP pages and JS page modules follow a consistent three-tier split:

| Tier | PHP | JS |
|------|-----|----|
| Public | \`pages/public/\` | \`assets/js/pages/public/\` |
| User | \`pages/user/\` | \`assets/js/pages/user/\` |
| Admin | \`pages/admin/\` | \`assets/js/pages/admin/\` |

- **public/** — no auth required. Login, register, password reset.
- **user/** — \`requireAuth()\` guard applied. Dashboard, profile, settings.
- **admin/** — \`requireAdmin()\` guard applied. Admin panel, user management.

---

`;
}

function buildPHPLayerDocs(features) {
  return `## PHP Layer

\`api/\` contains endpoint files — one concern per file, always returns JSON via \`jsonSuccess()\` / \`jsonError()\`.

**config/** vs **includes/** distinction:
- **config/** — bootstrap files loaded once per entry point (\`constants.php\` loads \`env.php\`, optionally \`database.php\`)
- **includes/** — utility files required a-la-carte by specific endpoints

${features.auth ? `Auth state lives in the PHP session. \`includes/auth-check.php\` provides \`requireAuth()\` and \`requireAdmin()\` guards that return 401/403 JSON before any business logic runs.\n\n---\n\n` : '---\n\n'}`;
}

module.exports = { generateReadme, generateArchitecture };
