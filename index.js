#!/usr/bin/env node
'use strict';

const chalk = require('chalk');

const { loadConfig, getAuthorName } = require('./src/config');
const { runPrompts }                = require('./src/prompts');
const { createProject }             = require('./src/scaffold');

async function start() {
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold('   create-web-starter  v2.0.0        ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════╝\n'));

  const appConfig  = loadConfig();
  const authorName = await getAuthorName(appConfig);
  const projectConfig = await runPrompts(authorName);

  await createProject(projectConfig, appConfig);
}

start().catch((err) => {
  console.error(chalk.red('\n❌ Unexpected error:'), err.message);
  process.exit(1);
});
