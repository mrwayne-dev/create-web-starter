'use strict';

const path = require('path');
const fs   = require('fs');
const https = require('https');
const AdmZip = require('adm-zip');
const chalk  = require('chalk');

async function downloadPhosphorIcons(projectPath) {
  console.log(chalk.dim('\n  Downloading Phosphor Icons...'));

  const iconsDir   = path.join(projectPath, 'assets', 'icons');
  const zipPath    = path.join(projectPath, 'phosphor-icons.zip');
  const downloadUrl = 'https://github.com/phosphor-icons/core/archive/refs/heads/main.zip';

  return new Promise((resolve) => {
    const file = fs.createWriteStream(zipPath);

    const handleRedirect = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          handleRedirect(response.headers.location);
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          extractPhosphorIcons(zipPath, iconsDir);
          resolve();
        });
      }).on('error', () => {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        console.log(chalk.yellow('  [!] Could not download Phosphor Icons. Add them manually from https://phosphoricons.com'));
        resolve();
      });
    };

    https.get(downloadUrl, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(zipPath);
        handleRedirect(response.headers.location);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        extractPhosphorIcons(zipPath, iconsDir);
        resolve();
      });
    }).on('error', () => {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      console.log(chalk.yellow('  [!] Could not download Phosphor Icons. Add them manually from https://phosphoricons.com'));
      resolve();
    });
  });
}

function extractPhosphorIcons(zipPath, targetDir) {
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(targetDir, true);
    fs.unlinkSync(zipPath);
    console.log(chalk.green('  [ok] Phosphor Icons extracted to assets/icons/'));
  } catch {
    console.log(chalk.yellow('  [!] Error extracting icons. Add them manually from https://phosphoricons.com'));
  }
}

module.exports = { downloadPhosphorIcons, extractPhosphorIcons };
