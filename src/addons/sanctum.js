'use strict';

const fs    = require('fs');
const path  = require('path');
const shell = require('shelljs');
const { exec } = require('../services/PackageInstaller');
const theme = require('../ui/theme');

/**
 * Add Laravel Sanctum to an existing Laravel project.
 * Must be run from inside the project root.
 */
async function run(cli = {}) {
  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'artisan'))) {
    console.error(theme.c.danger('\n[!] Not inside a Laravel project (artisan not found).\n'));
    process.exit(1);
  }

  if (fs.existsSync(path.join(cwd, 'vendor', 'laravel', 'sanctum'))) {
    console.log(theme.c.warn('\n⚠  Sanctum is already installed.\n'));
    process.exit(0);
  }

  const s = theme.spinner('sanctum').start();
  try {
    // Laravel 11+: `php artisan install:api` adds sanctum to composer.json, publishes
    // its migrations, and registers middleware. Try it first; fall back to manual flow.
    const installApi = shell.exec(`php artisan install:api --no-interaction`, { silent: !cli.verbose, cwd });
    if (installApi.code !== 0) {
      exec(
        `composer require laravel/sanctum --prefer-dist --no-audit --no-interaction --working-dir="${cwd}"`,
        'composer require sanctum',
        !cli.verbose
      );
      exec(`php artisan vendor:publish --tag=sanctum-config --no-interaction`,     'publish sanctum config',     !cli.verbose, cwd);
      exec(`php artisan vendor:publish --tag=sanctum-migrations --no-interaction`, 'publish sanctum migrations', !cli.verbose, cwd);
    }
    exec(`php artisan migrate --force --no-interaction`, 'migrate', !cli.verbose, cwd);
    s.succeed('Sanctum installed and migrated.');
  } catch (e) {
    s.fail(`Failed: ${e.message}`);
    process.exit(1);
  }

  console.log(theme.c.muted('\n  Next: add HasApiTokens to your User model and Sanctum middleware to api routes.\n'));
}

module.exports = { run };
