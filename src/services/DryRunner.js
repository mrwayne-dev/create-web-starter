'use strict';

const chalk = require('chalk');

/**
 * DryRunner — collect planned actions instead of executing them.
 * Usage:
 *   const dry = new DryRunner(config.dryRun);
 *   dry.exec('composer create-project laravel/laravel my-app', 'create Laravel project');
 *   dry.write('my-app/.env', 'Write .env from stub');
 *   dry.mkdir('my-app/app/Services', 'Create Services dir');
 *   dry.finish();  // prints plan and exits
 */
class DryRunner {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.actions = [];
  }

  exec(cmd, label) {
    if (!this.enabled) return false;
    this.actions.push({ type: 'run',    label: label || cmd });
    return true;
  }

  write(filePath, label) {
    if (!this.enabled) return false;
    this.actions.push({ type: 'write',  label: label || filePath });
    return true;
  }

  mkdir(dirPath, label) {
    if (!this.enabled) return false;
    this.actions.push({ type: 'create', label: label || dirPath });
    return true;
  }

  install(packages, label) {
    if (!this.enabled) return false;
    this.actions.push({ type: 'install', label: label || packages.join(', ') });
    return true;
  }

  finish() {
    if (!this.enabled) return;
    console.log(chalk.bold.yellow('\n[dry-run] Planned actions:\n'));
    for (const a of this.actions) {
      const prefix = {
        run:     chalk.cyan('[dry-run] Would run:    '),
        write:   chalk.green('[dry-run] Would write:  '),
        create:  chalk.blue('[dry-run] Would create: '),
        install: chalk.magenta('[dry-run] Would install:'),
      }[a.type] || '[dry-run]';
      console.log(`${prefix} ${a.label}`);
    }
    console.log(chalk.dim('\nNothing was written to disk.\n'));
    process.exit(0);
  }
}

module.exports = DryRunner;
