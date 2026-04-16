'use strict';

const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');
const ora   = require('ora');
const { exec } = require('../services/PackageInstaller');

/**
 * Add Laravel Sanctum to an existing Laravel project.
 * Must be run from inside the project root.
 */
async function run(cli = {}) {
  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'artisan'))) {
    console.error(chalk.red('\n[!] Not inside a Laravel project (artisan not found).\n'));
    process.exit(1);
  }

  if (fs.existsSync(path.join(cwd, 'vendor', 'laravel', 'sanctum'))) {
    console.log(chalk.yellow('\n⚠  Sanctum is already installed.\n'));
    process.exit(0);
  }

  const s = ora('Installing laravel/sanctum…').start();
  try {
    exec(`composer require laravel/sanctum --working-dir="${cwd}"`, 'composer require sanctum', !cli.verbose);
    exec(`php artisan vendor:publish --provider="Laravel\\Sanctum\\SanctumServiceProvider"`, 'publish sanctum', !cli.verbose);
    exec(`php artisan migrate`, 'migrate', !cli.verbose);
    s.succeed('Sanctum installed and migrated.');
  } catch (e) {
    s.fail(`Failed: ${e.message}`);
    process.exit(1);
  }

  console.log(chalk.dim('\n  Next: add HasApiTokens to your User model and Sanctum middleware to api routes.\n'));
}

module.exports = { run };
