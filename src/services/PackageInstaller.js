'use strict';

const shell = require('shelljs');
const ora   = require('ora');

/**
 * Run a shell command, throwing on non-zero exit.
 * @param {string}  cmd
 * @param {string}  step    Label for error reporting
 * @param {boolean} silent
 * @param {string}  [cwd]   Working directory override
 */
function exec(cmd, step, silent = true, cwd = null) {
  const opts = { silent };
  if (cwd) opts.cwd = cwd;
  const result = shell.exec(cmd, opts);
  if (result.code !== 0) {
    throw Object.assign(
      new Error(result.stderr || `Command failed: ${cmd}`),
      { step }
    );
  }
  return result;
}

/**
 * Run `composer require <packages...>` inside cwd.
 * @param {string[]} packages
 * @param {string}   cwd
 * @param {Object}   opts      { dev, verbose }
 */
function composerRequire(packages, cwd, opts = {}) {
  if (!packages || packages.length === 0) return;
  const devFlag = opts.dev ? ' --dev' : '';
  const cmd = `composer require ${packages.join(' ')}${devFlag} --working-dir="${cwd}"`;
  exec(cmd, `composer require ${packages[0]}`, !opts.verbose);
}

/**
 * Run `npm install` inside cwd.
 */
function npmInstall(cwd, opts = {}) {
  exec(`npm install --prefix "${cwd}"`, 'npm install', !opts.verbose);
}

/**
 * Run `npm create vite@latest` for a React frontend.
 * @param {string} name     Name for the Vite app folder
 * @param {string} destDir  Parent directory to run the command in
 * @param {boolean} useTS
 * @param {Object} opts
 */
function createViteApp(name, destDir, useTS = false, opts = {}) {
  const template = useTS ? 'react-ts' : 'react';
  const cmd = `npm create vite@latest "${name}" -- --template ${template}`;
  exec(cmd, 'vite scaffold', !opts.verbose, destDir);
}

module.exports = { composerRequire, exec };
