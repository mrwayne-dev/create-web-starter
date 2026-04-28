'use strict';

const fs   = require('fs');
const path = require('path');

const DB_PORTS = { mysql: '3306', pgsql: '5432', mongodb: '27017', sqlite: '' };

/**
 * Write .env and .env.example from a template string.
 * Replaces {{TOKEN}} placeholders.
 *
 * @param {string} template   Template string with {{TOKEN}} placeholders
 * @param {Object} tokens     Key-value map of replacements
 * @param {string} destDir    Directory to write into
 */
function writeEnvFiles(template, tokens, destDir) {
  const content = applyTokens(template, tokens);
  fs.writeFileSync(path.join(destDir, '.env'),         content);
  fs.writeFileSync(path.join(destDir, '.env.example'), content);
}

function applyTokens(template, tokens) {
  let out = template;
  for (const [key, value] of Object.entries(tokens)) {
    out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return out;
}

function dbPort(db) {
  return DB_PORTS[db] ?? '3306';
}

function dbName(projectName) {
  return projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

module.exports = { writeEnvFiles, applyTokens, dbPort, dbName };
