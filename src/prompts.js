'use strict';

const inquirer = require('inquirer').default;

// Map project types to their default complexity level
const TYPE_COMPLEXITY = {
  portfolio: 'simple',
  business:  'medium',
  saas:      'complex',
  ecommerce: 'complex',
  custom:    null       // always ask
};

/**
 * Run the full interactive prompt flow.
 * Returns a config object for scaffold.js to consume.
 *
 * @param {string} authorName
 * @returns {Promise<{
 *   projectName: string,
 *   authorName: string,
 *   projectType: string,
 *   complexity: string,
 *   phpBackend: boolean,
 *   features: {
 *     contactForm: boolean,
 *     auth: boolean,
 *     admin: boolean,
 *     database: boolean,
 *     phpMailer: boolean,
 *     phosphorIcons: boolean
 *   }
 * }>}
 */
async function runPrompts(authorName) {
  // ── Step 2: Project name ─────────────────────────────────────────────────────
  const { projectName } = await inquirer.prompt([
    {
      name: 'projectName',
      message: '📁 Project name:',
      validate: (input) => input.trim() ? true : 'Project name is required.',
      filter: (input) =>
        input.trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
    }
  ]);

  // ── Step 3: Project type ─────────────────────────────────────────────────────
  const { projectType } = await inquirer.prompt([
    {
      name: 'projectType',
      type: 'list',
      message: '🧭 What kind of project is this?',
      choices: [
        { name: 'Portfolio / Personal site    → Simple',  value: 'portfolio' },
        { name: 'Business / Marketing site    → Medium',  value: 'business'  },
        { name: 'SaaS / Web Application       → Complex', value: 'saas'      },
        { name: 'E-Commerce                   → Complex', value: 'ecommerce' },
        { name: "Custom (I'll decide)          → Ask me", value: 'custom'    }
      ]
    }
  ]);

  // ── Step 4: Complexity (pre-selected from type, user can override) ───────────
  const defaultComplexity = TYPE_COMPLEXITY[projectType] || 'simple';

  const { complexity } = await inquirer.prompt([
    {
      name: 'complexity',
      type: 'list',
      message: '⚙️  Complexity level:',
      choices: [
        { name: 'Simple  — Portfolio, landing page, brochure site', value: 'simple'  },
        { name: 'Medium  — Business site, multi-section web app',   value: 'medium'  },
        { name: 'Complex — SaaS, e-commerce, authenticated platform', value: 'complex' }
      ],
      default: defaultComplexity
    }
  ]);

  // ── Step 5: PHP backend ──────────────────────────────────────────────────────
  const { phpBackend } = await inquirer.prompt([
    {
      name: 'phpBackend',
      type: 'confirm',
      message: '🐘 Include PHP backend? (api/, config/, includes/)',
      default: true
    }
  ]);

  // ── Step 6: Feature flags ────────────────────────────────────────────────────
  const isComplex        = complexity === 'complex';
  const isMediumOrComplex = complexity === 'medium' || complexity === 'complex';

  const choices = [];

  if (phpBackend) {
    choices.push({
      name: '📬 Contact form  (api/contact.php, includes/mailer.php, includes/rate_limit.php)',
      value: 'contactForm',
      checked: false
    });
    choices.push({
      name: '📨 PHPMailer  (install via Composer)',
      value: 'phpMailer',
      checked: false
    });
  }

  choices.push({
    name: '🎨 Phosphor Icons  (download ZIP → assets/icons/)',
    value: 'phosphorIcons',
    checked: false
  });

  if (phpBackend && isMediumOrComplex && !isComplex) {
    // Auth is optional for Medium; auto-included for Complex (not shown)
    choices.push({
      name: '🔐 Authentication  (login / register / forgot / reset)',
      value: 'auth',
      checked: false
    });
  }

  if (phpBackend && isMediumOrComplex) {
    choices.push({
      name: '👨‍💼 Admin panel',
      value: 'admin',
      checked: false
    });
  }

  let selected = [];
  if (choices.length > 0) {
    const { features } = await inquirer.prompt([
      {
        name: 'features',
        type: 'checkbox',
        message: '🧩 Select features to include:',
        choices
      }
    ]);
    selected = features;
  }

  // Build final features object
  // Complex auto-includes auth + database; admin remains optional
  const features = {
    contactForm:   phpBackend && selected.includes('contactForm'),
    phpMailer:     phpBackend && selected.includes('phpMailer'),
    phosphorIcons: selected.includes('phosphorIcons'),
    auth:          phpBackend && (isComplex ? true : selected.includes('auth')),
    admin:         phpBackend && selected.includes('admin'),
    database:      phpBackend && isComplex
  };

  return { projectName, authorName, projectType, complexity, phpBackend, features };
}

module.exports = { runPrompts };
