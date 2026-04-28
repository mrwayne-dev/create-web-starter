'use strict';

const fs    = require('fs');
const path  = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer').default;
const DockerGenerator = require('../services/DockerGenerator');

/**
 * Add Docker files to an existing project.
 * Must be run from inside the project root.
 */
async function run(cli = {}) {
  const cwd = process.cwd();
  const isLaravel = fs.existsSync(path.join(cwd, 'artisan'));

  if (fs.existsSync(path.join(cwd, 'docker-compose.yml'))) {
    console.log(chalk.yellow('\n⚠  docker-compose.yml already exists.\n'));
    process.exit(0);
  }

  // Respect --db / --yes — only prompt when neither is provided.
  let db = ['mysql','pgsql','mongodb','sqlite'].includes(cli.db) ? cli.db : null;
  if (!db && cli.yes) db = 'mysql';
  if (!db) {
    const ans = await inquirer.prompt([{
      name: 'db',
      type: 'list',
      message: 'Database service to include in Docker:',
      choices: [
        { name: 'MySQL',      value: 'mysql'   },
        { name: 'PostgreSQL', value: 'pgsql'   },
        { name: 'MongoDB',    value: 'mongodb' },
        { name: 'None',       value: 'sqlite'  },
      ]
    }]);
    db = ans.db;
  }

  const projectName = path.basename(cwd);
  const config = { projectName, db };

  if (isLaravel) {
    DockerGenerator.generateForLaravel(cwd, config);
  } else {
    DockerGenerator.generateForPhp(cwd, config);
  }

  console.log(chalk.green('\n✔  Docker files written.\n'));
  console.log(chalk.dim('   docker-compose up -d\n'));
}

module.exports = { run };
