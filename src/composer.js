'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const https = require('https');
const shell = require('shelljs');
const inquirer = require('inquirer').default;
const chalk    = require('chalk');

const { saveConfig } = require('./config');

function buildComposerCmd(composerPath) {
  if (composerPath.toLowerCase().endsWith('.phar')) {
    return `php "${composerPath}"`;
  }
  if (composerPath === 'composer') return 'composer';
  return `"${composerPath}"`;
}

function findComposer(config) {
  if (config.composerPath && shell.test('-e', config.composerPath)) {
    const cmd = buildComposerCmd(config.composerPath);
    if (shell.exec(`${cmd} --version`, { silent: true }).code === 0) {
      return config.composerPath;
    }
    console.log(chalk.yellow('  [!] Saved composer path no longer works. Searching again...'));
    config.composerPath = null;
    saveConfig(config);
  }

  if (shell.which('composer')) return 'composer';

  const windowsPaths = [
    'C:\\ProgramData\\ComposerSetup\\bin\\composer.bat',
    'C:\\ProgramData\\ComposerSetup\\bin\\composer.exe',
    'C:\\Program Files\\Composer\\composer.bat',
    'C:\\Program Files\\Composer\\composer.exe',
    `${process.env.USERPROFILE}\\AppData\\Local\\ComposerSetup\\bin\\composer.bat`,
    `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Composer\\composer.bat`,
    'C:\\tools\\composer\\composer.bat',
    'C:\\ProgramData\\chocolatey\\bin\\composer.bat'
  ];

  for (const p of windowsPaths) {
    if (shell.test('-e', p)) return p;
  }

  const cachedPhar = path.join(os.homedir(), '.webstarter', 'composer.phar');
  if (shell.test('-e', cachedPhar) && shell.which('php')) {
    if (shell.exec(`php "${cachedPhar}" --version`, { silent: true }).code === 0) {
      return cachedPhar;
    }
  }

  return null;
}

async function downloadComposerPhar(config) {
  if (!shell.which('php')) {
    console.log(chalk.red('  [!] PHP is not in PATH. Install PHP first: https://www.php.net/downloads'));
    return null;
  }

  const cacheDir = path.join(os.homedir(), '.webstarter');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const pharPath = path.join(cacheDir, 'composer.phar');
  console.log(chalk.dim('  Downloading composer.phar to ' + pharPath + ' ...'));

  return new Promise((resolve) => {
    const file = fs.createWriteStream(pharPath);

    const doDownload = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          doDownload(response.headers.location);
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          if (shell.exec(`php "${pharPath}" --version`, { silent: true }).code === 0) {
            console.log(chalk.green('  [ok] Composer downloaded successfully.'));
            config.composerPath = pharPath;
            saveConfig(config);
            resolve(pharPath);
          } else {
            if (fs.existsSync(pharPath)) fs.unlinkSync(pharPath);
            console.log(chalk.yellow('  [!] Downloaded composer.phar appears invalid.'));
            resolve(null);
          }
        });
      }).on('error', () => {
        if (fs.existsSync(pharPath)) fs.unlinkSync(pharPath);
        console.log(chalk.yellow('  [!] Failed to download composer.phar.'));
        resolve(null);
      });
    };

    doDownload('https://getcomposer.org/composer-stable.phar');
  });
}

async function requestComposerPath(config) {
  const ans = await inquirer.prompt([
    {
      name: 'composerPath',
      message: 'Paste the full path to composer.exe / composer.phar:',
      validate: (input) => {
        if (!shell.test('-e', input.trim())) return 'File not found. Check the path and try again.';
        return true;
      }
    }
  ]);

  const p = ans.composerPath.trim();
  const cmd = buildComposerCmd(p);
  if (shell.exec(`${cmd} --version`, { silent: true }).code !== 0) {
    console.log(chalk.yellow('  [!] That path exists but composer failed to run with it.'));
    return null;
  }

  config.composerPath = p;
  saveConfig(config);
  return p;
}

function writeComposerJson(projectPath, projectName, authorName) {
  const packageName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const composerJson = {
    name: `${packageName}/${packageName}`,
    description: `${projectName} - PHP Web Application`,
    type: 'project',
    authors: [{ name: authorName }],
    require: { php: '>=7.4' },
    autoload: { 'psr-4': { 'App\\': 'src/' } },
    config: { 'optimize-autoloader': true }
  };

  fs.writeFileSync(
    path.join(projectPath, 'composer.json'),
    JSON.stringify(composerJson, null, 4)
  );
  console.log(chalk.dim('  composer.json created.'));
}

async function installPHPMailer(projectPath, config) {
  console.log(chalk.dim('\n  Preparing PHPMailer installation...'));

  let composerPath = findComposer(config);

  if (!composerPath) {
    console.log(chalk.yellow('\n  [!] Composer not found on your system.'));

    const { action } = await inquirer.prompt([
      {
        name: 'action',
        type: 'list',
        message: 'How would you like to proceed?',
        choices: [
          { name: 'Auto-download composer.phar (requires PHP in PATH)', value: 'auto'   },
          { name: 'I have composer — enter the path manually',           value: 'manual' },
          { name: 'Skip PHPMailer for now',                              value: 'skip'   }
        ]
      }
    ]);

    if (action === 'auto') {
      composerPath = await downloadComposerPhar(config);
    } else if (action === 'manual') {
      composerPath = await requestComposerPath(config);
    } else {
      console.log(chalk.dim('  Skipping PHPMailer. Install later: composer require phpmailer/phpmailer'));
      return;
    }

    if (!composerPath) {
      console.log(chalk.red('  [!] Could not find a working Composer. Skipping PHPMailer.'));
      console.log(chalk.dim('  Install Composer from: https://getcomposer.org/download/'));
      console.log(chalk.dim('  Then run inside the project: composer require phpmailer/phpmailer'));
      return;
    }
  }

  const composerCmd = buildComposerCmd(composerPath);
  console.log(chalk.dim('  Installing PHPMailer via Composer...'));

  const result = shell.exec(
    `${composerCmd} require phpmailer/phpmailer --working-dir="${projectPath}"`
  );

  if (result.code !== 0) {
    console.log(chalk.yellow('  [!] PHPMailer installation failed.'));
    console.log(chalk.dim('  Try manually: cd ' + projectPath + ' && composer require phpmailer/phpmailer'));
  } else {
    console.log(chalk.green('  [ok] PHPMailer installed successfully.'));
  }
}

module.exports = {
  buildComposerCmd, findComposer, downloadComposerPhar,
  requestComposerPath, writeComposerJson, installPHPMailer
};
