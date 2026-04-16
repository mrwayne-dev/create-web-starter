'use strict';

const path = require('path');
const fs   = require('fs');
const os   = require('os');
const inquirer = require('inquirer').default;

const configPath = path.join(os.homedir(), '.webstarterrc.json');

function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath));
  }
  return { authorName: null, composerPath: null, presets: {} };
}

function saveConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

async function getAuthorName(config) {
  if (config.authorName) return config.authorName;

  const ans = await inquirer.prompt([
    {
      name: 'authorName',
      message: 'Your name (creator of projects):',
      validate: (input) => input.trim() ? true : 'Name cannot be empty.'
    }
  ]);

  config.authorName = ans.authorName;
  saveConfig(config);
  return ans.authorName;
}

/**
 * Save a named preset to ~/.webstarterrc.json
 * @param {string} name
 * @param {Object} presetData
 * @param {Object} config       The current loaded config object (mutated + saved)
 */
function savePreset(name, presetData, config) {
  if (!config.presets) config.presets = {};
  config.presets[name] = presetData;
  saveConfig(config);
}

/**
 * Load a named preset from config.
 * Returns null if not found.
 */
function loadPreset(name, config) {
  if (!config.presets) return null;
  return config.presets[name] || null;
}

/**
 * Prompt user to optionally save current run as a preset.
 */
async function offerPresetSave(projectConfig, appConfig) {
  const { save } = await inquirer.prompt([{
    name: 'save',
    type: 'confirm',
    message: 'Save these settings as a preset for next time?',
    default: false
  }]);
  if (!save) return;

  const { presetName } = await inquirer.prompt([{
    name: 'presetName',
    message: 'Preset name:',
    validate: (i) => i.trim() ? true : 'Name cannot be empty.'
  }]);

  // Strip runtime-only fields that should not be stored in a preset
  // eslint-disable-next-line no-unused-vars
  const { authorName: _a, projectName: _p, dryRun: _d, verbose: _v, noGit: _ng, ...rest } = projectConfig;
  savePreset(presetName.trim(), rest, appConfig);

  const chalk = require('chalk');
  console.log(chalk.green(`\n✔  Preset "${presetName}" saved to ~/.webstarterrc.json\n`));
}

module.exports = { loadConfig, saveConfig, getAuthorName, savePreset, loadPreset, offerPresetSave };
