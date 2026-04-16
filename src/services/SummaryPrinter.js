'use strict';

const chalk = require('chalk');

const DB_LABEL       = { mysql: 'MySQL (port 3306)', pgsql: 'PostgreSQL (port 5432)', mongodb: 'MongoDB (port 27017)', sqlite: 'SQLite' };
const AUTH_LABEL     = { sanctum: 'Sanctum', passport: 'Passport', none: 'None', yes: 'Session-based', no: 'None' };
const FRONTEND_LABEL = { 'react-vite': 'React (Vite)', inertia: 'React + Inertia', none: 'None (API only)' };

// Strip ANSI escape codes to get the real printable width of a string.
// Avoids adding a dependency for this one utility.
const ANSI_RE = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g;
function visibleLen(str) { return str.replace(ANSI_RE, '').length; }

/**
 * Pad a string on the right to `targetLen` visible characters.
 * Works correctly even when the string contains ANSI color codes.
 */
function padRight(str, targetLen) {
  const pad = targetLen - visibleLen(str);
  return pad > 0 ? str + ' '.repeat(pad) : str;
}

/**
 * Print a box-drawing summary after a successful scaffold.
 *
 * @param {Object} config   Project config
 * @param {string} mode     'laravel' | 'php'
 */
function print(config, mode) {
  const name  = config.projectName;
  const width = 45;
  const line  = '─'.repeat(width);

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

  const G = chalk.bold.green;
  const headerText = `   ${name} scaffolded successfully`;

  console.log(G(`\n ┌${line}┐`));
  console.log(G(' │') + padRight(chalk.bold(headerText), width) + G('│'));
  console.log(G(` ├${line}┤`));

  for (const [label, value] of rows) {
    const labelStr   = chalk.dim(label.padEnd(labelWidth));
    const rowContent = `   ${labelStr}  ${value}`;
    console.log(G(' │') + padRight(rowContent, width) + G('│'));
  }

  console.log(G(` ├${line}┤`));
  console.log(G(' │') + padRight(chalk.bold('  Next steps:'), width) + G('│'));

  const steps = nextSteps(config, mode);
  for (const step of steps) {
    const stepContent = chalk.cyan(`    ${step}`);
    console.log(G(' │') + padRight(stepContent, width) + G(' │'));
  }

  console.log(G(` └${line}┘\n`));
}

function nextSteps(config, mode) {
  const name = config.projectName;
  if (mode === 'laravel') {
    const steps = [
      `cd ${name}`,
      'cp .env.example .env',
      'php artisan key:generate',
    ];
    if (config.db !== 'sqlite') steps.push('php artisan migrate');
    if (config.frontend === 'react-vite') steps.push('cd frontend && npm install && npm run dev');
    else if (config.frontend === 'inertia') steps.push('npm install && npm run dev');
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
