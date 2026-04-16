'use strict';

const fs    = require('fs');
const path  = require('path');
const shell = require('shelljs');
const chalk = require('chalk');
const ora   = require('ora');
const inquirer = require('inquirer').default;

const { writeEnvFiles, applyTokens, dbPort, dbName } = require('../services/EnvConfigurator');
const { init: gitInit }    = require('../services/GitInitializer');
const { composerRequire, exec } = require('../services/PackageInstaller');
const DockerGenerator      = require('../services/DockerGenerator');
const CiGenerator          = require('../services/CiGenerator');
const TestingSetup         = require('../services/TestingSetup');
const DryRunner            = require('../services/DryRunner');
const { print: printSummary } = require('../services/SummaryPrinter');
const { offerPresetSave }  = require('../config');

const STUB_DIR = path.join(__dirname, '..', 'stubs', 'laravel');

// ── Safety helpers ───────────────────────────────────────────────────────────

/**
 * Validate that targetPath is a direct child of baseDir (no path traversal).
 * Throws if validation fails.
 */
function assertSafePath(targetPath, baseDir) {
  const resolved = path.resolve(targetPath);
  const base     = path.resolve(baseDir);
  if (resolved === base || !resolved.startsWith(base + path.sep)) {
    throw new Error(`Unsafe project path "${targetPath}" — must be a direct subdirectory.`);
  }
}

/**
 * Delete a directory only if it is confirmed to be within baseDir.
 * Never passes user-controlled strings to rm -rf without this guard.
 */
function safeRmRf(targetPath, baseDir) {
  assertSafePath(targetPath, baseDir);
  shell.rm('-rf', targetPath);
}

// ── DB connection map ────────────────────────────────────────────────────────

const DB_CONNECTION = { mysql: 'mysql', pgsql: 'pgsql', mongodb: 'mongodb', sqlite: 'sqlite' };

// ── Package map ──────────────────────────────────────────────────────────────

function getComposerPackages(config) {
  const packages = [];
  const devPackages = [];

  if (config.auth === 'sanctum')  packages.push('laravel/sanctum');
  if (config.auth === 'passport') packages.push('laravel/passport');

  if (config.db === 'mongodb') packages.push('mongodb/laravel-mongodb');

  if (['api', 'full'].includes(config.stack)) {
    packages.push('darkaonline/l5-swagger', 'spatie/laravel-data');
  }

  if (config.frontend === 'inertia') {
    packages.push('inertiajs/inertia-laravel', 'tightenco/ziggy');
  }

  if (config.testing) {
    devPackages.push('pestphp/pest', 'pestphp/pest-plugin-laravel');
  }

  return { packages, devPackages };
}

// ── Helper to write a stub file ──────────────────────────────────────────────

function writeStub(stubName, destPath, tokens = {}) {
  const stubPath = path.join(STUB_DIR, stubName);
  if (!fs.existsSync(stubPath)) {
    throw Object.assign(new Error(`Missing stub file: ${stubName}`), { step: `write ${stubName}` });
  }
  let content = fs.readFileSync(stubPath, 'utf8');
  if (Object.keys(tokens).length) {
    content = applyTokens(content, tokens);
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, content);
}

// ── .editorconfig + vscode ───────────────────────────────────────────────────

