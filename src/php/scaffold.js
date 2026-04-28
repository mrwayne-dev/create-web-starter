'use strict';

const path  = require('path');
const fs    = require('fs');
const shell = require('shelljs');
const chalk = require('chalk');

const { writeComposerJson, installPHPMailer } = require('../composer');
const { generateReadme, generateArchitecture } = require('../docs');

function phpHeader(projectName, authorName, note = '') {
  // Strip */ to prevent PHP block-comment injection
  const safeAuthor = String(authorName).replace(/\*\//g, '');
  const safeNote   = note ? `\n * ${String(note).replace(/\*\//g, '')}` : '';
  return `<?php
/**
 * Project: ${projectName}
 * Author:  ${safeAuthor}
 * Created: ${new Date().toISOString().split('T')[0]}${safeNote}
 */
`;
}

// ── Folder list ─────────────────────────────────────────────────────────────
function buildFolderList({ framework, complexity, phpBackend, features }) {
  if (framework === 'api') {
    const folders = ['api', 'config', 'includes', 'uploads'];
    if (features.auth)     folders.push('api/auth', 'pages/public', 'pages/user');
    if (features.admin)    folders.push('api/admin', 'pages/admin');
    if (features.database) folders.push('database');
    return folders;
  }

  if (framework === 'mvc') {
    const folders = [
      'app/Controllers', 'app/Models', 'app/Views',
      'routes', 'public', 'config', 'includes', 'uploads'
    ];
    if (features.auth)     folders.push('api/auth', 'pages/public', 'pages/user');
    if (features.admin)    folders.push('api/admin', 'pages/admin');
    if (features.database) folders.push('database');
    return folders;
  }

  // Vanilla
  const folders = [
    'assets/css',
    'assets/js/components',
    'assets/js/pages/public',
    'assets/js/pages/user',
    'assets/fonts',
    'assets/images',
    'assets/favicon',
    'uploads',
  ];

  if (features.admin) folders.push('assets/js/pages/admin');

  if (phpBackend) {
    folders.push('api', 'config', 'includes', 'pages/public', 'pages/user');
    if (features.admin) folders.push('pages/admin', 'api/admin');
  }

  if (complexity === 'medium' || complexity === 'complex') {
    folders.push('assets/js/services', 'assets/js/lib');
    folders.push('assets/images/hero', 'assets/images/icons', 'assets/images/og');
    if (phpBackend) folders.push('api/v1');
  }

  if (complexity === 'complex') {
    folders.push('assets/js/store', 'assets/js/middleware', 'assets/js/modules');
    if (phpBackend) folders.push('api/webhooks');
  }

  if (features.auth && phpBackend)     folders.push('api/auth');
  if (features.database && phpBackend) folders.push('database');

  return folders;
}

// ── CSS stubs ────────────────────────────────────────────────────────────────
const mainCSS = () => `/* main.css — CSS Custom Properties + Base Reset
 * Owns: design tokens, box-model reset, body defaults
 */

:root {
  --color-bg:       #ffffff;
  --color-text:     #1f2937;
  --color-accent:   #3b82f6;
  --color-muted:    #6b7280;
  --font-primary:   -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-secondary: Georgia, 'Times New Roman', serif;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-primary);
  color: var(--color-text);
  background-color: var(--color-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
`;

const layoutCSS = () => `/* layout.css — Grid, Flex & Structural Layout
 * Owns: page skeleton, containers, grid systems, spacing structure
 */

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1.5rem;
}
`;

const componentsCSS = () => `/* components.css — Buttons, Cards, Forms & UI Pieces
 * Owns: reusable UI component styles (not page-specific)
 */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-family: var(--font-primary);
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.2s ease, transform 0.1s ease;
}
.btn:hover  { opacity: 0.88; }
.btn:active { transform: scale(0.98); }

.btn-primary   { background-color: var(--color-accent); color: #fff; }
.btn-secondary { background-color: transparent; border: 2px solid var(--color-accent); color: var(--color-accent); }
`;

const animationsCSS = () => `/* animations.css — Keyframes, Transitions & Motion
 * Owns: @keyframes definitions, animation utility classes
 * Rule: always wrap new animations in prefers-reduced-motion guard
 */

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration:        0.01ms !important;
    animation-iteration-count: 1      !important;
    transition-duration:       0.01ms !important;
  }
}

/* Example — uncomment and customise:
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
}
.fade-in { animation: fadeIn 0.3s ease forwards; }
*/
`;

// ── JS stubs ─────────────────────────────────────────────────────────────────
const appJS = () => `/**
 * app.js — SPA Entry Point
 *
 * Bootstraps the application:
 *   1. Waits for DOM to be ready
 *   2. Initialises the router
 *   3. Mounts global components (nav, footer, etc.)
 *   4. Runs any app-wide setup (theme, auth state, analytics)
 */

document.addEventListener('DOMContentLoaded', () => {
  // TODO: import and initialise router
  // TODO: mount global components
  // TODO: run app-wide setup
});
`;

const routerJS = () => `/**
 * router.js — Client-side Route Definitions
 *
 * Maps URL paths to page modules.
 * app.js calls router.init() on DOMContentLoaded.
 *
 * Route shape:
 *   { path: '/about', view: () => import('./pages/public/about.js') }
 */

const routes = [
  // { path: '/',           view: () => import('./pages/public/home.js')       },
  // { path: '/about',      view: () => import('./pages/public/about.js')      },
  // { path: '/contact',    view: () => import('./pages/public/contact.js')    },
  // { path: '/dashboard',  view: () => import('./pages/user/dashboard.js')    },
  // { path: '/admin',      view: () => import('./pages/admin/dashboard.js')   },
];

module.exports = { routes };
`;

// ── Root index.php — production-quality HTML shell ───────────────────────────
const rootIndexPHP = (projectName, phpBackend, features) => {
  const phpOpen = phpBackend
    ? `<?php\nrequire_once __DIR__ . '/config/env.php';\nrequire_once __DIR__ . '/config/constants.php';\n?>\n`
    : '';

  const phosphorScript = features && features.phosphorIcons
    ? `\n  <!-- Phosphor Icons -->\n  <script src="https://unpkg.com/@phosphor-icons/web" defer></script>\n`
    : '';

  return `${phpOpen}<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>

  <!-- SEO -->
  <meta name="description" content="<!-- Add your site description here -->">
  <meta name="robots" content="index, follow">

  <!-- Open Graph -->
  <meta property="og:title"       content="${projectName}">
  <meta property="og:description" content="<!-- Add your site description here -->">
  <meta property="og:image"       content="/assets/images/og/og-image.jpg">
  <meta property="og:url"         content="https://yourdomain.com">
  <meta property="og:type"        content="website">
  <meta property="og:site_name"   content="${projectName}">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${projectName}">
  <meta name="twitter:description" content="<!-- Add your site description here -->">
  <meta name="twitter:image"       content="/assets/images/og/og-image.jpg">

  <!-- Theme -->
  <meta name="theme-color" content="#ffffff">

  <!-- Canonical -->
  <link rel="canonical" href="https://yourdomain.com">

  <!-- Font Preloads — update paths once you add your fonts to assets/fonts/ -->
  <!--
  <link rel="preload" href="/assets/fonts/YourFont-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/YourFont-Bold.woff2"    as="font" type="font/woff2" crossorigin>
  -->

  <!-- Google Fonts — uncomment and replace with your chosen font -->
  <!--
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  -->

  <!-- CSS -->
  <link rel="stylesheet" href="/assets/css/main.css">
  <link rel="stylesheet" href="/assets/css/layout.css">
  <link rel="stylesheet" href="/assets/css/components.css">
  <link rel="stylesheet" href="/assets/css/animations.css">
${phosphorScript}
</head>
<body>

  <nav    id="nav"          aria-label="Main navigation"></nav>
  <main   id="app"          role="main"></main>
  <footer id="site-footer"  aria-label="Site footer"></footer>

  <!-- App Entry Point -->
  <script type="module" src="/assets/js/app.js"></script>

</body>
</html>
`;
};

// ── API index.php — JSON health-check endpoint ───────────────────────────────
const apiIndexPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
require_once __DIR__ . '/config/constants.php';
require_once __DIR__ . '/config/responses.php';
require_once __DIR__ . '/includes/headers.php';

jsonSuccess([
    'service' => '${projectName}',
    'status'  => 'ok',
    'version' => '1.0.0',
]);
`;

// ── MVC entry point ──────────────────────────────────────────────────────────
const mvcPublicIndexPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
require_once dirname(__DIR__) . '/config/constants.php';

// Front controller — all web traffic routes through here.
// Load your router and dispatch the request.
// Example: Router::dispatch($_SERVER['REQUEST_URI']);
`;

const mvcRoutesWebPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
/**
 * routes/web.php — Application route definitions
 *
 * Example shape:
 *   Router::get('/',       'HomeController@index');
 *   Router::get('/about',  'AboutController@index');
 *   Router::post('/login', 'AuthController@login');
 */
`;

const mvcBaseControllerPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
namespace App\\Controllers;

abstract class BaseController {

    protected function view(string $template, array $data = []): void {
        extract($data);
        $path = APP_ROOT . '/app/Views/' . $template . '.php';
        if (!file_exists($path)) {
            throw new \\RuntimeException("View not found: $template");
        }
        require $path;
    }

    protected function json(array $data, int $code = 200): void {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
`;

const mvcBaseModelPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
namespace App\\Models;

abstract class BaseModel {

    protected \\PDO $db;

    public function __construct() {
        $this->db = \\Database::getInstance()->getConnection();
    }
}
`;

// ── PHP config stubs ──────────────────────────────────────────────────────────
const constantsPHP = (pn, an) => phpHeader(pn, an) + `
define('APP_ROOT',      dirname(__DIR__));
define('CONFIG_PATH',   APP_ROOT . '/config');
define('INCLUDES_PATH', APP_ROOT . '/includes');
define('UPLOADS_PATH',  APP_ROOT . '/uploads');

require_once CONFIG_PATH . '/env.php';

if (getenv('APP_ENV') === 'development') {
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
} else {
    error_reporting(0);
    ini_set('display_errors', 0);
}

date_default_timezone_set('UTC');
`;

const envPHP = (pn, an) => phpHeader(pn, an) + `
function loadEnv($path) {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;
        list($name, $value) = explode('=', $line, 2);
        $name  = trim($name);
        $value = trim($value, " \\t\\n\\r\\0\\x0B\\"'");
        if (!array_key_exists($name, $_ENV)) {
            putenv("$name=$value");
            $_ENV[$name] = $value;
        }
    }
}

loadEnv(dirname(__DIR__) . '/.env');
`;

const databasePHP = (pn, an) => phpHeader(pn, an) + `
require_once __DIR__ . '/env.php';

class Database {
    private static $instance = null;
    private $conn;

    private function __construct() {
        $host     = getenv('DB_HOST') ?: 'localhost';
        $dbname   = getenv('DB_NAME');
        $username = getenv('DB_USER') ?: 'root';
        $password = getenv('DB_PASS') ?: '';
        try {
            $this->conn = new PDO(
                "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
                $username, $password,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]
            );
        } catch (PDOException $e) {
            http_response_code(500);
            die(json_encode(['success' => false, 'message' => 'Database connection failed']));
        }
    }

    public static function getInstance() {
        if (self::$instance === null) self::$instance = new self();
        return self::$instance;
    }

    public function getConnection() { return $this->conn; }
}
`;

const responsesPHP = (pn, an) => phpHeader(pn, an) + `
function jsonSuccess($data = [], int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['success' => true, 'data' => $data]);
    exit;
}

