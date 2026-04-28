'use strict';

const fs    = require('fs');
const path  = require('path');
const { exec }     = require('../services/PackageInstaller');
const { applyTokens } = require('../services/EnvConfigurator');
const theme = require('../ui/theme');

const STUB_DIR = path.join(__dirname, '..', 'stubs', 'laravel');

/**
 * Add Pest testing to an existing Laravel project.
 * Must be run from inside the Laravel project root.
 */
async function run(cli = {}) {
  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'artisan'))) {
    console.error(theme.c.danger('\n[!] Not inside a Laravel project (artisan not found).\n'));
    process.exit(1);
  }

  const s = theme.spinner('pest').start();
  try {
    // Detect mongo so we can carry the ext-mongodb platform-req ignore through
    // the -W re-solve. If we don't, dev machines without ext-mongodb will see
    // composer abort on an unrelated dep check.
    let hasMongo = false;
    try {
      const cj = JSON.parse(fs.readFileSync(path.join(cwd, 'composer.json'), 'utf8'));
      hasMongo = !!(cj.require && cj.require['mongodb/laravel-mongodb']);
    } catch (_) { /* missing or malformed composer.json — assume no mongo */ }

    // -W: Laravel 11.x ships PHPUnit ^12 but Pest 3 wants ^11, so Composer
    // must be allowed to downgrade phpunit. Pest left unpinned so a future
    // Pest 4 (PHPUnit 12 native) is picked automatically. `pest --init` is
    // skipped because it's interactive — we write tests/Pest.php ourselves.
    const ignoreMongo = hasMongo ? ' --ignore-platform-req=ext-mongodb' : '';
    exec(
      `composer require pestphp/pest pestphp/pest-plugin-laravel --dev -W --prefer-dist --no-audit --no-interaction --no-progress${ignoreMongo} --working-dir="${cwd}"`,
      'install pest',
      !cli.verbose
    );
    const pestFile = path.join(cwd, 'tests', 'Pest.php');
    if (!fs.existsSync(pestFile)) {
      fs.mkdirSync(path.dirname(pestFile), { recursive: true });
      fs.writeFileSync(pestFile, `<?php\n\nuses(Tests\\TestCase::class)->in('Feature');\n`);
    }
    s.succeed('Pest installed.');
  } catch (e) {
    s.fail(`Failed: ${e.message}`);
    process.exit(1);
  }

  // Ensure /api/health route exists before writing a test that depends on it.
  const routeFile = path.join(cwd, 'routes', 'api.php');
  if (!fs.existsSync(routeFile)) {
    fs.mkdirSync(path.join(cwd, 'routes'), { recursive: true });
    fs.writeFileSync(routeFile, `<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n`);
  }
  const routeContent = fs.readFileSync(routeFile, 'utf8');
  if (!routeContent.includes('/health')) {
    fs.appendFileSync(routeFile, `
Route::get('/health', function () {
    return response()->json(['success' => true, 'status' => 'ok', 'service' => config('app.name')]);
});
`);
  }

  const featuresDir = path.join(cwd, 'tests', 'Feature');
  const testPath    = path.join(featuresDir, 'HealthCheckTest.php');
  if (!fs.existsSync(testPath)) {
    fs.mkdirSync(featuresDir, { recursive: true });
    fs.copyFileSync(path.join(STUB_DIR, 'pest-healthcheck.stub'), testPath);
    console.log(theme.c.success('✔  HealthCheckTest.php written.'));
  }

  console.log(theme.c.muted('\n  Run: php artisan test\n'));
}

module.exports = { run };
