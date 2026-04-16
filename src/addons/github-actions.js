'use strict';

const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');
const CiGenerator = require('../services/CiGenerator');

/**
 * Add GitHub Actions CI workflow to an existing project.
 * Must be run from inside the project root.
 */
async function run(cli = {}) {
  const cwd = process.cwd();
  const ciPath = path.join(cwd, '.github', 'workflows', 'ci.yml');

  if (fs.existsSync(ciPath)) {
    console.log(chalk.yellow('\n⚠  .github/workflows/ci.yml already exists.\n'));
    process.exit(0);
  }

  const isLaravel = fs.existsSync(path.join(cwd, 'artisan'));
  const projectName = path.basename(cwd);

  CiGenerator.generate(cwd, { projectName, db: 'mysql', frontend: 'none' }, isLaravel ? 'laravel' : 'php');

  console.log(chalk.green('\n✔  .github/workflows/ci.yml written.\n'));
}

module.exports = { run };
