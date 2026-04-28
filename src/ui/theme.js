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
const accent = chalk.hex('#7AA2F7'); // Soft cyan-blue (Claude Code palette)
const bat    = chalk.hex('#FFD23F'); // Bat-signal yellow

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

// ── Bat ASCII art ─────────────────────────────────────────────────────────────
// Stored as plain strings; bat() colour applied at render time.
const BAT_ART = [
  '                   ,.ood888888888888boo.,               ',
  '              .od888P^""            ""^Y888bo.          ',
  '          .od8P\'\'   ..oood88888888booo.    ``Y8bo.      ',
  '       .odP\'"  .ood8888888888888888888888boo.  "`Ybo.   ',
  '     .d8\'   od8\'d888888888f`8888\'t888888888b`8bo   `Yb. ',
  '    d8\'  od8^   8888888888[  `\'  ]8888888888   ^8bo  `8b',
  '  .8P  d88\'     8888888888P      Y8888888888     `88b  Y8.',
  ' d8\' .d8\'       `Y88888888\'      `88888888P\'       `8b. `8b',
  '.8P .88P            """"            """"            Y88. Y8.',
  '88  888                                              888  88',
  '88  888                                              888  88',
  '88  888.        ..                        ..        .888  88',
  '`8b `88b,     d8888b.od8bo.      .od8bo.d8888b     ,d88\' d8\'',
  ' Y8. `Y88.    8888888888888b    d8888888888888    .88P\' .8P ',
  '  `8b  Y88b.  `88888888888888  88888888888888\'  .d88P  d8\' ',
  '    Y8.  ^Y88bod8888888888888..8888888888888bod88P^  .8P   ',
  '     `Y8.   ^Y888888888888888LS888888888888888P^   .8P\'   ',
  '       `^Yb.,  `^^Y8888888888888888888888P^^\'  ,.dP^\' ',
  '          `^Y8b..   ``^^^Y88888888P^^^\'    ..d8P^\' ',
  '              `^Y888bo.,            ,.od888P^\' ',
  '                   "`^^Y888888888888P^\'"',
];

// ── Verb pool — Batman / Alfred / Wayne Manor flavour ────────────────────────
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

// ── ANSI-safe string helpers ──────────────────────────────────────────────────
function visLen(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '').length;
}
function rpad(s, w) {
  return s + ' '.repeat(Math.max(0, w - visLen(s)));
}

// ── Verbose-mode toggle ──────────────────────────────────────────────────────
let _verbose = false;
function setVerbose(v) { _verbose = !!v; }

// ── Spinner factory ──────────────────────────────────────────────────────────
function spinner(key, opts = {}) {
  const config = {
    text:    opts.text || pickVerb(key),
    spinner: 'dots',
    color:   'cyan',
    ...opts,
  };
  if (_verbose) config.isEnabled = false;
  return ora(config);
}

// ── Startup animation ─────────────────────────────────────────────────────────
// Reveals the bat art line-by-line at ~40ms per line (~840ms total),
// pauses briefly, then clears so the full banner can take over.
// Silently skips on non-TTY (pipes, CI, --dry-run piped).
async function playBatAnimation() {
  if (!process.stdout.isTTY) return;

  const sleep     = ms => new Promise(r => setTimeout(r, ms));
  const artHeight = BAT_ART.length;

  process.stdout.write('\x1B[?25l'); // hide cursor
  try {
    for (const line of BAT_ART) {
      process.stdout.write(chalk.white(line) + '\n');
      await sleep(40);
    }
    await sleep(300); // pause on full image
    // Move cursor back up and wipe each line
    process.stdout.write(`\x1B[${artHeight}A`);
    for (let i = 0; i < artHeight; i++) process.stdout.write('\x1B[2K\n');
    process.stdout.write(`\x1B[${artHeight}A`);
  } finally {
    process.stdout.write('\x1B[?25h'); // show cursor
  }
}

// ── Banner ────────────────────────────────────────────────────────────────────
// Two-section layout: bat as full-width hero, then greeting + two-column info.
function banner(version, authorName = null, presets = {}) {
  const batLines = BAT_ART.map(l => chalk.white(l));

  const greet = authorName
    ? accent.bold('Welcome back, ' + authorName + '!')
    : accent.bold('Welcome!');

  const home       = process.env.HOME || '';
  const cwd        = process.cwd().replace(home, '~');
  const MAX_CWD    = 55;
  const cwdDisplay = cwd.length > MAX_CWD ? '…' + cwd.slice(-(MAX_CWD - 1)) : cwd;
  const meta       = c.muted('v' + version + '   ' + cwdDisplay);

  // Two-column info section
  const COL        = 30;
  const presetKeys = Object.keys(presets || {});

  const leftCol = presetKeys.length > 0
    ? [accent.bold('Saved presets'), ...presetKeys.slice(0, 5).map(p => c.muted('  ▸  ') + p)]
    : [accent.bold('Presets'), c.muted('  None saved yet'), c.muted('  Use --preset=name to save one')];

  const rightCol = [
    accent.bold('Quick tips'),
    c.muted('  ') + c.code('--dry-run') + c.muted('   preview scaffold'),
    c.muted('  ') + c.code('--yes') + c.muted('       accept defaults'),
    c.muted('  ') + c.code('add pest') + c.muted('    retrofit testing'),
    c.muted('  ') + c.code('--preset') + c.muted('    load a preset'),
  ];

  const colH = Math.max(leftCol.length, rightCol.length);
  while (leftCol.length < colH)  leftCol.push('');
  while (rightCol.length < colH) rightCol.push('');

  const infoRows = leftCol.map((l, i) =>
    rpad(l, COL) + '  ' + c.muted('│') + '  ' + (rightCol[i] || '')
  );

  const body = [
    '',
    ...batLines,
    '',
    greet,
    meta,
    '',
    c.muted('─'.repeat(60)),
    '',
    ...infoRows,
    '',
  ].join('\n');

  return boxen(body, {
    padding:        { top: 0, bottom: 0, left: 2, right: 4 },
    margin:         { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle:    'round',
    borderColor:    'cyan',
    title:          accent.bold('❖  Wayne Manor  ❖'),
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
  return panel(`${body}\n\n${tagline}`, { title: `❖  ${title}`, color: 'green' });
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
  playBatAnimation,
  banner,
  panel,
  successPanel,
  failurePanel,
  pickSuccessLine: () => pick(SUCCESS_LINES),
  pickFailureLine: () => pick(FAILURE_LINES),
};
