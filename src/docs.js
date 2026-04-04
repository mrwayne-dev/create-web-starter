'use strict';

/**
 * Generate README.md content dynamically from the project config.
 */
function generateReadme({ projectName, authorName, projectType, complexity, phpBackend, features }) {
  const date = new Date().toISOString().split('T')[0];

  // ── Tech stack list ───────────────────────────────────────────────────────
  const stack = [];
  if (phpBackend) stack.push('PHP >=7.4 (backend API layer)');
  stack.push('Vanilla JavaScript (SPA pattern — no framework)');
  stack.push('CSS Custom Properties (no preprocessor)');
  if (features.phpMailer) stack.push('PHPMailer (SMTP email via Composer)');
  if (features.phosphorIcons) stack.push('Phosphor Icons');

  const stackList = stack.map((s) => `- ${s}`).join('\n');

  // ── Folder tree annotation ────────────────────────────────────────────────
  const tree = buildTreeAnnotation({ complexity, phpBackend, features });

  // ── Getting started ───────────────────────────────────────────────────────
  let gettingStarted = '```bash\n';
  if (phpBackend) {
    gettingStarted += 'cp .env.example .env\n';
    gettingStarted += '# Edit .env with your DB credentials and SMTP settings\n';
    if (features.database) gettingStarted += 'mysql -u root -p < database/database.sql\n';
    if (features.phpMailer) gettingStarted += 'composer install\n';
    gettingStarted += 'php -S localhost:8000\n';
  } else {
    gettingStarted += '# Open index.php in your browser or start a local server:\n';
    gettingStarted += 'php -S localhost:8000\n';
  }
  gettingStarted += '```';

  // ── Features list ─────────────────────────────────────────────────────────
  const featureLines = [];
  featureLines.push(`- Project type: **${projectType}** (${complexity} complexity)`);
  if (features.auth)          featureLines.push('- ✅ Authentication (login / register / forgot / reset password)');
  if (features.admin)         featureLines.push('- ✅ Admin panel (`/admin/dashboard.php`)');
  if (features.contactForm)   featureLines.push('- ✅ Contact form with rate limiting');
  if (features.phpMailer)     featureLines.push('- ✅ PHPMailer (SMTP email)');
  if (features.database)      featureLines.push('- ✅ Database layer (`database/database.sql` + `config/database.php`)');
  if (features.phosphorIcons) featureLines.push('- ✅ Phosphor Icons (`assets/icons/`)');

  return `# ${projectName}

> Created by **${authorName}** on ${date} using [create-web-starter](https://github.com/mrwayne-dev/create-web-starter)

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

## Getting Started

${gettingStarted}

---

## Architecture Notes

This project follows a **vanilla PHP + JS SPA** pattern:

- \`assets/js/app.js\` bootstraps the app on DOMContentLoaded
- \`assets/js/router.js\` maps URL paths to page modules
- \`assets/js/pages/\` contains page-level view modules
- \`assets/js/components/\` contains reusable UI pieces
- \`assets/js/utils/\` contains helpers (DOM, API calls, transitions)
- \`.htaccess\` rewrites unknown paths to \`index.php\` to enable SPA navigation

---

## Features

${featureLines.join('\n')}
`;
}

