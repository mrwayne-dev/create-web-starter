'use strict';

const minimist = require('minimist');

/**
 * Parse CLI arguments.
 * Returns a normalized config object consumed by index.js.
 *
 * Usage:
 *   create-php-starter [project-name] [flags]
 *   create-php-starter add <feature>
 */
function parseArgs() {
  const argv = minimist(process.argv.slice(2), {
    string:  ['mode', 'stack', 'frontend', 'auth', 'db', 'preset'],
    boolean: ['docker', 'ci', 'testing', 'ts', 'no-git', 'yes', 'dry-run', 'verbose', 'version', 'help'],
    alias: {
      v: 'version',
      h: 'help',
      y: 'yes',
    },
    default: {
      mode:     null,
      stack:    null,
      frontend: null,
      auth:     null,
      db:       null,
      preset:   null,
      docker:   false,
      ci:       false,
      testing:  false,
      ts:       false,
      'no-git': false,
      yes:      false,
      'dry-run': false,
      verbose:  false,
      version:  false,
      help:     false,
    }
  });

  // First positional arg is the project name (unless it's 'add')
  const positionals = argv._;
  const isAdd = positionals[0] === 'add';

  return {
    // Subcommand routing
    isAdd,
    addFeature: isAdd ? positionals[1] : null,

    // Core
    projectName: (!isAdd && positionals[0]) ? positionals[0] : null,
    mode:        normalizeMode(argv.mode),
    stack:       argv.stack    || null,
    frontend:    argv.frontend || null,
    auth:        argv.auth     || null,
    db:          argv.db       || null,
    preset:      argv.preset   || null,

    // Feature flags
    docker:  argv.docker,
    ci:      argv.ci,
    testing: argv.testing,
    ts:      argv.ts,

    // Meta
    noGit:   argv.git === false, // minimist turns --no-git into argv.git=false, not argv['no-git']=true
    yes:     argv.yes,
    dryRun:  argv['dry-run'],
    verbose: argv.verbose,
    version: argv.version,
    help:    argv.help,
  };
}

function normalizeMode(mode) {
  if (!mode) return null;
  const m = mode.toLowerCase();
  if (m === 'laravel' || m === 'l') return 'laravel';
  if (m === 'php' || m === 'p')     return 'php';
  return null;
}

module.exports = { parseArgs };
