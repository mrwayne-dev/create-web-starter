'use strict';

const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');
const ora   = require('ora');
const { exec }     = require('../services/PackageInstaller');
const { applyTokens } = require('../services/EnvConfigurator');

const STUB_DIR = path.join(__dirname, '..', 'stubs', 'laravel');

/**
 * Add Pest testing to an existing Laravel project.
 * Must be run from inside the Laravel project root.
 */
async function run(cli = {}) {
  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'artisan'))) {
    console.error(chalk.red('\n[!] Not inside a Laravel project (artisan not found).\n'));
    process.exit(1);
  }

  const s = ora('Installing Pest…').start();
  try {
    exec(`composer require pestphp/pest pestphp/pest-plugin-laravel --dev --working-dir="${cwd}"`, 'install pest', !cli.verbose);
    exec(`php artisan vendor:publish --provider="Pest\\Laravel\\PestServiceProvider"`, 'publish pest', !cli.verbose);
    s.succeed('Pest installed.');
  } catch (e) {
    s.fail(`Failed: ${e.message}`);
    process.exit(1);
  }

  // Write HealthCheckTest if health route exists
  const featuresDir = path.join(cwd, 'tests', 'Feature');
  const testPath    = path.join(featuresDir, 'HealthCheckTest.php');

  if (!fs.existsSync(testPath)) {
    fs.mkdirSync(featuresDir, { recursive: true });
    fs.copyFileSync(path.join(STUB_DIR, 'pest-healthcheck.stub'), testPath);
    console.log(chalk.green('✔  HealthCheckTest.php written.'));
  }

  console.log(chalk.dim('\n  Run: php artisan test\n'));
}

module.exports = { run };