// ── Build annotated folder tree for README ──────────────────────────────────
function buildTreeAnnotation({ complexity, phpBackend, features }) {
  const lines = [];
  const add = (line) => lines.push(line);

  add('project-name/');
  add('├── index.php                 ← SPA shell — loads CSS + app.js');
  add('├── .env.example              ← environment variable template');
  add('├── .htaccess                 ← URL rewriting + SPA fallback');
  add('├── .gitignore');
  add('├── .gitattributes');
  add('├── README.md');
  add('├── ARCHITECTURE.md');
  if (phpBackend && features.phpMailer) add('├── composer.json');
  add('│');
  if (phpBackend) {
    add('├── api/                      ← PHP API endpoints');
    if (features.contactForm) {
      add('│   ├── contact.php           ← contact form handler');
      add('│   ├── email_templates.php   ← reusable email HTML templates');
    }
    if (features.auth) add('│   ├── auth/                 ← login / register / forgot / reset');
    if (features.admin) add('│   ├── admin/                ← admin-only API endpoints');
    if (complexity === 'medium' || complexity === 'complex') add('│   ├── v1/                   ← versioned API (reserved)');
    if (complexity === 'complex') add('│   └── webhooks/             ← incoming webhook handlers');
    add('│');
  }
  add('├── assets/');
  add('│   ├── css/');
  add('│   │   ├── main.css           ← CSS custom properties + reset');
  add('│   │   ├── layout.css         ← grid, flex, structural layout');
  add('│   │   ├── components.css     ← buttons, cards, forms');
  add('│   │   └── animations.css     ← keyframes + motion utilities');
  add('│   ├── fonts/');
  add('│   ├── images/');
  if (complexity === 'medium' || complexity === 'complex') {
    add('│   │   ├── hero/');
    add('│   │   ├── icons/');
    add('│   │   └── og/');
  }
  add('│   ├── favicon/');
  if (features.phosphorIcons) add('│   ├── icons/                ← Phosphor Icons');
  add('│   └── js/');
  add('│       ├── app.js             ← SPA entry point + bootstrapper');
  add('│       ├── router.js          ← client-side route definitions');
  add('│       ├── components/        ← reusable UI (nav, modals, etc.)');
  add('│       ├── pages/             ← page-level view modules');
  add('│       ├── utils/             ← helpers: dom.js, api.js, transitions.js');
  if (complexity === 'medium' || complexity === 'complex') {
    add('│       ├── services/          ← fetch abstraction / API call wrappers');
    add('│       └── lib/               ← third-party adapters + initialisers');
  }
  if (complexity === 'complex') {
    add('│       ├── store/             ← state management');
    add('│       ├── middleware/        ← request/response interceptors');
    add('│       └── modules/           ← feature modules (auth/, dashboard/, etc.)');
  }
  add('│');
  if (phpBackend) {
    add('├── config/');
    add('│   ├── constants.php         ← app-wide constants + error config');
    add('│   ├── env.php               ← .env loader');
    add('│   ├── responses.php         ← jsonSuccess() / jsonError() helpers');
    if (features.database) add('│   └── database.php          ← PDO singleton');
    add('│');
    add('├── includes/');
    add('│   ├── headers.php           ← CORS + Content-Type headers');
    add('│   ├── helpers.php           ← sanitize() + validateEmail()');
    if (features.contactForm) add('│   ├── rate_limit.php        ← session-based rate limiter');
    if (features.phpMailer)   add('│   ├── mailer.php            ← PHPMailer wrapper');
    if (features.auth)        add('│   └── auth-check.php        ← requireAuth() / requireAdmin()');
    add('│');
  }
  if (phpBackend && features.auth) {
    add('├── pages/                    ← PHP-rendered auth pages');
    add('│   ├── login.php');
    add('│   ├── forgot-password.php');
    add('│   ├── reset-password.php');
    add('│   └── dashboard.php');
    add('│');
  }
  if (phpBackend && features.admin) {
    add('├── admin/                    ← admin panel (PHP-rendered)');
    add('│   └── dashboard.php');
    add('│');
  }
  if (phpBackend && features.database) {
    add('├── database/');
    add('│   └── database.sql          ← schema: users, password_resets, sessions');
    add('│');
  }
  add('└── uploads/                  ← user-uploaded files (gitignored)');

  return lines.join('\n');
}