function jsonError(string $message, int $code = 400): void {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}
`;

// ── PHP includes stubs ────────────────────────────────────────────────────────
const headersPHP = (pn, an) => phpHeader(pn, an) + `
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . (getenv('APP_URL') ?: '*'));
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
`;

const helpersPHP = (pn, an) => phpHeader(pn, an) + `
function sanitize(string $input): string {
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}

function validateEmail(string $email): bool {
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}
`;

const rateLimitPHP = (pn, an) => phpHeader(pn, an) + `
function rateLimit(string $key, int $maxAttempts = 5, int $windowSeconds = 60): void {
    if (session_status() === PHP_SESSION_NONE) session_start();
    $now        = time();
    $sessionKey = 'rate_limit_' . $key;
    if (!isset($_SESSION[$sessionKey])) {
        $_SESSION[$sessionKey] = ['count' => 0, 'reset_at' => $now + $windowSeconds];
    }
    if ($now > $_SESSION[$sessionKey]['reset_at']) {
        $_SESSION[$sessionKey] = ['count' => 0, 'reset_at' => $now + $windowSeconds];
    }
    $_SESSION[$sessionKey]['count']++;
    if ($_SESSION[$sessionKey]['count'] > $maxAttempts) {
        http_response_code(429);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Too many requests. Please try again later.']);
        exit;
    }
}
`;

const mailerPHP = (pn, an) => phpHeader(pn, an) + `
require_once dirname(__DIR__) . '/vendor/autoload.php';

