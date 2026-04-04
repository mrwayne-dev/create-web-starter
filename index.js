#!/usr/bin/env node
'use strict';

const chalk = require('chalk');

const { loadConfig, getAuthorName } = require('./src/config');
const { runPrompts }                = require('./src/prompts');
const { createProject }             = require('./src/scaffold');

async function start() {
  console.log(chalk.bold.cyan('\n+------------------------------------------+'));
  console.log(chalk.bold.cyan('|') + chalk.bold('   create-php-starter  v1.1.0          ') + chalk.bold.cyan('|'));
  console.log(chalk.bold.cyan('|') + chalk.dim('   Project analysed by alfred, shipped from the batcave.') + chalk.bold.cyan(' |'));
  console.log(chalk.bold.cyan('+------------------------------------------+\n'));

  const appConfig  = loadConfig();
  const authorName = await getAuthorName(appConfig);
  const projectConfig = await runPrompts(authorName);

  await createProject(projectConfig, appConfig);
}

start().catch((err) => {
  console.error(chalk.red('\n[!] Unexpected error:'), err.message);
  process.exit(1);
});
