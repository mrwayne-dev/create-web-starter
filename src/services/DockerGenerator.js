'use strict';

const fs   = require('fs');
const path = require('path');

// ── DB service snippets ──────────────────────────────────────────────────────

function dbServiceSnippet(db, projectName) {
  const net = `    networks:\n      - ${projectName}_net\n`;
  switch (db) {
    case 'mysql':
      return `
  db:
    image: mysql:8.0
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: \${DB_ROOT_PASSWORD:-secret}
      MYSQL_DATABASE: \${DB_DATABASE:-app}
      MYSQL_USER: \${DB_USER:-app}
      MYSQL_PASSWORD: \${DB_PASSWORD:-secret}
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql
${net}`;
    case 'pgsql':
      return `
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${DB_DATABASE:-app}
      POSTGRES_USER: \${DB_USER:-app}
      POSTGRES_PASSWORD: \${DB_PASSWORD:-secret}
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data
${net}`;
    case 'mongodb':
      return `
  db:
    image: mongo:7
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: \${DB_USER:-app}
      MONGO_INITDB_ROOT_PASSWORD: \${DB_PASSWORD:-secret}
    ports:
      - "27017:27017"
    volumes:
      - db_data:/data/db
${net}`;
    default:
      return '';
  }
}

// ── Laravel docker-compose template ─────────────────────────────────────────

function laravelDockerCompose(projectName, db) {
  const dbService = dbServiceSnippet(db, projectName);
  const dbDepends = db !== 'sqlite' ? `\n    depends_on:\n      - db` : '';
  const dbVolume  = db !== 'sqlite' ? '\n  db_data:' : '';

  return `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    working_dir: /var/www
    volumes:
      - .:/var/www
    networks:
      - ${projectName}_net${dbDepends}

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - .:/var/www
      - ./docker/nginx.conf:/etc/nginx/conf.d/default.conf
    networks:
      - ${projectName}_net
    depends_on:
      - app
${dbService}
networks:
  ${projectName}_net:
    driver: bridge

volumes:
  app_data:${dbVolume}
`;
}

function laravelDockerfile(db = 'mysql') {
  const mongoExt = db === 'mongodb'
    ? `    && pecl install mongodb && docker-php-ext-enable mongodb \\\n`
    : '';
  return `FROM php:8.2-fpm

RUN apt-get update && apt-get install -y \\
    git curl libpng-dev libonig-dev libxml2-dev zip unzip \\
    && docker-php-ext-install pdo pdo_mysql mbstring exif pcntl bcmath gd \\
${mongoExt}    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY . .

RUN composer install --optimize-autoloader --no-dev \\
    && php artisan config:cache \\
    && php artisan route:cache \\
    && php artisan view:cache \\
    && chown -R www-data:www-data /var/www/storage /var/www/bootstrap/cache

EXPOSE 9000
CMD ["php-fpm"]
`;
}

function nginxConf() {
  return `server {
    listen 80;
    index index.php index.html;
    root /var/www/public;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \\.php$ {
        fastcgi_pass app:9000;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\\.(?!well-known).* {
        deny all;
    }
}
`;
}

// ── PHP mode docker-compose ──────────────────────────────────────────────────

function phpDockerCompose(projectName, db) {
  const dbService = dbServiceSnippet(db, projectName);
  const dbDepends = db !== 'sqlite' ? `\n    depends_on:\n      - db` : '';
  const dbVolume  = db !== 'sqlite' ? '\n  db_data:' : '';

  return `version: '3.8'

services:
  app:
    image: php:8.2-apache
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - .:/var/www/html
    networks:
      - ${projectName}_net${dbDepends}
${dbService}
networks:
  ${projectName}_net:
    driver: bridge

volumes:
  app_data:${dbVolume}
`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate Docker files for a Laravel project.
 * @param {string} projectDir  Root of the scaffolded project
 * @param {Object} config      { projectName, db }
 */
function generateForLaravel(projectDir, config) {
  const { projectName, db = 'mysql' } = config;

  fs.writeFileSync(path.join(projectDir, 'docker-compose.yml'), laravelDockerCompose(projectName, db));
  fs.writeFileSync(path.join(projectDir, 'Dockerfile'),         laravelDockerfile(db));

  const nginxDir = path.join(projectDir, 'docker');
  fs.mkdirSync(nginxDir, { recursive: true });
  fs.writeFileSync(path.join(nginxDir, 'nginx.conf'), nginxConf());
}

/**
 * Generate Docker files for a Custom PHP project.
 * @param {string} projectDir  Root of the scaffolded project
 * @param {Object} config      { projectName, db }
 */
function generateForPhp(projectDir, config) {
  const { projectName, db = 'mysql' } = config;
  fs.writeFileSync(path.join(projectDir, 'docker-compose.yml'), phpDockerCompose(projectName, db));
}

module.exports = { generateForLaravel, generateForPhp };