use PHPMailer\\PHPMailer\\PHPMailer;
use PHPMailer\\PHPMailer\\Exception;

function createMailer(): PHPMailer {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = getenv('SMTP_USER');
    $mail->Password   = getenv('SMTP_PASS');
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = (int)(getenv('SMTP_PORT') ?: 587);
    $mail->setFrom(getenv('SMTP_FROM'), getenv('SMTP_FROM_NAME'));
    return $mail;
}
`;

const authCheckPHP = (pn, an) => phpHeader(pn, an) + `
session_start();

function requireAuth(): void {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }
}

function requireAdmin(): void {
    requireAuth();
    if ($_SESSION['role'] !== 'admin') {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }
}

function getAuthUser(): array {
    return [
        'id'    => $_SESSION['user_id'] ?? null,
        'email' => $_SESSION['email']   ?? null,
        'role'  => $_SESSION['role']    ?? null,
    ];
}
`;

// ── Contact + email templates ─────────────────────────────────────────────────
const contactPHP = (pn, an, withMailer) => phpHeader(pn, an) + `
require_once '../config/constants.php';
require_once '../config/responses.php';
require_once '../includes/headers.php';
require_once '../includes/helpers.php';
require_once '../includes/rate_limit.php';
${withMailer ? "require_once '../includes/mailer.php';" : ''}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

rateLimit('contact_form', 5, 60);

$input   = json_decode(file_get_contents('php://input'), true);
$name    = sanitize($input['name']    ?? '');
$email   = trim($input['email']       ?? '');
$subject = sanitize($input['subject'] ?? 'Contact Form');
$message = sanitize($input['message'] ?? '');

if (!$name || !validateEmail($email) || !$message) {
    jsonError('Name, valid email, and message are required');
}

${withMailer ? `
try {
    $mail = createMailer();
    $mail->addAddress(getenv('SMTP_USER'));
    $mail->addReplyTo($email, $name);
    $mail->isHTML(true);
    $mail->Subject = $subject . ' - Contact Form';
    $mail->Body    = "<p><strong>From:</strong> $name ($email)</p>"
                   . "<p><strong>Message:</strong><br>" . nl2br($message) . "</p>";
    $mail->send();
    jsonSuccess([], 200);
} catch (Exception $e) {
    jsonError('Failed to send message', 500);
}` : `
// PHPMailer not installed — log or store the contact submission
error_log("Contact from $name ($email): $message");
jsonSuccess();
`}
`;

const emailTemplatesPHP = (pn, an) => phpHeader(pn, an) + `
class EmailTemplates {

