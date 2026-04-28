'use strict';

const inquirer = require('inquirer').default;

const TYPE_COMPLEXITY = {
  portfolio: 'simple',
  business:  'medium',
  saas:      'complex',
  ecommerce: 'complex',
  custom:    null
};

/**
 * Run the full interactive prompt flow for Custom PHP mode.
 * @param {string} authorName
 * @param {Object} defaults   Pre-filled values from CLI flags (parseArgs output)
 */
async function runPrompts(authorName, defaults = {}) {

  // Step 1 — Framework (skip if --stack provided and maps to a known framework)
  let framework = (['vanilla','mvc','api'].includes(defaults.stack)) ? defaults.stack : null;

  if (!framework) {
    const { framework: chosen } = await inquirer.prompt([
      {
        name: 'framework',
        type: 'list',
        message: 'Choose a project framework:',
        choices: [
          { name: 'Vanilla   —  SPA-ready HTML/CSS/JS with optional PHP backend', value: 'vanilla' },
          { name: 'MVC       —  PHP MVC structure (Controllers / Models / Views)',  value: 'mvc'     },
          { name: 'API       —  PHP backend only, no frontend',                     value: 'api'     }
        ]
      }
    ]);
    framework = chosen;
  }

  // Step 2 — Project name (skip if passed as positional arg)
  let projectName = defaults.projectName || null;

  if (!projectName) {
    const ans = await inquirer.prompt([
      {
        name: 'projectName',
        message: 'Project name:',
        validate: (input) => input.trim() ? true : 'Project name is required.',
        filter:   (input) =>
          input.trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
      }
    ]);
    projectName = ans.projectName;
  } else {
    projectName = projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // MVC and API force PHP backend — skip project type / complexity / php prompt
  if (framework === 'api' || framework === 'mvc') {
    // Skip interactive prompts in dry-run or --yes mode
    if (defaults.dryRun || defaults.yes) {
      return {
        projectName, authorName, framework,
        projectType: framework === 'mvc' ? 'custom' : 'api',
        complexity: framework === 'mvc' ? 'medium' : 'simple',
        phpBackend: true,
        features: { contactForm: false, phpMailer: false, phosphorIcons: false, auth: false, admin: false, database: false },
        docker: defaults.docker || false, ci: defaults.ci || false, testing: defaults.testing || false,
        noGit: defaults.noGit || false, yes: defaults.yes || false,
        dryRun: defaults.dryRun || false, verbose: defaults.verbose || false,
      };
    }

    const choices = [
      { name: 'Contact form  (api/contact.php, rate limiting)',      value: 'contactForm', checked: false },
      { name: 'PHPMailer  (install via Composer)',                    value: 'phpMailer',   checked: false },
      { name: 'Authentication  (login / register / forgot / reset)', value: 'auth',        checked: false },
      { name: 'Admin panel',                                         value: 'admin',       checked: false },
      { name: 'Database layer  (SQL schema + config/database.php)',  value: 'database',    checked: false }
    ];

    const { selected } = await inquirer.prompt([
      {
        name: 'selected',
        type: 'checkbox',
        message: 'Select features to include:',
        choices
      }
    ]);

    const features = {
      contactForm:   selected.includes('contactForm'),
      phpMailer:     selected.includes('phpMailer'),
      phosphorIcons: false,
      auth:          selected.includes('auth'),
      admin:         selected.includes('admin'),
      database:      selected.includes('database')
    };

    return {
      projectName, authorName, framework,
      projectType: framework === 'mvc' ? 'custom' : 'api',
      complexity:  framework === 'mvc' ? 'medium' : 'simple',
      phpBackend:  true,
      features,
      // Pass through extra flags
      docker:  defaults.docker  || false,
      ci:      defaults.ci      || false,
      testing: defaults.testing || false,
      noGit:   defaults.noGit   || false,
      dryRun:  defaults.dryRun  || false,
      verbose: defaults.verbose || false,
    };
  }

  // Vanilla — full prompt flow
  if (defaults.dryRun || defaults.yes) {
    return {
      projectName, authorName, framework,
      projectType: 'portfolio', complexity: 'simple', phpBackend: true,
      features: { contactForm: false, phpMailer: false, phosphorIcons: false, auth: false, admin: false, database: false },
      docker: defaults.docker || false, ci: defaults.ci || false, testing: defaults.testing || false,
      noGit: defaults.noGit || false, yes: defaults.yes || false,
      dryRun: defaults.dryRun || false, verbose: defaults.verbose || false,
    };
  }

  // Step 3 — Project type
  const { projectType } = await inquirer.prompt([
    {
      name: 'projectType',
      type: 'list',
      message: 'What kind of project is this?',
      choices: [
        { name: 'Portfolio / Personal site    — Simple',  value: 'portfolio' },
        { name: 'Business / Marketing site    — Medium',  value: 'business'  },
        { name: 'SaaS / Web Application       — Complex', value: 'saas'      },
        { name: 'E-Commerce                   — Complex', value: 'ecommerce' },
        { name: "Custom (I'll decide)          — Ask me", value: 'custom'    }
      ]
    }
  ]);

  // Step 4 — Complexity
  const defaultComplexity = TYPE_COMPLEXITY[projectType] || 'simple';
  const { complexity } = await inquirer.prompt([
    {
      name: 'complexity',
      type: 'list',
      message: 'Complexity level:',
      choices: [
        { name: 'Simple   — Portfolio, landing page, brochure site',    value: 'simple'  },
        { name: 'Medium   — Business site, multi-section web app',      value: 'medium'  },
        { name: 'Complex  — SaaS, e-commerce, authenticated platform',  value: 'complex' }
      ],
      default: defaultComplexity
    }
  ]);

  // Step 5 — PHP backend
  const { phpBackend } = await inquirer.prompt([
    {
      name: 'phpBackend',
      type: 'confirm',
      message: 'Include PHP backend? (api/, config/, includes/)',
      default: true
    }
  ]);

  // Step 6 — Feature flags
  const isComplex         = complexity === 'complex';
  const isMediumOrComplex = complexity === 'medium' || complexity === 'complex';

  const choices = [];

  if (phpBackend) {
    choices.push({ name: 'Contact form  (api/contact.php, rate limiting)',     value: 'contactForm',   checked: false });
    choices.push({ name: 'PHPMailer  (install via Composer)',                   value: 'phpMailer',     checked: false });
  }

  choices.push({ name: 'Phosphor Icons  (adds CDN link to index.php)',         value: 'phosphorIcons', checked: false });

  if (phpBackend && isMediumOrComplex && !isComplex) {
    choices.push({ name: 'Authentication  (login / register / forgot / reset)', value: 'auth',          checked: false });
  }

  if (phpBackend && isMediumOrComplex) {
    choices.push({ name: 'Admin panel',                                          value: 'admin',         checked: false });
  }

  let selected = [];
  if (choices.length > 0) {
    const ans = await inquirer.prompt([
      {
        name: 'features',
        type: 'checkbox',
        message: 'Select features to include:',
        choices
      }
    ]);
    selected = ans.features;
  }

  const features = {
    contactForm:   phpBackend && selected.includes('contactForm'),
    phpMailer:     phpBackend && selected.includes('phpMailer'),
    phosphorIcons: selected.includes('phosphorIcons'),
    auth:          phpBackend && (isComplex ? true : selected.includes('auth')),
    admin:         phpBackend && selected.includes('admin'),
    database:      phpBackend && isComplex
  };

  return {
    projectName, authorName, framework, projectType, complexity, phpBackend, features,
    docker:  defaults.docker  || false,
    ci:      defaults.ci      || false,
    testing: defaults.testing || false,
    noGit:   defaults.noGit   || false,
    dryRun:  defaults.dryRun  || false,
    verbose: defaults.verbose || false,
  };
}

module.exports = { runPrompts };
