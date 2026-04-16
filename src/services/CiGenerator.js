'use strict';

const fs   = require('fs');
const path = require('path');

// ── Laravel CI workflow ──────────────────────────────────────────────────────

function laravelCiWorkflow(config) {
  const dbSetup = config.db === 'mysql' ? `
      - name: Start MySQL
        run: sudo /etc/init.d/mysql start

      - name: Create database
        run: mysql -u root -proot -e "CREATE DATABASE IF NOT EXISTS test_db;"
` : '';

  const dbEnv = config.db === 'mysql' ? `
        DB_CONNECTION: mysql
        DB_HOST: 127.0.0.1
        DB_PORT: 3306
        DB_DATABASE: test_db
        DB_USERNAME: root
        DB_PASSWORD: root` : `
        DB_CONNECTION: sqlite
        DB_DATABASE: ':memory:'`;

  const reactJob = (config.frontend === 'react-vite' || config.frontend === 'inertia') ? `
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
` : '';

  return `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  laravel:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          extensions: mbstring, xml, pdo, pdo_mysql, bcmath
          coverage: none
${dbSetup}
      - name: Copy .env
        run: cp .env.example .env

      - name: Install Composer dependencies
        run: composer install --no-progress --prefer-dist --optimize-autoloader

      - name: Generate app key
        run: php artisan key:generate

      - name: Run migrations
        env:${dbEnv}
        run: php artisan migrate --force

      - name: Run tests (Pest)
        env:${dbEnv}
        run: php artisan test

      - name: Check code style (Pint)
        run: ./vendor/bin/pint --test
${reactJob}`;
}

// ── Custom PHP CI workflow ───────────────────────────────────────────────────

function phpCiWorkflow(config) {
  return `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  php:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          extensions: mbstring, xml, pdo, pdo_mysql
          coverage: none

      - name: Install Composer dependencies
        run: |
          if [ -f composer.json ]; then
            composer install --no-progress --prefer-dist
          fi

      - name: Run PHPUnit tests
        run: |
          if [ -f vendor/bin/phpunit ]; then
            vendor/bin/phpunit
          else
            echo "No PHPUnit found, skipping."
          fi
`;
}

// ── Public API ───────────────────────────────────────────────────────────────

function generate(projectDir, config, mode) {
  const workflowDir = path.join(projectDir, '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });

  const content = mode === 'laravel'
    ? laravelCiWorkflow(config)
    : phpCiWorkflow(config);

  fs.writeFileSync(path.join(workflowDir, 'ci.yml'), content);
}

module.exports = { generate };
