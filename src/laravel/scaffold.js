'use strict';

const fs    = require('fs');
const path  = require('path');
const shell = require('shelljs');
const chalk = require('chalk');
const ora   = require('ora');
const inquirer = require('inquirer').default;
const theme = require('../ui/theme');

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

// ── MongoDB config patch ─────────────────────────────────────────────────────

function patchMongoDbConfig(projectDir) {
  const configPath = path.join(projectDir, 'config', 'database.php');
  if (!fs.existsSync(configPath)) return;
  let content = fs.readFileSync(configPath, 'utf8');
  if (content.includes("'mongodb'")) return;

  const entry = `
        'mongodb' => [
            'driver'   => 'mongodb',
            'host'     => env('DB_HOST', '127.0.0.1'),
            'port'     => (int) env('DB_PORT', 27017),
            'database' => env('DB_DATABASE', 'laravel'),
            'username' => env('DB_USERNAME', ''),
            'password' => env('DB_PASSWORD', ''),
            'options'  => [],
        ],
`;
  // Anchor: 8-space ], closes the last connection entry; 4-space ], closes the connections array.
  // This pattern is stable across all Laravel 10/11 versions.
  const anchor = '\n        ],\n\n    ],\n';
  const insert = '\n        ],\n' + entry + '\n    ],\n';
  if (content.includes(anchor)) {
    content = content.replace(anchor, insert);
  }
  fs.writeFileSync(configPath, content);
}

// ── Package map ──────────────────────────────────────────────────────────────

