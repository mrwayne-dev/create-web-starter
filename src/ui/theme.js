'use strict';

/**
 * Theme + visual identity for create-php-starter.
 *
 * One file owns: colour tokens, the banner, success/failure boxes,
 * the spinner factory, and the Batman/Alfred verb pool used to label
 * each in-progress step.
 *
 * Other modules should NEVER call chalk/ora/boxen directly for visual
 * surfaces — they should call helpers here so the look stays cohesive.
 */

const chalk = require('chalk');
const ora   = require('ora');
const boxen = require('boxen');

// ── Colour tokens ────────────────────────────────────────────────────────────
// Soft cyan-blue accent borrowed from Claude Code's palette. Falls back to the
// nearest 256-colour on terminals without true-colour.
const accent = chalk.hex('#7AA2F7');
const bat    = chalk.hex('#FFD23F'); // Bat-signal yellow — used sparingly

const c = {
  accent,
  bat,
  success: chalk.green,
  warn:    chalk.yellow,
  danger:  chalk.red,
  muted:   chalk.dim,
  label:   chalk.bold.white,
  code:    chalk.cyan,
  bold:    chalk.bold,
};

// ── Verb pool — Batman / Alfred / Wayne Manor flavour ────────────────────────
// Each key maps to an array of cosmetic phrases used as the spinner text while
// that step is in progress. The phrase rotates randomly per run; the success
// label still reports what actually happened.
const VERBS = {
  composer: [
    'Patrolling Packagist',
    'Interrogating composer',
    'Scanning the dependency rooftops',
    'Following the Composer trail',
    'Briefing the dependency tree',
    'Cross-checking the package ledger',
  ],
  create: [
    'Suiting up Laravel',
    'Cape-checking laravel/laravel',
    'Briefing the framework',
    'Donning the Laravel cape',
    'Polishing the artisan binary',
    'Rolling out the Tumbler',
    'Warming up the Wayne workshop',
  ],
  npm: [
    'Recruiting node modules',
    'Calling in the JS cavalry',
    'Equipping the utility belt',
    'Wiring the package-lock',
    'Loading bat-modules',
    'Stocking the JS arsenal',
    'Issuing standard-issue gear',
  ],
  vite: [
    'Lighting the Bat-signal',
    'Booting Vite over Gotham',
    'Spooling up the Vite-mobile',
    'Tuning the Vite engine',
    'Warming the Bat-projector',
    'Powering the Wayne Tower beacon',
  ],
  pest: [
    'Hunting for bugs',
    'Setting traps in tests/',
    'Deploying Pest countermeasures',
    'Calibrating the bug-detector',
    'Sweeping the perimeter for vermin',
    'Recruiting Pest informants',
    'Sharpening the batarangs',
  ],
  docker: [
    'Containing the chaos',
    'Locking down the Batcave',
    'Reinforcing the bunker walls',
    'Sealing the Dockerfile vault',
    'Securing the container perimeter',
    'Sliding the cave doors shut',
  ],
  ci: [
    'Wiring the surveillance grid',
    'Activating Wayne Enterprises CI',
    'Programming the bat-computer',
    'Connecting the Watchtower',
    'Calibrating the Wayne CI pipeline',
    'Bringing the early-warning system online',
  ],
  git: [
    'Sealing the case file',
    'Committing to justice',
    'Filing the evidence',
    'Stamping the Wayne Foundation seal',
    "Logging the night's patrol",
    'Archiving the night in the case files',
  ],
  sanctum: [
    'Securing the perimeter',
    'Issuing API tokens at the door',
    'Patrolling the auth gates',
    'Forging Sanctum credentials',
    'Briefing the doormen',
    'Stationing guards at the API gate',
  ],
  inertia: [
    'Bridging Blade and React',
    'Wiring Inertia through the cape',
    'Linking the Inertia conduit',
    'Splicing server and client',
    'Threading the Inertia line',
  ],
  frontend: [
    'Outfitting the cowl',
    'Tightening the cape',
    'Stitching React into the suit',
    'Fitting the JSX armour',
  ],
  env: [
    'Inscribing the master ledger',
    'Sealing the .env vault',
    'Briefing Alfred on the environment',
  ],
  key: [
    'Forging the application key',
    'Casting a fresh APP_KEY',
    'Cutting a new master key',
  ],
  stubs: [
    'Polishing the base classes',
    'Drafting the case files',
    'Stocking the Batcave library',
  ],
  folders: [
    'Organising the Batcave',
    "Setting up Alfred's shelves",
    'Allocating storage in the cave',
  ],
  mongo: [
    'Wiring the Mongo case archive',
    'Spinning up the cold storage',
  ],
  routes: [
    'Mapping the patrol routes',
    'Charting the API corridors',
  ],
  vscode: [
    'Sharpening the tools',
    "Sorting Alfred's toolkit",
    'Stocking the workshop',
  ],
  migrate: [
    'Migrating the case files',
    'Translating the records',
  ],
  generic: [
    'Alfred is on it, sir',
    'The Bat is on the move',
    'Working under the cover of darkness',
    'Hold steady — Alfred has this',
    'On it, Master Wayne',
  ],
};

