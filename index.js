#!/usr/bin/env node
'use strict';

const chalk   = require('chalk');
const path    = require('path');
const pkg     = require('./package.json');

const { parseArgs }     = require('./src/args');
const { run: preflight} = require('./src/preflight');
const { loadConfig, getAuthorName, savePreset, loadPreset } = require('./src/config');
const theme = require('./src/ui/theme');

// ── Update notifier ──────────────────────────────────────────────────────────
// Runs after all prompts complete to avoid readline conflicts
async function checkForUpdates() {
  try {
    const { default: updateNotifier } = await import('update-notifier');
    updateNotifier({ pkg }).notify();
  } catch (_) { /* update-notifier is non-critical — skip silently */ }
}

// ── Help text ────────────────────────────────────────────────────────────────
const HELP = `
${chalk.bold('create-php-starter')} v${pkg.version}

${chalk.bold('Usage:')}
  create-php-starter [project-name] [options]
  create-php-starter add <feature>

${chalk.bold('Core options:')}
  --mode        php | laravel                                     (default: prompts)
  --stack       vanilla | mvc | api          [php mode]
                api | web | full | minimal    [laravel mode]
  --frontend    none | react-vite | inertia  [laravel mode only]
  --auth        sanctum | passport | none    [laravel mode]
                yes | no                     [php mode]
  --db          mysql | pgsql | mongodb | sqlite                  (default: mysql)

${chalk.bold('Extra features:')}
  --docker      Include Docker setup (docker-compose.yml, Dockerfile)
  --ci          Include GitHub Actions CI/CD workflow
  --testing     Include testing setup (Pest / PHPUnit / Vitest)
  --ts          Use TypeScript for React frontend

${chalk.bold('Presets:')}
  --preset      Name of a saved preset from ~/.webstarterrc.json

${chalk.bold('Meta:')}
  --no-git      Skip git initialization
  --yes         Accept all defaults, skip optional prompts
  --dry-run     Show what would be created without writing anything
  --verbose     Print every shell command as it runs
  --version     Print version and exit
  --help        Print this message and exit

${chalk.bold('Add subcommand:')}
  create-php-starter add sanctum
  create-php-starter add docker
  create-php-starter add github-actions
  create-php-starter add pest

${chalk.bold('Examples:')}
  create-php-starter                                         # fully interactive
  create-php-starter my-app --mode=laravel --stack=api --db=pgsql --auth=sanctum
  create-php-starter my-app --mode=laravel --frontend=inertia --ts --docker --ci
  create-php-starter my-app --mode=php --stack=mvc --db=mysql
  create-php-starter my-app --preset=my-api
  create-php-starter my-app --mode=laravel --dry-run
`;

// ── Mode gate prompt ─────────────────────────────────────────────────────────
async function promptMode() {
  const inquirer = require('inquirer').default;
  const { mode } = await inquirer.prompt([{
    name: 'mode',
    type: 'list',
    message: 'What kind of project are you scaffolding?',
    choices: [
      { name: 'Custom PHP  — Vanilla / MVC / API  (raw PHP, no framework)', value: 'php'     },
      { name: 'Laravel     — Framework-based app with optional React frontend', value: 'laravel' }
    ]
  }]);
  return mode;
}

// ── Entry point ──────────────────────────────────────────────────────────────
async function start() {
  const cli = parseArgs();

  // Meta flags — early exit
  if (cli.version) {
    console.log(pkg.version);
    process.exit(0);
  }
  if (cli.help) {
    console.log(HELP);
    process.exit(0);
  }

  // add subcommand
  if (cli.isAdd) {
    const VALID_ADDONS = ['sanctum', 'docker', 'github-actions', 'pest'];
    if (!cli.addFeature || !VALID_ADDONS.includes(cli.addFeature)) {
      console.error(chalk.red(
        cli.addFeature
          ? `\n[!] Unknown addon: "${cli.addFeature}"`
          : '\n[!] Usage: create-php-starter add <feature>'
      ));
      console.error(chalk.dim('    Available: ' + VALID_ADDONS.join(', ')));
      process.exit(1);
    }
    // addonPath is safe — cli.addFeature is whitelisted above
    const addonPath = path.join(__dirname, 'src', 'addons', `${cli.addFeature}.js`);
    try {
      const addon = require(addonPath);
      await addon.run(cli);
    } catch (e) {
      console.error(chalk.red(`\n[!] ${e.message}`));
      process.exit(1);
    }
    return;
  }

  // Load config early so authorName is available for the banner
  const appConfig = loadConfig();
  const savedName = appConfig.authorName || null;

  await theme.playBatAnimation();
  console.log(theme.banner(pkg.version, savedName, appConfig.presets));

  // Preset shortcut
  if (cli.preset) {
    const preset = loadPreset(cli.preset, appConfig);
    if (!preset) {
      console.error(chalk.red(`\n[!] Preset "${cli.preset}" not found in ~/.webstarterrc.json\n`));
      process.exit(1);
    }
    const authorName = await getAuthorName(appConfig);
    const merged = { ...preset, ...cli, projectName: cli.projectName || preset.projectName, authorName };
    if (!merged.mode) merged.mode = 'php'; // fallback if preset predates mode field

    if (merged.mode === 'laravel') {
      preflight(['php', 'composer', 'git', 'node']);
      const { createProject } = require('./src/laravel/scaffold');
      await createProject(merged, appConfig);
    } else {
      preflight(['php', 'composer', 'git']);
      const { createProject } = require('./src/php/scaffold');
      await createProject(merged, appConfig);
    }
    return;
  }

  // Determine mode
  let mode = cli.mode;
  if (!mode) {
    mode = await promptMode();
  }

  const authorName = await getAuthorName(appConfig);

  if (mode === 'laravel') {
    preflight(['php', 'composer', 'git', 'node']);
    const { runPrompts }    = require('./src/laravel/prompts');
    const { createProject } = require('./src/laravel/scaffold');

    const projectConfig = await runPrompts(authorName, cli);
    await createProject(projectConfig, appConfig);

  } else {
    preflight(['php', 'composer', 'git']);
    const { runPrompts }    = require('./src/php/prompts');
    const { createProject } = require('./src/php/scaffold');

    const projectConfig = await runPrompts(authorName, cli);
    await createProject(projectConfig, appConfig);
  }
}

start()
  .then(() => checkForUpdates())
  .catch((err) => {
    console.error('\n' + theme.failurePanel('Unexpected error', err.message));
    if (process.env.DEBUG) console.error(err.stack);
    process.exit(1);
  });
