'use strict';

const shell = require('shelljs');
const chalk = require('chalk');

const CHECKS = {
  php:      { label: 'PHP',      url: 'https://www.php.net/downloads'   },
  composer: { label: 'Composer', url: 'https://getcomposer.org'         },
  git:      { label: 'Git',      url: 'https://git-scm.com'             },
  node:     { label: 'Node.js',  url: 'https://nodejs.org'              },
};

/**
 * Check that required tools are in PATH.
 * Exits with a helpful error if any are missing.
 *
 * @param {string[]} required  Keys from CHECKS (default: ['php','composer','git'])
 */
function run(required = ['php', 'composer', 'git']) {
  const missing = [];

  for (const key of required) {
    if (!shell.which(key)) {
      missing.push(CHECKS[key]);
    }
  }

  if (missing.length === 0) return;

  console.error(chalk.red.bold('\n✖  Missing required dependencies:\n'));
  for (const dep of missing) {
    console.error(chalk.red(`   ${dep.label}: ${dep.url}`));
  }
  console.error('');
  process.exit(1);
}

module.exports = { run };
