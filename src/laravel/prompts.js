'use strict';

const inquirer = require('inquirer').default;

/**
 * Run the interactive prompt flow for Laravel mode.
 * Skips any question whose value is already set in `defaults`.
 *
 * @param {string} authorName
 * @param {Object} defaults   Values from parsed CLI flags
 * @returns {Promise<Object>} laravelConfig
 */
async function runPrompts(authorName, defaults = {}) {

  // Project name
  let projectName = defaults.projectName || null;
  if (!projectName) {
    const ans = await inquirer.prompt([{
      name: 'projectName',
      message: 'Project name:',
      validate: (input) => input.trim() ? true : 'Project name is required.',
      filter: (input) =>
        input.trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
    }]);
    projectName = ans.projectName;
  } else {
    projectName = projectName
      .trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Stack
  let stack = defaults.stack && ['api','web','full','minimal'].includes(defaults.stack)
    ? defaults.stack : null;
  if (!stack) {
    const ans = await inquirer.prompt([{
      name: 'stack',
      type: 'list',
      message: 'Choose a Laravel stack:',
      choices: [
        { name: 'API       — JSON API only, no frontend (default)',       value: 'api'     },
        { name: 'Web       — Blade views + full web routes',              value: 'web'     },
        { name: 'Full      — API + Blade/Inertia, auth ready',            value: 'full'    },
        { name: 'Minimal   — Bare Laravel install, you decide everything', value: 'minimal' }
      ],
      default: 'api'
    }]);
    stack = ans.stack;
  }

  // Frontend (skip for minimal/web-only stacks unless --frontend explicitly given)
  let frontend = defaults.frontend && ['none','react-vite','inertia'].includes(defaults.frontend)
    ? defaults.frontend : null;
  if (!frontend && stack !== 'minimal') {
    const ans = await inquirer.prompt([{
      name: 'frontend',
      type: 'list',
      message: 'Frontend setup:',
      choices: [
        { name: 'None          — API only',                                    value: 'none'       },
        { name: 'React (Vite)  — Decoupled SPA, Laravel as pure API',         value: 'react-vite' },
        { name: 'Inertia       — Server-driven SPA, tightly coupled',          value: 'inertia'    }
      ],
      default: 'none'
    }]);
    frontend = ans.frontend;
  } else if (!frontend) {
    frontend = 'none';
  }

  // Auth
  let auth = defaults.auth && ['sanctum','passport','none'].includes(defaults.auth)
    ? defaults.auth : null;
  if (!auth) {
    const ans = await inquirer.prompt([{
      name: 'auth',
      type: 'list',
      message: 'API authentication:',
      choices: [
        { name: 'Sanctum  — Token/session auth (recommended)',  value: 'sanctum'  },
        { name: 'Passport — Full OAuth2 server',                value: 'passport' },
        { name: 'None     — Add auth manually later',           value: 'none'     }
      ],
      default: 'sanctum'
    }]);
    auth = ans.auth;
  }

  // Database
  let db = defaults.db && ['mysql','pgsql','mongodb','sqlite'].includes(defaults.db)
    ? defaults.db : null;
  if (!db) {
    const ans = await inquirer.prompt([{
      name: 'db',
      type: 'list',
      message: 'Database driver:',
      choices: [
        { name: 'MySQL       (port 3306)',  value: 'mysql'   },
        { name: 'PostgreSQL  (port 5432)',  value: 'pgsql'   },
        { name: 'MongoDB     (port 27017)', value: 'mongodb' },
        { name: 'SQLite      (file-based)', value: 'sqlite'  }
      ],
      default: 'mysql'
    }]);
    db = ans.db;
  }

  // TypeScript (only if React frontend chosen)
  let ts = defaults.ts || false;
  if (!defaults.ts && (frontend === 'react-vite' || frontend === 'inertia')) {
    const ans = await inquirer.prompt([{
      name: 'ts',
      type: 'confirm',
      message: 'Use TypeScript for the React frontend?',
      default: false
    }]);
    ts = ans.ts;
  }

  // Extras (docker, ci, testing)
  // Skip checkbox if all three are explicitly set via flags, --yes, or --dry-run
  let docker  = defaults.docker  || false;
  let ci      = defaults.ci      || false;
  let testing = defaults.testing || false;

  // Skip the checkbox when any extra flag was explicitly passed — the user made their choices via flags
  const anyExtrasViaFlag = (defaults.docker === true || defaults.ci === true || defaults.testing === true);

  if (!defaults.yes && !defaults.dryRun && !anyExtrasViaFlag) {
    const extraChoices = [
      { name: 'Docker         (docker-compose.yml + Dockerfile)',     value: 'docker',  checked: !!defaults.docker  },
      { name: 'GitHub Actions CI/CD',                                  value: 'ci',      checked: !!defaults.ci      },
      { name: 'Pest testing   (HealthCheckTest + pest.xml)',           value: 'testing', checked: !!defaults.testing }
    ];

    const { extras } = await inquirer.prompt([{
      name: 'extras',
      type: 'checkbox',
      message: 'Include extras:',
      choices: extraChoices
    }]);

    docker  = extras.includes('docker');
    ci      = extras.includes('ci');
    testing = extras.includes('testing');
  }

  return {
    projectName, authorName,
    mode: 'laravel',
    stack, frontend, auth, db, ts,
    docker, ci, testing,
    noGit:   defaults.noGit   || false,
    dryRun:  defaults.dryRun  || false,
    verbose: defaults.verbose || false,
  };
}

module.exports = { runPrompts };