function getComposerPackages(config) {
  const packages = [];
  const devPackages = [];
  // Installed separately with --ignore-platform-req=ext-mongodb
  const mongoPackages = config.db === 'mongodb' ? ['mongodb/laravel-mongodb'] : [];

  if (config.auth === 'sanctum')  packages.push('laravel/sanctum');
  if (config.auth === 'passport') packages.push('laravel/passport');

  if (['api', 'full'].includes(config.stack)) {
    packages.push('darkaonline/l5-swagger', 'spatie/laravel-data');
  }

  if (config.frontend === 'inertia') {
    packages.push('inertiajs/inertia-laravel', 'tightenco/ziggy');
  }

  return { packages, devPackages, mongoPackages };
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
  const routeFile  = path.join(projectDir, 'routes', 'api.php');
  const bootstrapApp = path.join(projectDir, 'bootstrap', 'app.php');

  // Laravel 11+ does not create routes/api.php by default — create and register it
  if (!fs.existsSync(routeFile)) {
    fs.mkdirSync(path.join(projectDir, 'routes'), { recursive: true });
    fs.writeFileSync(routeFile, `<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n`);

    // Register api.php in bootstrap/app.php (Laravel 11 withRouting pattern)
    if (fs.existsSync(bootstrapApp)) {
      let content = fs.readFileSync(bootstrapApp, 'utf8');
      if (!content.includes('api:') && content.includes('withRouting(')) {
        // Use plain string replace — the pattern is stable across Laravel versions
        content = content.replace(
          `web: __DIR__.'/../routes/web.php'`,
          `web: __DIR__.'/../routes/web.php',\n        api: __DIR__.'/../routes/api.php'`
        );
        fs.writeFileSync(bootstrapApp, content);
      }
    }
  }

  const existing = fs.readFileSync(routeFile, 'utf8');
  if (existing.includes('/health')) return;
  fs.appendFileSync(routeFile, `
Route::get('/health', function () {
    return response()->json(['success' => true, 'status' => 'ok', 'service' => config('app.name')]);
});
`);
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

// ── Vite config: add React plugin ────────────────────────────────────────────

function patchViteForReact(projectDir, useTs) {
  // Laravel always generates vite.config.js (not .ts), so check both
  const viteConfig = fs.existsSync(path.join(projectDir, 'vite.config.ts'))
    ? path.join(projectDir, 'vite.config.ts')
    : path.join(projectDir, 'vite.config.js');

  if (!fs.existsSync(viteConfig)) return;

  const ext = useTs ? 'tsx' : 'jsx';
  let content = fs.readFileSync(viteConfig, 'utf8');

  // Add @vitejs/plugin-react import
  if (!content.includes('@vitejs/plugin-react')) {
    content = content.replace(
      `import { defineConfig } from 'vite';`,
      `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';`
    );
  }

  // Add react() to plugins array before laravel()
  if (!content.includes('react()')) {
    content = content.replace(/plugins:\s*\[/, `plugins: [\n        react(),`);
  }

  // Update the JS entry point to the correct extension
  content = content.replace(`resources/js/app.js`, `resources/js/app.${ext}`);

  fs.writeFileSync(viteConfig, content);
}

// ── CORS config for react-vite ───────────────────────────────────────────────

function patchCors(projectDir, config = {}) {
  const corsConfig = path.join(projectDir, 'config', 'cors.php');
  // Laravel 11 does not ship config/cors.php by default — publish it first.
  if (!fs.existsSync(corsConfig)) {
    try {
      exec(
        `php "${projectDir}/artisan" config:publish cors --no-interaction`,
        'publish cors config',
        !config.verbose
      );
    } catch (_) { /* older Laravel — config already exists or publish unsupported */ }
  }
  if (!fs.existsSync(corsConfig)) return;
  let content = fs.readFileSync(corsConfig, 'utf8');
  content = content.replace(
    "'allowed_origins' => ['*']",
    "'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:5173')]"
  );
  fs.writeFileSync(corsConfig, content);
}

// ── Pest config (tests/Pest.php) ─────────────────────────────────────────────

function writeTestsPestPhp(projectDir) {
  const testsDir = path.join(projectDir, 'tests');
  fs.mkdirSync(testsDir, { recursive: true });
  const target = path.join(testsDir, 'Pest.php');
  if (fs.existsSync(target)) return; // composer post-install already created it
  const content = `<?php

uses(Tests\\TestCase::class)->in('Feature');
`;
  fs.writeFileSync(target, content);
}

// ── Inertia Welcome page + route ─────────────────────────────────────────────

function writeInertiaWelcomePage(projectDir, useTs) {
  const ext = useTs ? 'tsx' : 'jsx';
  const pagesDir = path.join(projectDir, 'resources', 'js', 'Pages');
  fs.mkdirSync(pagesDir, { recursive: true });
  const content = `export default function Welcome() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Welcome to Inertia</h1>
      <p>Edit <code>resources/js/Pages/Welcome.${ext}</code> to get started.</p>
    </div>
  );
}
`;
  fs.writeFileSync(path.join(pagesDir, `Welcome.${ext}`), content);
}

function patchInertiaWelcomeRoute(projectDir) {
  const webRoutes = path.join(projectDir, 'routes', 'web.php');
  if (!fs.existsSync(webRoutes)) return;
  let content = fs.readFileSync(webRoutes, 'utf8');
  if (!content.includes("return view('welcome')")) return;

  if (!content.includes('use Inertia\\Inertia;')) {
    content = content.replace(
      /use Illuminate\\Support\\Facades\\Route;/,
      `use Illuminate\\Support\\Facades\\Route;\nuse Inertia\\Inertia;`
    );
  }
  content = content.replace(
    "return view('welcome')",
    "return Inertia::render('Welcome')"
  );
  fs.writeFileSync(webRoutes, content);
}

// ── Main scaffold function ───────────────────────────────────────────────────

async function createProject(config, appConfig) {
  // Tell the theme about verbose mode so spinners stop animating once child
  // processes start streaming their own output to the terminal.
  theme.setVerbose(!!config.verbose);

  const dry = new DryRunner(config.dryRun);
  const projectName = config.projectName;
  const projectDir  = path.resolve(process.cwd(), projectName);

  // Belt-and-suspenders path safety check (sanitization in prompts is primary defence)
  assertSafePath(projectDir, process.cwd());

  // ── Dry run registration ────────────────────────────────────────────────
  if (config.dryRun) {
    dry.exec(`composer create-project laravel/laravel "${projectName}"`, 'Create Laravel project');

    const { packages, devPackages, mongoPackages } = getComposerPackages(config);
    if (packages.length)      dry.install(packages,      'composer require (prod)');
    if (devPackages.length)   dry.install(devPackages,   'composer require --dev (dev)');
    if (mongoPackages.length) dry.install(mongoPackages, 'composer require mongodb (--ignore-platform-req=ext-mongodb)');

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

    dry.write('routes/api.php', 'Add /health route');

    if (config.db === 'sqlite')  dry.write('database/database.sqlite',  'Create SQLite database file');
    if (config.db === 'mongodb') dry.write('config/database.php',       'Add mongodb connection entry');

    if (config.frontend === 'react-vite') {
      dry.exec(`npm create vite@latest frontend -- --template react${config.ts ? '-ts' : ''}`, 'Scaffold Vite React frontend');
      dry.exec('npm install (frontend)', 'Install frontend npm packages');
      dry.write('config/cors.php', 'Configure CORS allowed_origins for frontend');
    }
    if (config.frontend === 'inertia') {
      const ext = config.ts ? 'tsx' : 'jsx';
      dry.write(`resources/js/app.${ext}`, 'Write Inertia app entry');
      dry.write('resources/views/app.blade.php', 'Write Inertia blade layout');
      if (config.ts) dry.write('tsconfig.json', 'Write TypeScript config');
      dry.write(`resources/js/Pages/Welcome.${ext}`, 'Write Inertia Welcome page');
      dry.exec('patch routes/web.php', 'Swap welcome route to Inertia::render');
      dry.exec('npm install @inertiajs/react react react-dom @vitejs/plugin-react', 'Install Inertia npm packages');
      dry.exec('patch vite.config.js', 'Add React plugin to Vite config');
    }

    if (config.docker)  dry.write('docker-compose.yml + Dockerfile', 'Write Docker files');
    if (config.ci)      dry.write('.github/workflows/ci.yml',        'Write GitHub Actions CI');
    if (config.testing) {
      dry.install(['pestphp/pest', 'pestphp/pest-plugin-laravel', '--dev', '-W'], 'Install Pest (-W for phpunit downgrade)');
      dry.write('tests/Pest.php', 'Write tests/Pest.php');
      dry.write('tests/Feature/HealthCheckTest.php', 'Write Pest health check test');
    }

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
    const spinner = theme.spinner('create', { text: `Suiting up Laravel: ${chalk.bold(projectName)}` }).start();

    exec(
      `composer create-project laravel/laravel "${projectName}" --prefer-dist --no-audit --no-interaction --no-progress`,
      'composer create-project',
      !config.verbose
    );
    spinner.succeed(`Laravel project created.`);

    // Write .env
    const envStub = fs.readFileSync(path.join(STUB_DIR, 'env.stub'), 'utf8');
    // SQLite uses a file path; all other drivers use the project name as the database name.
    const dbDatabaseStr = config.db === 'sqlite' ? 'database/database.sqlite' : dbName(projectName);
    writeEnvFiles(envStub, {
      PROJECT_NAME:   projectName,
      DB_CONNECTION:  DB_CONNECTION[config.db] || 'mysql',
      DB_PORT:        dbPort(config.db),
      DB_DATABASE:    dbDatabaseStr,
    }, projectDir);

    // Generate app key
    exec(`php "${projectDir}/artisan" key:generate --force`, 'key:generate', !config.verbose);

    // Install Composer packages
    const { packages, devPackages, mongoPackages } = getComposerPackages(config);

    // Combine prod + mongo into one composer require — saves a full solver run when
    // both are needed. --ignore-platform-req=ext-mongodb is harmless when no mongo
    // package is in the list, but we only pass it when actually needed.
    const allProd = [...packages, ...mongoPackages];
    if (allProd.length > 0) {
      const s2 = theme.spinner('composer').start();
      try {
        composerRequire(allProd, projectDir, {
          verbose: config.verbose,
          ignorePlatformReqs: mongoPackages.length > 0 ? ['ext-mongodb'] : [],
        });
        s2.succeed('Composer packages installed.');
      } catch (e) { s2.fail('Package install failed.'); throw e; }
    }

    if (devPackages.length > 0) {
      const s3 = theme.spinner('composer').start();
      try {
        composerRequire(devPackages, projectDir, { dev: true, verbose: config.verbose });
        s3.succeed('Dev packages installed.');
      } catch (e) { s3.fail('Dev package install failed.'); throw e; }
    }

    // Pest is installed separately. We drop --prefer-dist here because -W (update all deps)
    // needs flexibility to resolve intermediate package versions.
    if (config.testing) {
      const s4 = theme.spinner('pest').start();
      try {
        // -W (withAllDeps) is load-bearing: recent Laravel 11.x ships PHPUnit
        // ^12 but Pest 3 hard-requires PHPUnit ^11. Without it Composer can't
        // downgrade phpunit and aborts. Pest left unpinned so a future Pest 4
        // (PHPUnit 12 native) gets picked up automatically.
        //
        // ignorePlatformReqs: -W re-solves every dep, including mongo. If
        // mongodb/laravel-mongodb was installed earlier, we MUST carry the
        // ext-mongodb ignore through here too — otherwise the platform check
        // fails on dev machines without the PHP mongo extension.
        //
        // `pest --init` is skipped because it's interactive under silent
        // shelljs — we write tests/Pest.php ourselves.
        composerRequire(
          ['pestphp/pest', 'pestphp/pest-plugin-laravel'],
          projectDir,
          {
            dev: true,
            withAllDeps: true,
            ignorePlatformReqs: config.db === 'mongodb' ? ['ext-mongodb'] : [],
            verbose: config.verbose,
          }
        );
        writeTestsPestPhp(projectDir);
        s4.succeed('Pest installed.');
      } catch (e) {
        s4.fail('Pest install failed.');
        throw e;
      }
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

    // MongoDB: add connection entry to config/database.php
    if (config.db === 'mongodb') {
      patchMongoDbConfig(projectDir);
    }

    // ── Frontend ──────────────────────────────────────────────────────────
    if (config.frontend === 'react-vite') {
      const s = theme.spinner('vite').start();
      try {
        const template    = config.ts ? 'react-ts' : 'react';
        const frontendDir = path.join(projectDir, 'frontend');
        // Pin to create-vite v5 — v6+ added an interactive "install deps?" prompt that hangs under silent shelljs.
        // npx -y skips the "install create-vite?" confirmation.
        exec(
          `npx -y create-vite@5 frontend --template ${template}`,
          'vite scaffold',
          !config.verbose,
          projectDir
        );
        // create-vite scaffolds files but never installs deps — do it ourselves.
        exec(
          `npm install`,
          'npm install (frontend)',
          !config.verbose,
          frontendDir
        );
        s.succeed('React (Vite) frontend scaffolded → frontend/');
        patchCors(projectDir, config);
        if (config.testing) TestingSetup.setupReact(frontendDir, config.ts, 'src', { verbose: config.verbose });
      } catch (e) { s.fail('Vite scaffold failed.'); throw e; }
    }

    if (config.frontend === 'inertia') {
      const s = theme.spinner('inertia').start();
      try {
        const ext = config.ts ? 'tsx' : 'jsx';
        const appStub = config.ts ? 'inertia-app-ts.stub' : 'inertia-app.stub';
        const jsDir = path.join(projectDir, 'resources', 'js');
        fs.mkdirSync(jsDir, { recursive: true });
        writeStub(appStub, path.join(jsDir, `app.${ext}`));
        writeInertiaBladeLayout(projectDir, config.ts);
        if (config.ts) writeTsConfig(projectDir);

        // A default Welcome page so the app does not crash on first request.
        writeInertiaWelcomePage(projectDir, config.ts);
        patchInertiaWelcomeRoute(projectDir);

        // Install JS deps — @vitejs/plugin-react is required for Vite to compile JSX/TSX
        const npmPackages = config.ts
          ? ['@inertiajs/react', 'react', 'react-dom', '@vitejs/plugin-react', 'typescript', '@types/react', '@types/react-dom']
          : ['@inertiajs/react', 'react', 'react-dom', '@vitejs/plugin-react'];
        exec(`npm install ${npmPackages.join(' ')} --prefix "${projectDir}"`, 'npm install inertia', !config.verbose);

        // Patch vite.config.js to include react() plugin and correct entry extension
        patchViteForReact(projectDir, config.ts);

        s.succeed('Inertia + React set up.');

        // JS test scaffolding lives under resources/js/ for Inertia (no separate frontend dir)
        if (config.testing) TestingSetup.setupReact(projectDir, config.ts, 'resources/js', { verbose: config.verbose });
      } catch (e) { s.fail('Inertia setup failed.'); throw e; }
    }

    // ── Testing (Pest) ────────────────────────────────────────────────────
    if (config.testing) {
      const s = theme.spinner('pest', { text: 'Writing Pest health check test…' }).start();
      writeStub('pest-healthcheck.stub', path.join(projectDir, 'tests', 'Feature', 'HealthCheckTest.php'));
      s.succeed('Pest health check test written.');
    }

    // ── Docker ────────────────────────────────────────────────────────────
    if (config.docker) {
      const s = theme.spinner('docker').start();
      DockerGenerator.generateForLaravel(projectDir, config);
      s.succeed('Docker files written.');
    }

    // ── CI ────────────────────────────────────────────────────────────────
    if (config.ci) {
      const s = theme.spinner('ci').start();
      CiGenerator.generate(projectDir, config, 'laravel');
      s.succeed('CI workflow written.');
    }

    // ── Dev files (.editorconfig, .vscode) ───────────────────────────────
    writeDevFiles(projectDir, config);

    // ── Git ───────────────────────────────────────────────────────────────
    if (!config.noGit) {
      const s = theme.spinner('git').start();
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
    const cleaned = fs.existsSync(projectDir);
    if (cleaned) {
      try { safeRmRf(projectDir, process.cwd()); } catch (_) {}
    }
    const body = [
      chalk.bold(`Step:    `) + (err.step || 'unknown'),
      chalk.bold(`Reason:  `) + err.message,
      cleaned ? chalk.dim('Partial project cleaned up.') : '',
    ].filter(Boolean).join('\n');
    console.error('\n' + theme.failurePanel('Scaffold failed', body));
    process.exit(1);
  }
}

module.exports = { createProject };