function writeDevFiles(projectDir, config) {
  const phpStubDir = path.join(__dirname, '..', 'stubs', 'php');

  // .editorconfig
  fs.copyFileSync(
    path.join(phpStubDir, 'editorconfig.stub'),
    path.join(projectDir, '.editorconfig')
  );

  // .vscode/extensions.json
  const vscodeDir = path.join(projectDir, '.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  let vsExt = fs.readFileSync(path.join(phpStubDir, 'vscode-extensions.stub'), 'utf8');

  const extras = [
    'onecentlin.laravel5-snippets',
    'amirmarmul.laravel-blade-vscode',
  ];
  if (config.frontend !== 'none') {
    extras.push('dbaeumer.vscode-eslint', 'esbenp.prettier-vscode');
  }
  vsExt = vsExt.replace('{{EXTRA_EXTENSIONS}}', extras.join('",\n    "'));
  fs.writeFileSync(path.join(vscodeDir, 'extensions.json'), vsExt);
}

// ── Health check route ───────────────────────────────────────────────────────

function addHealthRoute(projectDir) {
  const routeFile = path.join(projectDir, 'routes', 'api.php');
  if (!fs.existsSync(routeFile)) return;
  const existing = fs.readFileSync(routeFile, 'utf8');
  if (existing.includes('/health')) return;
  const healthRoute = `
Route::get('/health', function () {
    return response()->json(['success' => true, 'status' => 'ok', 'service' => config('app.name')]);
});
`;
  fs.appendFileSync(routeFile, healthRoute);
}

// ── Inertia blade layout ─────────────────────────────────────────────────────

function writeInertiaBladeLayout(projectDir, useTs) {
  const ext = useTs ? 'tsx' : 'jsx';
  const viewsDir = path.join(projectDir, 'resources', 'views');
  fs.mkdirSync(viewsDir, { recursive: true });
  fs.writeFileSync(path.join(viewsDir, 'app.blade.php'), `<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title inertia>{{ config('app.name', 'Laravel') }}</title>
    @routes
    @viteReactRefresh
    @vite(['resources/js/app.${ext}', "resources/js/Pages/{\\$page['component']}.${ext}"])
    @inertiaHead
</head>
<body class="antialiased">
    @inertia
</body>
</html>
`);
}

// ── TypeScript config for Inertia ────────────────────────────────────────────

function writeTsConfig(projectDir) {
  fs.writeFileSync(path.join(projectDir, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      target: 'ESNext',
      lib: ['ESNext', 'DOM'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      baseUrl: '.',
      paths: { '@/*': ['resources/js/*'] }
    },
    include: ['resources/js/**/*'],
    exclude: ['node_modules', 'public']
  }, null, 2));
}

// ── CORS config for react-vite ───────────────────────────────────────────────

function patchCors(projectDir) {
  const corsConfig = path.join(projectDir, 'config', 'cors.php');
  if (!fs.existsSync(corsConfig)) return;
  let content = fs.readFileSync(corsConfig, 'utf8');
  content = content.replace(
    "'allowed_origins' => ['*']",
    "'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:5173')]"
  );
  fs.writeFileSync(corsConfig, content);
}

// ── Main scaffold function ───────────────────────────────────────────────────

