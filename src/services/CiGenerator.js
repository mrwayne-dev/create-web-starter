'use strict';

const fs   = require('fs');
const path = require('path');

// ── Laravel CI workflow ──────────────────────────────────────────────────────

function laravelCiWorkflow(config) {
  // Job-level service containers (PostgreSQL, MongoDB)
  let dbServices = '';
  // Steps to run before composer install (MySQL only — uses GitHub's pre-installed MySQL)
  let dbSetupSteps = '';
  // Env vars injected into migrate + test steps
  let dbEnv = `
        DB_CONNECTION: sqlite
        DB_DATABASE: ':memory:'`;

  if (config.db === 'mysql') {
    dbSetupSteps = `
      - name: Start MySQL
        run: sudo /etc/init.d/mysql start

      - name: Create database
        run: mysql -u root -proot -e "CREATE DATABASE IF NOT EXISTS test_db;"
`;
    dbEnv = `
        DB_CONNECTION: mysql
        DB_HOST: 127.0.0.1
        DB_PORT: 3306
        DB_DATABASE: test_db
        DB_USERNAME: root
        DB_PASSWORD: root`;
  } else if (config.db === 'pgsql') {
    dbServices = `
    services:
      db:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: app
          POSTGRES_PASSWORD: secret
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
`;
    dbEnv = `
        DB_CONNECTION: pgsql
        DB_HOST: 127.0.0.1
        DB_PORT: 5432
        DB_DATABASE: test_db
        DB_USERNAME: app
        DB_PASSWORD: secret`;
  } else if (config.db === 'mongodb') {
    dbServices = `
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
`;
    dbEnv = `
        DB_CONNECTION: mongodb
        DB_HOST: 127.0.0.1
        DB_PORT: 27017
        DB_DATABASE: test_db`;
  }
  // sqlite → keep default in-memory env

  // PHP extensions needed per DB
  const phpExtensions = config.db === 'pgsql'
    ? 'mbstring, xml, pdo, pdo_pgsql, bcmath'
    : config.db === 'mongodb'
    ? 'mbstring, xml, bcmath, mongodb'
    : 'mbstring, xml, pdo, pdo_mysql, bcmath';

  // Frontend CI job — react-vite lives in frontend/, inertia lives in Laravel root
  let reactJob = '';
  if (config.frontend === 'react-vite') {
    reactJob = `
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci --prefix frontend
      - run: npm run build --prefix frontend
`;
  } else if (config.frontend === 'inertia') {
    reactJob = `
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
`;
  }

  return `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  laravel:
    runs-on: ubuntu-latest
${dbServices}
    steps:
      - uses: actions/checkout@v4

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.2'
          extensions: ${phpExtensions}
          coverage: none
${dbSetupSteps}
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
