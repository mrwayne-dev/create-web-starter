'use strict';

const shell = require('shelljs');
const ora   = require('ora');

/**
 * Run a shell command, throwing on non-zero exit.
 * @param {string}  cmd
 * @param {string}  step    Label for error reporting
 * @param {boolean} silent
 * @param {string}  [cwd]   Working directory override
 */
// Default per-command watchdog. Anything genuinely taking longer than this is
// almost certainly a hung interactive prompt or a network stall — fail loudly
// instead of leaving the user staring at a spinner.
const DEFAULT_TIMEOUT_MS = 300000; // 5 min

function exec(cmd, step, silent = true, cwd = null, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const opts = {
    silent,
    timeout: timeoutMs,
    // Composer's solver can blow past PHP's default memory limit on big graphs
    // (Pest + Laravel 11 + sanctum + ...) and stall. -1 removes the cap.
    env: { ...process.env, COMPOSER_MEMORY_LIMIT: '-1' },
  };
  if (cwd) opts.cwd = cwd;
  const result = shell.exec(cmd, opts);
  if (result.code !== 0) {
    // Composer often writes errors to stdout, not stderr — fall back if stderr is empty
    const detail = (result.stderr || result.stdout || '').trim();
    const looksLikeTimeout = result.code === null || /timed out|ETIMEDOUT|killed/i.test(detail);
    throw Object.assign(
      new Error(looksLikeTimeout
        ? `Timed out after ${Math.round(timeoutMs / 1000)}s: ${cmd}`
        : (detail || `Command failed: ${cmd}`)),
      { step }
    );
  }
  return result;
}

/**
 * Run `composer require <packages...>` inside cwd.
 * @param {string[]} packages
 * @param {string}   cwd
 * @param {Object}   opts      { dev, verbose }
 */
function composerRequire(packages, cwd, opts = {}) {
  if (!packages || packages.length === 0) return;
  const devFlag        = opts.dev                                      ? ' --dev' : '';
  const withAllDeps    = opts.withAllDeps                              ? ' -W'    : '';
  const ignorePlatform = opts.ignorePlatformReqs && opts.ignorePlatformReqs.length
    ? ' ' + opts.ignorePlatformReqs.map(r => `--ignore-platform-req=${r}`).join(' ')
    : '';
  const cmd = `composer require ${packages.join(' ')}${devFlag}${withAllDeps}${ignorePlatform} --prefer-dist --no-audit --no-interaction --no-progress --working-dir="${cwd}"`;
  exec(cmd, `composer require ${packages[0]}`, !opts.verbose);
}

module.exports = { composerRequire, exec };
