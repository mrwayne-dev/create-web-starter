'use strict';

const shell = require('shelljs');

/**
 * Initialize a git repo and create the first commit.
 * Skipped if config.noGit is true.
 *
 * @param {string} projectDir  Absolute or relative path to the project folder
 * @param {Object} config      { noGit, verbose }
 */
function init(projectDir, config = {}) {
  if (config.noGit) return;

  const silent = !config.verbose;

  exec(`git -C "${projectDir}" init`, silent, 'git init');
  exec(`git -C "${projectDir}" add -A`, silent, 'git add');

  // Ensure git has a user identity for the commit (may be missing on fresh machines).
  // We set it locally on the repo so we never mutate the user's global config.
  const hasName  = shell.exec('git config --global user.name',  { silent: true }).code === 0;
  const hasEmail = shell.exec('git config --global user.email', { silent: true }).code === 0;

  if (!hasName) {
    exec(`git -C "${projectDir}" config user.name "create-php-starter"`, silent, 'git config user.name');
  }
  if (!hasEmail) {
    exec(`git -C "${projectDir}" config user.email "scaffold@create-php-starter.local"`, silent, 'git config user.email');
  }

  exec(`git -C "${projectDir}" commit -m "Initial commit"`, silent, 'git commit');
}

function exec(cmd, silent, step) {
  const result = shell.exec(cmd, { silent });
  if (result.code !== 0) {
    throw Object.assign(
      new Error(result.stderr || `Command failed: ${cmd}`),
      { step }
    );
  }
  return result;
}

module.exports = { init };