// ── Generate ARCHITECTURE.md ────────────────────────────────────────────────
function generateArchitecture({ projectName, complexity, phpBackend, features }) {
  const jsLayers = buildJSLayersDocs(complexity);
  const phpLayer = phpBackend ? buildPHPLayerDocs(features) : '';

  return `# Architecture — ${projectName}

## Why This Structure

No framework overhead — just vanilla PHP and JavaScript. Every file has a clear ownership boundary. You can read the codebase top-to-bottom without a mental model of a framework's conventions.

---

## The SPA Pattern

\`index.php\` is the single HTML shell. The browser loads it once.

1. \`assets/js/app.js\` — bootstraps on \`DOMContentLoaded\`, initialises the router and global components
2. \`assets/js/router.js\` — defines the route table mapping URL paths to page modules
3. \`assets/js/pages/\` — each file is a page module that renders its own view
4. \`assets/js/components/\` — reusable UI pieces (nav, modals, etc.) imported by pages
5. \`assets/js/utils/\` — stateless helper functions (DOM manipulation, fetch wrappers, transitions)

\`.htaccess\` rewrites all non-file requests to \`index.php\` so the router handles navigation without 404s from the server.

---

## CSS Architecture

Each CSS file owns exactly one concern — they load together but never bleed into each other:

| File | Owns |
|------|------|
| \`main.css\` | Design tokens (\`--color-*\`, \`--font-*\`) + box-model reset + body defaults |
| \`layout.css\` | Page skeleton, containers, grid + flexbox structural rules |
| \`components.css\` | Reusable UI patterns: \`.btn\`, cards, form controls |
| \`animations.css\` | \`@keyframes\`, animation utilities, always wrapped in \`prefers-reduced-motion\` |

---

## JS Layers

${jsLayers}

---
${phpLayer}
## Environment Setup

Variables defined in \`.env\` (copy from \`.env.example\`):

| Variable | Purpose |
|----------|---------|
| \`APP_NAME\` | Application name shown in emails and page titles |
| \`APP_URL\` | Full base URL — used for reset links and CORS |
| \`APP_ENV\` | \`development\` shows errors; \`production\` suppresses them |
| \`DB_HOST / DB_NAME / DB_USER / DB_PASS\` | MySQL connection |
| \`SESSION_LIFETIME\` | Session duration in seconds |
| \`SMTP_*\` | Email sending credentials (PHPMailer) |
`;
}

function buildJSLayersDocs(complexity) {
  let s = `| Folder | Responsibility |\n|--------|----------------|\n`;
  s += `| \`pages/\` | Page-level view modules — each maps to one route |\n`;
  s += `| \`components/\` | Reusable UI pieces imported by multiple pages |\n`;
  s += `| \`utils/\` | Stateless helpers: DOM queries, fetch wrappers, transitions |\n`;
  if (complexity === 'medium' || complexity === 'complex') {
    s += `| \`services/\` | Fetch abstraction layer — wraps API calls with typed responses |\n`;
    s += `| \`lib/\` | Third-party adapters and initialisers |\n`;
  }
  if (complexity === 'complex') {
    s += `| \`store/\` | App-wide state management |\n`;
    s += `| \`middleware/\` | Request/response interceptors (auth headers, error handling) |\n`;
    s += `| \`modules/\` | Feature-based modules (e.g. \`auth/\`, \`dashboard/\`) |\n`;
  }
  return s;
}

function buildPHPLayerDocs(features) {
  return `## PHP Layer

\`api/\` contains endpoint files only — one concern per file, always return JSON.

\`config/\` vs \`includes/\` distinction:
- **config/** — bootstrap files loaded once at the top of entry points (\`constants.php\` → \`env.php\` → optional \`database.php\`)
- **includes/** — utility files required a-la-carte by specific endpoints (\`headers.php\`, \`helpers.php\`, etc.)

Every API endpoint uses \`jsonSuccess()\` and \`jsonError()\` from \`config/responses.php\` so responses are always consistent.
${features.auth ? '\nAuth state lives in the PHP session. `includes/auth-check.php` provides `requireAuth()` and `requireAdmin()` guards that short-circuit with a 401/403 JSON response before any business logic runs.\n' : ''}
---

`;
}

module.exports = { generateReadme, generateArchitecture };