    private static function layout(string $title, string $body): string {
        $appName = getenv('APP_NAME') ?: '${pn}';
        return <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"><title>$title</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; }
    .header  { background: #3b82f6; color: #fff; padding: 24px 32px; }
    .content { padding: 32px; color: #1f2937; line-height: 1.7; }
    .footer  { background: #f9fafb; padding: 16px 32px; text-align: center; font-size: 12px; color: #6b7280; }
    .btn     { display: inline-block; margin-top: 16px; padding: 12px 24px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 6px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><h2>$appName</h2></div>
    <div class="content">$body</div>
    <div class="footer">&copy; {$appName}. All rights reserved.</div>
  </div>
</body>
</html>
HTML;
    }

    public static function welcome(string $name): string {
        $body = "<h3>Welcome, $name!</h3><p>Your account has been created successfully.</p>";
        return self::layout('Welcome', $body);
    }

    public static function passwordReset(string $name, string $resetLink): string {
        $body = "<h3>Password Reset</h3>"
              . "<p>Hi $name, click below to reset your password (expires in 1 hour).</p>"
              . "<a class='btn' href='$resetLink'>Reset Password</a>"
              . "<p style='margin-top:16px;font-size:12px;color:#6b7280;'>Didn't request this? Ignore this email.</p>";
        return self::layout('Password Reset', $body);
    }
}
`;

// ── Auth API stubs ────────────────────────────────────────────────────────────
const loginPHP = (pn, an) => phpHeader(pn, an) + `
require_once '../../config/database.php';
require_once '../../config/responses.php';
require_once '../../includes/headers.php';
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$input    = json_decode(file_get_contents('php://input'), true);
$email    = trim($input['email']    ?? '');
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) jsonError('Email and password required');

try {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT * FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['email']   = $user['email'];
        $_SESSION['role']    = $user['role'];
        jsonSuccess(['message' => 'Login successful']);
    } else {
        jsonError('Invalid credentials', 401);
    }
} catch (PDOException $e) {
    jsonError('Server error', 500);
}
`;

const registerPHP = (pn, an) => phpHeader(pn, an) + `
require_once '../../config/database.php';
require_once '../../config/responses.php';
require_once '../../includes/headers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$input     = json_decode(file_get_contents('php://input'), true);
$email     = trim($input['email']     ?? '');
$password  = $input['password']  ?? '';
$full_name = trim($input['full_name'] ?? '');

if (empty($email) || empty($password)) jsonError('Email and password required');
if (strlen($password) < 8)             jsonError('Password must be at least 8 characters');

try {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    if ($stmt->fetch()) jsonError('Email already registered');

    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $stmt   = $db->prepare("INSERT INTO users (email, password, full_name) VALUES (:email, :password, :full_name)");
    $stmt->execute(['email' => $email, 'password' => $hashed, 'full_name' => $full_name]);
    jsonSuccess(['message' => 'Registration successful'], 201);
} catch (PDOException $e) {
    jsonError('Server error', 500);
}
`;

const logoutPHP = (pn, an) => phpHeader(pn, an) + `
require_once '../../config/responses.php';
require_once '../../includes/headers.php';
session_start();
session_destroy();
jsonSuccess(['message' => 'Logged out successfully']);
`;

const forgotPasswordPHP = (pn, an, withMailer) => phpHeader(pn, an) + `
require_once '../../config/database.php';
require_once '../../config/responses.php';
require_once '../../includes/headers.php';
${withMailer ? "require_once '../../includes/mailer.php';" : ''}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');
if (empty($email)) jsonError('Email is required');

try {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    if (!$stmt->fetch()) {
        jsonSuccess(['message' => 'If this email exists, a reset link has been sent']);
    }

    $token      = bin2hex(random_bytes(32));
    $expires_at = date('Y-m-d H:i:s', strtotime('+1 hour'));
    $db->prepare("DELETE FROM password_resets WHERE email = :email")->execute(['email' => $email]);
    $db->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (:email, :token, :expires_at)")
       ->execute(['email' => $email, 'token' => $token, 'expires_at' => $expires_at]);

    $resetLink = getenv('APP_URL') . '/pages/public/reset-password.php?token=' . $token;

    ${withMailer ? `
    try {
        $mail = createMailer();
        $mail->addAddress($email);
        $mail->isHTML(true);
        $mail->Subject = 'Password Reset - ' . getenv('APP_NAME');
        $mail->Body    = EmailTemplates::passwordReset('User', $resetLink);
        $mail->send();
    } catch (Exception $e) {
        error_log('Password reset email failed: ' . $e->getMessage());
    }` : `    // TODO: send email with reset link: $resetLink`}

    jsonSuccess(['message' => 'If this email exists, a reset link has been sent']);
} catch (PDOException $e) {
    jsonError('Server error', 500);
}
`;

const resetPasswordPHP = (pn, an) => phpHeader(pn, an) + `
require_once '../../config/database.php';
require_once '../../config/responses.php';
require_once '../../includes/headers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonError('Method not allowed', 405);

$input    = json_decode(file_get_contents('php://input'), true);
$token    = trim($input['token']    ?? '');
$password = $input['password'] ?? '';

if (empty($token) || empty($password)) jsonError('Token and new password are required');
if (strlen($password) < 8)             jsonError('Password must be at least 8 characters');

try {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT * FROM password_resets WHERE token = :token AND expires_at > NOW()");
    $stmt->execute(['token' => $token]);
    $reset = $stmt->fetch();
    if (!$reset) jsonError('Invalid or expired reset token');

    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $db->prepare("UPDATE users SET password = :password WHERE email = :email")
       ->execute(['password' => $hashed, 'email' => $reset['email']]);
    $db->prepare("DELETE FROM password_resets WHERE email = :email")
       ->execute(['email' => $reset['email']]);

    jsonSuccess(['message' => 'Password reset successfully']);
} catch (PDOException $e) {
    jsonError('Server error', 500);
}
`;

// ── Auth pages — now in pages/public/ and pages/user/ ────────────────────────
const loginPagePHP = (pn) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — ${pn}</title>
  <link rel="stylesheet" href="../../assets/css/main.css">
  <link rel="stylesheet" href="../../assets/css/components.css">
</head>
<body>
  <div class="container">
    <h1>Login</h1>
    <form id="loginForm">
      <input type="email"    name="email"    placeholder="Email"    required>
      <input type="password" name="password" placeholder="Password" required>
      <button type="submit" class="btn btn-primary">Login</button>
    </form>
    <p><a href="forgot-password.php">Forgot password?</a></p>
    <p id="msg"></p>
  </div>
  <script>
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res  = await fetch('/api/auth/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    document.getElementById('msg').textContent = result.data?.message || result.message;
    if (result.success) window.location.href = '/pages/user/dashboard.php';
  });
  </script>
</body>
</html>
`;

const forgotPasswordPagePHP = (pn) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forgot Password — ${pn}</title>
  <link rel="stylesheet" href="../../assets/css/main.css">
  <link rel="stylesheet" href="../../assets/css/components.css">
</head>
<body>
  <div class="container">
    <h1>Forgot Password</h1>
    <form id="forgotForm">
      <input type="email" name="email" placeholder="Your email" required>
      <button type="submit" class="btn btn-primary">Send Reset Link</button>
    </form>
    <p><a href="login.php">Back to login</a></p>
    <p id="msg"></p>
  </div>
  <script>
  document.getElementById('forgotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    const res  = await fetch('/api/auth/forgot-password.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    document.getElementById('msg').textContent = result.data?.message || result.message;
  });
  </script>
</body>
</html>
`;

const resetPasswordPagePHP = (pn) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password — ${pn}</title>
  <link rel="stylesheet" href="../../assets/css/main.css">
  <link rel="stylesheet" href="../../assets/css/components.css">
</head>
<body>
  <div class="container">
    <h1>Reset Password</h1>
    <form id="resetForm">
      <input type="password" name="password" placeholder="New password" minlength="8" required>
      <input type="password" name="confirm"  placeholder="Confirm password"            required>
      <button type="submit" class="btn btn-primary">Reset Password</button>
    </form>
    <p id="msg"></p>
  </div>
  <script>
  const token = new URLSearchParams(window.location.search).get('token');
  document.getElementById('resetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (fd.get('password') !== fd.get('confirm')) {
      document.getElementById('msg').textContent = 'Passwords do not match';
      return;
    }
    const res = await fetch('/api/auth/reset-password.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: fd.get('password') })
    });
    const result = await res.json();
    document.getElementById('msg').textContent = result.data?.message || result.message;
    if (result.success) setTimeout(() => window.location.href = '/pages/public/login.php', 2000);
  });
  </script>
</body>
</html>
`;

const userDashboardPHP = (pn, an) => phpHeader(pn, an) + `
require_once '../../includes/auth-check.php';
requireAuth();
$user = getAuthUser();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — ${pn}</title>
  <link rel="stylesheet" href="../../assets/css/main.css">
  <link rel="stylesheet" href="../../assets/css/components.css">
</head>
<body>
  <div class="container">
    <h1>Dashboard</h1>
    <p>Welcome, <?php echo htmlspecialchars($user['email']); ?></p>
    <button onclick="logout()" class="btn btn-primary">Logout</button>
  </div>
  <script>
  async function logout() {
    await fetch('/api/auth/logout.php');
    window.location.href = '/pages/public/login.php';
  }
  </script>
</body>
</html>
`;

// ── Admin — now in pages/admin/ ───────────────────────────────────────────────
const adminDashboardAPIPHP = (pn, an) => phpHeader(pn, an) + `
require_once '../../config/database.php';
require_once '../../config/responses.php';
require_once '../../includes/headers.php';
require_once '../../includes/auth-check.php';
requireAdmin();

try {
    $db         = Database::getInstance()->getConnection();
    $totalUsers = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $newToday   = $db->query("SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()")->fetchColumn();
    jsonSuccess(['total_users' => (int) $totalUsers, 'new_today' => (int) $newToday]);
} catch (PDOException $e) {
    jsonError('Server error', 500);
}
`;

const adminPagePHP = (pn, an) => phpHeader(pn, an) + `
require_once '../../includes/auth-check.php';
requireAdmin();
$user = getAuthUser();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — ${pn}</title>
  <link rel="stylesheet" href="../../assets/css/main.css">
  <link rel="stylesheet" href="../../assets/css/components.css">
  <style>
    .admin-layout  { display: flex; min-height: 100vh; }
    .admin-sidebar { width: 240px; background: #1e293b; color: #fff; padding: 1.5rem; }
    .admin-sidebar h3 { margin-bottom: 1.5rem; font-size: .875rem; opacity:.7; text-transform: uppercase; letter-spacing:.08em; }
    .admin-sidebar a  { display: block; color: #cbd5e1; text-decoration: none; padding: .5rem 0; }
    .admin-sidebar a:hover { color: #fff; }
    .admin-main    { flex: 1; padding: 2rem; background: #f8fafc; }
    .stat-card     { background: #fff; border-radius: .75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: inline-block; min-width: 180px; margin-right: 1rem; }
  </style>
</head>
<body>
<div class="admin-layout">
  <aside class="admin-sidebar">
    <h3>${pn}</h3>
    <nav><a href="/pages/admin/dashboard.php">Dashboard</a></nav>
  </aside>
  <div class="admin-main">
    <header style="margin-bottom:2rem;display:flex;justify-content:space-between;align-items:center;">
      <h1>Admin Dashboard</h1>
      <span><?php echo htmlspecialchars($user['email']); ?></span>
    </header>
    <div id="stats"></div>
  </div>
</div>
<script>
fetch('/api/admin/dashboard.php')
  .then(r => r.json())
  .then(({ success, data }) => {
    if (!success) return;
    document.getElementById('stats').innerHTML =
      '<div class="stat-card"><p style="font-size:.75rem;color:#6b7280;">Total Users</p><h2>' + data.total_users + '</h2></div>' +
      '<div class="stat-card"><p style="font-size:.75rem;color:#6b7280;">New Today</p><h2>'   + data.new_today   + '</h2></div>';
  });
</script>
</body>
</html>
`;

// ── Dot-files + DB schema ─────────────────────────────────────────────────────
const webhookPHP = (pn, an) => phpHeader(pn, an) + `
require_once '../../config/responses.php';
header('Content-Type: application/json');

$payload   = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';

// TODO: verify webhook signature
// $expected = hash_hmac('sha256', $payload, getenv('WEBHOOK_SECRET'));
// if (!hash_equals($expected, $signature)) jsonError('Invalid signature', 401);

$data  = json_decode($payload, true);
$event = $data['event'] ?? '';

switch ($event) {
    default:
        error_log('Unhandled webhook event: ' . $event);
}

jsonSuccess();
`;

const htaccess = (pn) => `# ${pn} — Apache Configuration
Options -Indexes
RewriteEngine On
RewriteBase /

# Remove .php extension from URLs
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME}\\.php -f
RewriteRule ^(.*)$ $1.php [L]

# SPA fallback — route all non-file, non-directory requests to index.php
# This lets app.js + router.js handle client-side navigation.
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [L,QSA]

# Block direct access to sensitive files
<FilesMatch "^\\.(env|gitignore|htaccess)$">
    Order allow,deny
    Deny from all
</FilesMatch>

<IfModule mod_rewrite.c>
    RewriteRule ^vendor/ - [F,L]
</IfModule>
`;

const gitignore = () => `.env
/vendor/
/node_modules/
.DS_Store
Thumbs.db
*.log
/uploads/*
!uploads/.gitkeep
.vscode/
.idea/
`;

const gitattributes = () => `* text=auto
*.php text eol=lf
*.js  text eol=lf
*.css text eol=lf
*.sql text eol=lf
*.md  text eol=lf
`;

const envTemplate = (pn) => {
  const dbName = pn.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `# Environment Configuration — ${pn}
# Copy this file to .env and fill in your credentials
# Never commit .env to version control

# Database
DB_HOST=localhost
DB_NAME=${dbName}
DB_USER=root
DB_PASS=

# Application
APP_NAME="${pn}"
APP_URL=http://localhost
APP_ENV=development

# Security
SESSION_LIFETIME=3600
PASSWORD_HASH_COST=12

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@${dbName}.com
SMTP_FROM_NAME="${pn}"
`;
};

const dbSchema = (pn, an) => {
  const dbName = pn.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `-- Database Schema for ${pn}
-- Generated by create-php-starter
-- Author: ${an}

CREATE DATABASE IF NOT EXISTS \`${dbName}\`;
USE \`${dbName}\`;

CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\`          INT AUTO_INCREMENT PRIMARY KEY,
  \`email\`       VARCHAR(255) UNIQUE NOT NULL,
  \`password\`    VARCHAR(255) NOT NULL,
  \`full_name\`   VARCHAR(255),
  \`role\`        ENUM('user','admin') DEFAULT 'user',
  \`is_verified\` BOOLEAN DEFAULT FALSE,
  \`created_at\`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`password_resets\` (
  \`id\`         INT AUTO_INCREMENT PRIMARY KEY,
  \`email\`      VARCHAR(255) NOT NULL,
  \`token\`      VARCHAR(255) NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`expires_at\` TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`sessions\` (
  \`id\`            INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\`       INT NOT NULL,
  \`session_token\` VARCHAR(255) UNIQUE NOT NULL,
  \`ip_address\`    VARCHAR(45),
  \`user_agent\`    TEXT,
  \`created_at\`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`expires_at\`    TIMESTAMP NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;
};


// ── printTree ─────────────────────────────────────────────────────────────────
function printTree(dir, prefix = '') {
  const entries = fs.readdirSync(dir).sort();
  entries.forEach((entry, i) => {
    const isLast    = i === entries.length - 1;
    const connector = isLast ? '    ' : '|   ';
    const full      = path.join(dir, entry);
    const stat      = fs.statSync(full);
    const marker    = isLast ? '\\-- ' : '+-- ';
    if (stat.isDirectory()) {
      console.log(chalk.dim(prefix + marker) + chalk.cyan(entry + '/'));
      printTree(full, prefix + connector);
    } else if (entry !== '.gitkeep') {
      console.log(chalk.dim(prefix + marker) + chalk.white(entry));
    }
  });
}

// ── Main createProject ────────────────────────────────────────────────────────
async function createProject(projectConfig, appConfig) {
  const { projectName, authorName, framework, complexity, phpBackend, features } = projectConfig;
  const projectPath = path.join(process.cwd(), projectName);

  // Belt-and-suspenders path safety check (sanitization in prompts is primary defence)
  const resolvedPath = path.resolve(projectPath);
  const resolvedCwd  = path.resolve(process.cwd());
  if (resolvedPath === resolvedCwd || !resolvedPath.startsWith(resolvedCwd + path.sep)) {
    console.error(chalk.red(`\n[!] Unsafe project path "${projectName}" — must be a direct subdirectory.\n`));
    process.exit(1);
  }

  // ── Dry run ──────────────────────────────────────────────────────────────────
  if (projectConfig.dryRun) {
    const DryRunner = require('../services/DryRunner');
    const dry = new DryRunner(true);
    const folders = buildFolderList({ framework, complexity, phpBackend, features });
    dry.mkdir(`${projectName}/`, `Create project folder (${framework})`);
    for (const f of folders) dry.mkdir(`${projectName}/${f}/`, `Create ${f}/`);

    dry.write(`${projectName}/.env + .env.example`, 'Write .env + .htaccess + .gitignore + .gitattributes');

    // Framework entry points
    if (framework === 'vanilla') {
      dry.write(`${projectName}/index.php`, 'Write index.php (SPA shell)');
      dry.write(`${projectName}/assets/css/*.css`, 'Write main / layout / components / animations CSS');
      dry.write(`${projectName}/assets/js/app.js + router.js`, 'Write app.js + router.js');
    }
    if (framework === 'api') {
      dry.write(`${projectName}/index.php`, 'Write API health-check endpoint');
    }
    if (framework === 'mvc') {
      dry.write(`${projectName}/public/index.php`, 'Write MVC front controller');
      dry.write(`${projectName}/routes/web.php`, 'Write route definitions');
      dry.write(`${projectName}/app/Controllers/BaseController.php`, 'Write BaseController');
      dry.write(`${projectName}/app/Models/BaseModel.php`, 'Write BaseModel');
    }

    // PHP config + includes (all PHP-backed projects)
    if (phpBackend || framework === 'mvc' || framework === 'api') {
      dry.write(`${projectName}/config/constants.php + env.php + responses.php`, 'Write PHP config stubs');
      dry.write(`${projectName}/includes/headers.php + helpers.php`, 'Write PHP include stubs');
      if (features.contactForm) dry.write(`${projectName}/includes/rate_limit.php`, 'Write rate limiter');
      if (features.phpMailer)   dry.write(`${projectName}/includes/mailer.php`,     'Write PHPMailer helper');
      if (features.auth)        dry.write(`${projectName}/includes/auth-check.php`, 'Write auth-check helper');
      if (features.database)    dry.write(`${projectName}/config/database.php`,     'Write PDO database config');
      if (features.contactForm) dry.write(`${projectName}/api/contact.php + email_templates.php`, 'Write contact form endpoint');
      if (features.auth)        dry.write(`${projectName}/api/auth/*.php`, 'Write auth endpoints (login/register/logout/forgot/reset)');
      if (features.auth)        dry.write(`${projectName}/pages/public/*.php + pages/user/dashboard.php`, 'Write auth pages');
      if (features.admin)       dry.write(`${projectName}/api/admin/dashboard.php`, 'Write admin API endpoint');
      if (features.admin)       dry.write(`${projectName}/pages/admin/dashboard.php`, 'Write admin dashboard page');
      if (features.database)    dry.write(`${projectName}/database/database.sql`, 'Write DB schema (users, password_resets, sessions)');
    }

    if (features.phpMailer) dry.install(['phpmailer/phpmailer'], 'Install PHPMailer via Composer');

    dry.write(`${projectName}/.editorconfig + .vscode/extensions.json`, 'Write dev config files');
    dry.write(`${projectName}/README.md + ARCHITECTURE.md`, 'Write README + ARCHITECTURE.md');

    if (projectConfig.testing) dry.write(`${projectName}/tests/`, 'Write PHPUnit test scaffold');
    if (projectConfig.docker)  dry.write(`${projectName}/docker-compose.yml + Dockerfile`, 'Write Docker files');
    if (projectConfig.ci)      dry.write(`${projectName}/.github/workflows/ci.yml`, 'Write GitHub Actions CI');
    if (!projectConfig.noGit)  dry.exec('git init && git add -A && git commit', 'Initialize git repo');

    dry.finish();
    return;
  }

  if (shell.test('-e', projectPath)) {
    console.log(chalk.red('\n  [!] Folder "' + projectName + '" already exists.'));
    return;
  }

  console.log(chalk.dim('\n  Creating project: ') + chalk.bold(projectName) + chalk.dim(' ...'));
  shell.mkdir('-p', projectPath);

  // ── Folders ────────────────────────────────────────────────────────────────
  const folders = buildFolderList({ framework, complexity, phpBackend, features });
  folders.forEach((f) => shell.mkdir('-p', path.join(projectPath, f)));

  // Gitkeeps in JS sub-folders (Vanilla only)
  if (framework === 'vanilla') {
    const jsKeeps = ['components', 'pages/public', 'pages/user'];
    if (features.admin) jsKeeps.push('pages/admin');
    if (complexity === 'medium' || complexity === 'complex') jsKeeps.push('services', 'lib');
    if (complexity === 'complex') jsKeeps.push('store', 'middleware', 'modules');
    jsKeeps.forEach((f) => {
      const p = path.join(projectPath, 'assets', 'js', f, '.gitkeep');
      const d = path.dirname(p);
      if (fs.existsSync(d)) fs.writeFileSync(p, '');
    });
  }

  // Always: uploads gitkeep
  fs.writeFileSync(path.join(projectPath, 'uploads', '.gitkeep'), '');

  // ── Dot-files (all frameworks) ─────────────────────────────────────────────
  fs.writeFileSync(path.join(projectPath, '.htaccess'),       htaccess(projectName));
  fs.writeFileSync(path.join(projectPath, '.gitignore'),      gitignore());
  fs.writeFileSync(path.join(projectPath, '.gitattributes'),  gitattributes());
  fs.writeFileSync(path.join(projectPath, '.env.example'),    envTemplate(projectName));
  fs.writeFileSync(path.join(projectPath, '.env'),            envTemplate(projectName));

  // ── Vanilla ────────────────────────────────────────────────────────────────
  if (framework === 'vanilla') {
    const cssDir = (f) => path.join(projectPath, 'assets', 'css', f);
    fs.writeFileSync(cssDir('main.css'),       mainCSS());
    fs.writeFileSync(cssDir('layout.css'),     layoutCSS());
    fs.writeFileSync(cssDir('components.css'), componentsCSS());
    fs.writeFileSync(cssDir('animations.css'), animationsCSS());

    const jsDir = (f) => path.join(projectPath, 'assets', 'js', f);
    fs.writeFileSync(jsDir('app.js'),    appJS());
    fs.writeFileSync(jsDir('router.js'), routerJS());

    fs.writeFileSync(path.join(projectPath, 'index.php'), rootIndexPHP(projectName, phpBackend, features));
  }

  // ── API framework ──────────────────────────────────────────────────────────
  if (framework === 'api') {
    fs.writeFileSync(path.join(projectPath, 'index.php'), apiIndexPHP(projectName, authorName));
  }

  // ── MVC framework ──────────────────────────────────────────────────────────
  if (framework === 'mvc') {
    fs.writeFileSync(path.join(projectPath, 'public', 'index.php'),        mvcPublicIndexPHP(projectName, authorName));
    fs.writeFileSync(path.join(projectPath, 'routes', 'web.php'),          mvcRoutesWebPHP(projectName, authorName));
    fs.writeFileSync(path.join(projectPath, 'app', 'Controllers', 'BaseController.php'), mvcBaseControllerPHP(projectName, authorName));
    fs.writeFileSync(path.join(projectPath, 'app', 'Models', 'BaseModel.php'),           mvcBaseModelPHP(projectName, authorName));
  }

  // ── PHP config + includes (all PHP-backed frameworks) ─────────────────────
  if (phpBackend || framework === 'mvc' || framework === 'api') {
    const cfg = (f) => path.join(projectPath, 'config', f);
    fs.writeFileSync(cfg('constants.php'), constantsPHP(projectName, authorName));
    fs.writeFileSync(cfg('env.php'),       envPHP(projectName, authorName));
    fs.writeFileSync(cfg('responses.php'), responsesPHP(projectName, authorName));
    if (features.database) {
      fs.writeFileSync(cfg('database.php'), databasePHP(projectName, authorName));
    }

    const inc = (f) => path.join(projectPath, 'includes', f);
    fs.writeFileSync(inc('headers.php'), headersPHP(projectName, authorName));
    fs.writeFileSync(inc('helpers.php'), helpersPHP(projectName, authorName));
    if (features.contactForm) {
      fs.writeFileSync(inc('rate_limit.php'), rateLimitPHP(projectName, authorName));
    }
    if (features.phpMailer) {
      fs.writeFileSync(inc('mailer.php'), mailerPHP(projectName, authorName));
    }
    if (features.auth) {
      fs.writeFileSync(inc('auth-check.php'), authCheckPHP(projectName, authorName));
    }

    // Contact form
    if (features.contactForm) {
      fs.writeFileSync(path.join(projectPath, 'api', 'contact.php'),         contactPHP(projectName, authorName, features.phpMailer));
      fs.writeFileSync(path.join(projectPath, 'api', 'email_templates.php'), emailTemplatesPHP(projectName, authorName));
    }

    // Auth API
    if (features.auth) {
      const auth = (f) => path.join(projectPath, 'api', 'auth', f);
      fs.writeFileSync(auth('login.php'),           loginPHP(projectName, authorName));
      fs.writeFileSync(auth('register.php'),        registerPHP(projectName, authorName));
      fs.writeFileSync(auth('logout.php'),          logoutPHP(projectName, authorName));
      fs.writeFileSync(auth('forgot-password.php'), forgotPasswordPHP(projectName, authorName, features.phpMailer));
      fs.writeFileSync(auth('reset-password.php'),  resetPasswordPHP(projectName, authorName));

      // Auth pages — public/ and user/
      const pub = (f) => path.join(projectPath, 'pages', 'public', f);
      fs.writeFileSync(pub('login.php'),           loginPagePHP(projectName));
      fs.writeFileSync(pub('forgot-password.php'), forgotPasswordPagePHP(projectName));
      fs.writeFileSync(pub('reset-password.php'),  resetPasswordPagePHP(projectName));
      fs.writeFileSync(path.join(projectPath, 'pages', 'user', 'dashboard.php'), userDashboardPHP(projectName, authorName));
    }

    // Admin
    if (features.admin) {
      fs.writeFileSync(path.join(projectPath, 'api', 'admin', 'dashboard.php'),   adminDashboardAPIPHP(projectName, authorName));
      fs.writeFileSync(path.join(projectPath, 'pages', 'admin', 'dashboard.php'), adminPagePHP(projectName, authorName));
    }

    // Webhooks (complex vanilla only)
    if (framework === 'vanilla' && complexity === 'complex') {
      fs.writeFileSync(path.join(projectPath, 'api', 'webhooks', 'webhook.php'), webhookPHP(projectName, authorName));
    }

    // Database schema
    if (features.database) {
      fs.writeFileSync(path.join(projectPath, 'database', 'database.sql'), dbSchema(projectName, authorName));
    }

    // Composer + PHPMailer
    if (features.phpMailer) {
      writeComposerJson(projectPath, projectName, authorName);
      await installPHPMailer(projectPath, appConfig);
    }
  }


  // ── Docs ───────────────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(projectPath, 'README.md'),       generateReadme(projectConfig));
  fs.writeFileSync(path.join(projectPath, 'ARCHITECTURE.md'), generateArchitecture(projectConfig));

  // ── Dev files (.editorconfig, .vscode) ─────────────────────────────────────
  try {
    const phpStubDir = path.join(__dirname, '..', 'stubs', 'php');
    fs.copyFileSync(
      path.join(phpStubDir, 'editorconfig.stub'),
      path.join(projectPath, '.editorconfig')
    );
    const vsDir = path.join(projectPath, '.vscode');
    fs.mkdirSync(vsDir, { recursive: true });
    const vsExtContent = JSON.stringify({
      recommendations: [
        'bmewburn.vscode-intelephense-client',
        'junstyle.php-cs-fixer',
        'eamodio.gitlens',
        'EditorConfig.EditorConfig'
      ]
    }, null, 2) + '\n';
    fs.writeFileSync(path.join(vsDir, 'extensions.json'), vsExtContent);
  } catch (_) { /* non-critical */ }