async function createProject(config, appConfig) {
  const dry = new DryRunner(config.dryRun);
  const projectName = config.projectName;
  const projectDir  = path.resolve(process.cwd(), projectName);

  // Belt-and-suspenders path safety check (sanitization in prompts is primary defence)
  assertSafePath(projectDir, process.cwd());

  // ── Dry run registration ────────────────────────────────────────────────
  if (config.dryRun) {
    dry.exec(`composer create-project laravel/laravel "${projectName}"`, 'Create Laravel project');

    const { packages, devPackages } = getComposerPackages(config);
    if (packages.length)    dry.install(packages,    'composer require (prod)');
    if (devPackages.length) dry.install(devPackages, 'composer require --dev (dev)');

    dry.write('.env', 'Write .env from stub');
    dry.exec('php artisan key:generate', 'Generate app key');

    dry.mkdir(`${projectName}/app/Services`,      'Create Services dir');
    dry.mkdir(`${projectName}/app/Repositories`,  'Create Repositories dir');
    dry.mkdir(`${projectName}/app/Traits`,         'Create Traits dir');
    dry.mkdir(`${projectName}/app/Enums`,          'Create Enums dir');

    dry.write('app/Traits/ApiResponse.php',           'Write ApiResponse trait');
    dry.write('app/Services/BaseService.php',         'Write BaseService');
    dry.write('app/Repositories/BaseRepository.php',  'Write BaseRepository');
    dry.write('app/Http/Controllers/BaseController.php', 'Write BaseController');
    dry.write('app/Http/Requests/BaseRequest.php',    'Write BaseRequest');
    dry.write('app/Exceptions/Handler.php',           'Write ExceptionHandler');

    if (config.frontend === 'react-vite') {
      dry.exec(`npm create vite@latest frontend -- --template react${config.ts ? '-ts' : ''}`, 'Scaffold Vite React frontend');
    }
    if (config.frontend === 'inertia') {
      dry.write('resources/js/app.jsx', 'Write Inertia app entry');
    }
    if (config.docker)  dry.write('docker-compose.yml + Dockerfile', 'Write Docker files');
    if (config.ci)      dry.write('.github/workflows/ci.yml',        'Write GitHub Actions CI');
    if (config.testing) dry.install(['pestphp/pest --dev'],           'Install Pest');

    dry.write('.editorconfig', 'Write .editorconfig');
    dry.write('.vscode/extensions.json', 'Write VS Code extensions');
    dry.write('pint.json', 'Write Pint config');

    if (!config.noGit) dry.exec('git init && git add -A && git commit', 'Initialize git repo');

    dry.finish();
    return;
  }

  // ── Collision check ─────────────────────────────────────────────────────
  if (fs.existsSync(projectDir)) {
    const { action } = await inquirer.prompt([{
      name: 'action', type: 'list',
      message: `A folder named "${projectName}" already exists. What do you want to do?`,
      choices: ['Overwrite it', 'Cancel']
    }]);
    if (action === 'Cancel') process.exit(0);
    safeRmRf(projectDir, process.cwd());
  }

  // ── Scaffold ─────────────────────────────────────────────────────────────
  try {
    const spinner = ora(`Creating Laravel project: ${chalk.bold(projectName)}`).start();

    exec(
      `composer create-project laravel/laravel "${projectName}" --no-interaction`,
      'composer create-project',
      !config.verbose
    );
    spinner.succeed(`Laravel project created.`);

    // Write .env
    const envStub = fs.readFileSync(path.join(STUB_DIR, 'env.stub'), 'utf8');
    const dbNameStr = dbName(projectName);
    writeEnvFiles(envStub, {
      PROJECT_NAME:   projectName,
      DB_CONNECTION:  DB_CONNECTION[config.db] || 'mysql',
      DB_PORT:        dbPort(config.db),
      DB_DATABASE:    dbNameStr,
    }, projectDir);

    // Generate app key
    exec(`php "${projectDir}/artisan" key:generate --force`, 'key:generate', !config.verbose);

    // Install Composer packages
    const { packages, devPackages } = getComposerPackages(config);

    if (packages.length > 0) {
      const s2 = ora('Installing Composer packages…').start();
      try {
        composerRequire(packages, projectDir, { verbose: config.verbose });
        s2.succeed('Composer packages installed.');
      } catch (e) { s2.fail('Package install failed.'); throw e; }
    }

    if (devPackages.length > 0) {
      const s3 = ora('Installing dev packages…').start();
      try {
        composerRequire(devPackages, projectDir, { dev: true, verbose: config.verbose });
        s3.succeed('Dev packages installed.');
      } catch (e) { s3.fail('Dev package install failed.'); throw e; }
    }

    // Create directory structure
    const dirs = [
      'app/Services', 'app/Repositories', 'app/Traits',
      'app/Enums', 'app/Http/Requests'
    ];
    for (const d of dirs) {
      fs.mkdirSync(path.join(projectDir, d), { recursive: true });
    }

    // Write Laravel stubs
    writeStub('ApiResponse.stub',    path.join(projectDir, 'app', 'Traits',   'ApiResponse.php'));
    writeStub('BaseService.stub',    path.join(projectDir, 'app', 'Services', 'BaseService.php'));
    writeStub('BaseRepository.stub', path.join(projectDir, 'app', 'Repositories', 'BaseRepository.php'));
    writeStub('BaseController.stub', path.join(projectDir, 'app', 'Http', 'Controllers', 'BaseController.php'));
    writeStub('FormRequest.stub',    path.join(projectDir, 'app', 'Http', 'Requests',    'BaseRequest.php'));
    writeStub('ExceptionHandler.stub', path.join(projectDir, 'app', 'Exceptions', 'Handler.php'));
    writeStub('pint.stub',           path.join(projectDir, 'pint.json'));

    // Health check route
    addHealthRoute(projectDir);

    // SQLite: create database file
    if (config.db === 'sqlite') {
      fs.writeFileSync(path.join(projectDir, 'database', 'database.sqlite'), '');
    }

    // ── Frontend ──────────────────────────────────────────────────────────
    if (config.frontend === 'react-vite') {
      const s = ora('Scaffolding React (Vite) frontend…').start();
      try {
        const template = config.ts ? 'react-ts' : 'react';
        const prevDir  = shell.pwd().stdout;
        shell.cd(projectDir);
        exec(
          `npm create vite@latest frontend -- --template ${template}`,
          'vite scaffold',
          !config.verbose
        );
        shell.cd(prevDir);
        s.succeed('React (Vite) frontend scaffolded → frontend/');
        patchCors(projectDir);
        if (config.testing) TestingSetup.setupReact(path.join(projectDir, 'frontend'), config.ts);
      } catch (e) { s.fail('Vite scaffold failed.'); throw e; }
    }

    if (config.frontend === 'inertia') {
      const s = ora('Setting up Inertia + React…').start();
      try {
        const ext = config.ts ? 'tsx' : 'jsx';
        const appStub = config.ts ? 'inertia-app-ts.stub' : 'inertia-app.stub';
        const jsDir = path.join(projectDir, 'resources', 'js');
        fs.mkdirSync(jsDir, { recursive: true });
        writeStub(appStub, path.join(jsDir, `app.${ext}`));
        writeInertiaBladeLayout(projectDir, config.ts);
        if (config.ts) writeTsConfig(projectDir);

        // Install JS deps
        const npmPackages = config.ts
          ? ['@inertiajs/react', 'react', 'react-dom', 'typescript', '@types/react', '@types/react-dom']
          : ['@inertiajs/react', 'react', 'react-dom'];
        exec(`npm install ${npmPackages.join(' ')} --prefix "${projectDir}"`, 'npm install inertia', !config.verbose);
        s.succeed('Inertia + React set up.');
      } catch (e) { s.fail('Inertia setup failed.'); throw e; }
    }

    // ── Testing (Pest) ────────────────────────────────────────────────────
    if (config.testing) {
      const s = ora('Writing Pest health check test…').start();
      writeStub('pest-healthcheck.stub', path.join(projectDir, 'tests', 'Feature', 'HealthCheckTest.php'));
      s.succeed('Pest health check test written.');
    }

    // ── Docker ────────────────────────────────────────────────────────────
    if (config.docker) {
      const s = ora('Generating Docker files…').start();
      DockerGenerator.generateForLaravel(projectDir, config);
      s.succeed('Docker files written.');
    }

    // ── CI ────────────────────────────────────────────────────────────────
    if (config.ci) {
      const s = ora('Generating GitHub Actions workflow…').start();
      CiGenerator.generate(projectDir, config, 'laravel');
      s.succeed('CI workflow written.');
    }

    // ── Dev files (.editorconfig, .vscode) ───────────────────────────────
    writeDevFiles(projectDir, config);

    // ── Git ───────────────────────────────────────────────────────────────
    if (!config.noGit) {
      const s = ora('Initializing git…').start();
      try {
        gitInit(projectDir, config);
        s.succeed('Git initialized.');
      } catch (e) { s.warn('Git init failed — continuing anyway.'); }
    }

    // ── Summary ───────────────────────────────────────────────────────────
    printSummary(config, 'laravel');

    // ── Preset offer ──────────────────────────────────────────────────────
    await offerPresetSave(config, appConfig);

  } catch (err) {
    console.error(chalk.red(`\n✖  Scaffold failed: ${err.step || ''}`));
    console.error(chalk.dim(`   ${err.message}`));
    if (fs.existsSync(projectDir)) {
      try { safeRmRf(projectDir, process.cwd()); } catch (_) {}
      console.error(chalk.dim('   Partial project cleaned up.'));
    }
    process.exit(1);
  }
}

module.exports = { createProject };
