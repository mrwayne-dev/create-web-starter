'use strict';

const theme = require('../ui/theme');
const { c } = theme;

const DB_LABEL       = { mysql: 'MySQL (port 3306)', pgsql: 'PostgreSQL (port 5432)', mongodb: 'MongoDB (port 27017)', sqlite: 'SQLite' };
const AUTH_LABEL     = { sanctum: 'Sanctum', passport: 'Passport', none: 'None', yes: 'Session-based', no: 'None' };
const FRONTEND_LABEL = { 'react-vite': 'React (Vite)', inertia: 'React + Inertia', none: 'None (API only)' };

/**
 * Print a Wayne-Manor-styled summary after a successful scaffold.
 *
 * @param {Object} config   Project config
 * @param {string} mode     'laravel' | 'php'
 */
function print(config, mode) {
  const name = config.projectName;

  const rows = [];
  rows.push(['Mode',    mode === 'laravel' ? 'Laravel' : 'Custom PHP']);
  if (mode === 'laravel') {
    rows.push(['Stack',    config.stack    || 'api']);
    rows.push(['Auth',     AUTH_LABEL[config.auth]            || config.auth     || 'None']);
    rows.push(['Database', DB_LABEL[config.db]                || config.db       || 'MySQL']);
    rows.push(['Frontend', FRONTEND_LABEL[config.frontend]    || config.frontend || 'None']);
    rows.push(['Docker',   config.docker  ? 'Yes' : 'No']);
    rows.push(['CI',       config.ci      ? 'GitHub Actions'  : 'No']);
    rows.push(['Testing',  config.testing ? 'Pest'            : 'No']);
  } else {
    rows.push(['Framework', config.framework          || 'vanilla']);
    rows.push(['Auth',      config.features?.auth     ? 'Yes' : 'No']);
    rows.push(['Database',  config.features?.database ? 'Yes' : 'No']);
    rows.push(['Admin',     config.features?.admin    ? 'Yes' : 'No']);
    rows.push(['PHPMailer', config.features?.phpMailer ? 'Yes' : 'No']);
  }
  rows.push(['Git', config.noGit ? 'Skipped' : 'Initialized, first commit']);

  const labelWidth = Math.max(...rows.map(r => r[0].length));
  const summary = rows
    .map(([k, v]) => `${c.muted(k.padEnd(labelWidth))}   ${v}`)
    .join('\n');

  const stepsBody = nextSteps(config, mode)
    .map(s => `  ${c.code(s)}`)
    .join('\n');

  const body = `${summary}\n\n${c.label('Next steps:')}\n${stepsBody}`;
  console.log(theme.successPanel(`${name} scaffolded successfully`, body));
}

function nextSteps(config, mode) {
  const name = config.projectName;
  if (mode === 'laravel') {
    const steps = [
      `cd ${name}`,
      'cp .env.example .env',
      'php artisan key:generate',
    ];
    steps.push('php artisan migrate');
    if (config.frontend === 'react-vite') steps.push('cd frontend && npm run dev');
    else if (config.frontend === 'inertia') steps.push('npm run dev');
    steps.push('php artisan serve');
    if (config.docker) steps.push('# or: docker-compose up -d');
    return steps;
  }
  // PHP mode
  const steps = [`cd ${name}`];
  if (config.features?.database) steps.push('mysql -u root -p < database/database.sql');
  steps.push('cp .env.example .env  # fill in credentials');
  if (config.features?.phpMailer) steps.push('composer install');
  steps.push('php -S localhost:8000');
  return steps;
}

module.exports = { print };