  // ── Docker ──────────────────────────────────────────────────────────────────
  if (projectConfig.docker) {
    try {
      const DockerGen = require('../services/DockerGenerator');
      DockerGen.generateForPhp(projectPath, projectConfig);
    } catch (_) { /* non-critical */ }
  }

  // ── CI ──────────────────────────────────────────────────────────────────────
  if (projectConfig.ci) {
    try {
      const CiGen = require('../services/CiGenerator');
      CiGen.generate(projectPath, projectConfig, 'php');
    } catch (_) { /* non-critical */ }
  }

  // ── Testing ─────────────────────────────────────────────────────────────────
  if (projectConfig.testing) {
    try {
      const TestingSetup = require('../services/TestingSetup');
      TestingSetup.setupPhp(projectPath, projectName);
    } catch (_) { /* non-critical */ }
  }

  // ── Git init ────────────────────────────────────────────────────────────────
  if (!projectConfig.noGit) {
    try {
      const { init: gitInit } = require('../services/GitInitializer');
      gitInit(projectPath, projectConfig);
    } catch (_) { /* non-critical — git may not be configured */ }
  }

  // ── Success output ─────────────────────────────────────────────────────────
  require('../services/SummaryPrinter').print(projectConfig, 'php');

  // ── Offer preset save ──────────────────────────────────────────────────────
  try {
    const { offerPresetSave } = require('../config');
    await offerPresetSave(projectConfig, appConfig);
  } catch (_) { /* non-critical */ }
}

module.exports = { createProject };
