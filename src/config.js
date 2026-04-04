'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const inquirer = require('inquirer').default;

const configPath = path.join(os.homedir(), '.webstarterrc.json');

function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath));
  }
  return { authorName: null, composerPath: null };
}

function saveConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

async function getAuthorName(config) {
  if (config.authorName) return config.authorName;

  const ans = await inquirer.prompt([
    {
      name: 'authorName',
      message: '✨ Your name (creator of projects):',
      validate: (input) => input ? true : 'Name cannot be empty.'
    }
  ]);

  config.authorName = ans.authorName;
  saveConfig(config);
  return ans.authorName;
}

module.exports = { loadConfig, saveConfig, getAuthorName };