// ── Endings ──────────────────────────────────────────────────────────────────
const SUCCESS_LINES = [
  'Alfred has prepared your project, sir.',
  'The Batcave is at your disposal.',
  'Master Wayne, your project awaits.',
  "Shipped from the Batcave. Don't crash the Tumbler.",
];

const FAILURE_LINES = [
  'The Joker has interfered. Scaffold aborted.',
  'Alfred reports a setback, sir.',
  'A rogue dependency derailed the patrol.',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickVerb(key) {
  const pool = VERBS[key] || VERBS.generic;
  return pick(pool);
}

// ── Verbose-mode toggle ──────────────────────────────────────────────────────
// In verbose mode, child processes stream their stdout to the terminal. If we
// also animate a spinner on the same line, the two writers collide. Callers
// flip this once at the top of a scaffold; spinner() reads it and disables
// animation accordingly. Start/success/fail messages still print, just with no
// rotating frame.
let _verbose = false;
function setVerbose(v) { _verbose = !!v; }

// ── Spinner factory ──────────────────────────────────────────────────────────
/**
 * Build an ora spinner with a Batman-flavoured verb and the house style.
 * @param {string} key       Verb category (e.g. 'composer', 'pest', 'vite')
 * @param {Object} opts      Override `text` to bypass the verb pool.
 */
function spinner(key, opts = {}) {
  const config = {
    text: opts.text || pickVerb(key),
    spinner: 'dots12',
    color: 'cyan',
    ...opts,
  };
  // Disable animation when verbose — lets composer/npm output flow on its own
  // line without the spinner frame trampling it.
  if (_verbose) config.isEnabled = false;
  return ora(config);
}

// ── Banner ───────────────────────────────────────────────────────────────────
function banner(version) {
  const title = c.bold('create-php-starter') + c.muted(`  v${version}`);
  const tag   = c.muted('Alfred is on standby. Ready to scaffold.');
  return boxen(`${title}\n${tag}`, {
    padding:      { top: 0, bottom: 0, left: 2, right: 2 },
    margin:       { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle:  'round',
    borderColor:  'cyan',
    title:        accent.bold('✦  Wayne Manor  ✦'),
    titleAlignment: 'center',
  });
}

// ── Bordered surfaces ────────────────────────────────────────────────────────
function panel(content, { title, color = 'cyan' } = {}) {
  return boxen(content, {
    padding:      1,
    margin:       { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle:  'round',
    borderColor:  color,
    title:        title ? c.bold(title) : undefined,
    titleAlignment: 'left',
  });
}

function successPanel(title, body) {
  const tagline = c.muted(pick(SUCCESS_LINES));
  return panel(`${body}\n\n${tagline}`, { title: `✦  ${title}`, color: 'green' });
}

function failurePanel(title, body) {
  const tagline = c.muted(pick(FAILURE_LINES));
  return panel(`${body}\n\n${tagline}`, { title: `✗  ${title}`, color: 'red' });
}

module.exports = {
  c,
  spinner,
  setVerbose,
  pickVerb,
  banner,
  panel,
  successPanel,
  failurePanel,
  pickSuccessLine: () => pick(SUCCESS_LINES),
  pickFailureLine: () => pick(FAILURE_LINES),
};
