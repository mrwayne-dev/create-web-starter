'use strict';

const path    = require('path');
const fs      = require('fs');
const shell   = require('shelljs');
const chalk   = require('chalk');

const { writeComposerJson, installPHPMailer } = require('./composer');
const { downloadPhosphorIcons }               = require('./icons');
const { generateReadme, generateArchitecture } = require('./docs');

// PHP file header comment block
function phpHeader(projectName, authorName, note = '') {
  const noteStr = note ? `\n * ${note}` : '';
  return `<?php
/**
 * Project: ${projectName}
 * Author:  ${authorName}
 * Created: ${new Date().toISOString().split('T')[0]}${noteStr}
 */
`;
}

// Build folder list based on config options
function buildFolderList({ complexity, phpBackend, features }) {
  const folders = [
    'assets/css',
    'assets/js/components',
    'assets/js/pages',
    'assets/js/utils',
    'assets/fonts',
    'assets/images',
    'assets/favicon',
    'uploads',
  ];

  if (phpBackend) {
    folders.push('api', 'config', 'includes');
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

  if (phpBackend && features.auth)       folders.push('api/auth', 'pages');
  if (phpBackend && features.admin)      folders.push('admin', 'api/admin');
  if (phpBackend && features.database)   folders.push('database');
  if (features.phosphorIcons)            folders.push('assets/icons');

  return folders;
}

// ── CSS stubs ───────────────────────────────────────────────────────────────
const mainCSS = () => `/* main.css — CSS Custom Properties + Base Reset
 * Owns: design tokens, box-model reset, body defaults
 */

:root {
  --color-bg:        #ffffff;
  --color-text:      #1f2937;
  --color-accent:    #3b82f6;
  --color-muted:     #6b7280;
  --font-primary:    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-secondary:  Georgia, 'Times New Roman', serif;
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
 * Rule:  always wrap new animations in prefers-reduced-motion guard
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

// ── JS stubs ────────────────────────────────────────────────────────────────
const appJS = () => `/**
 * app.js — SPA Entry Point
 *
 * Bootstraps the application:
 *   1. Waits for DOM to be ready
 *   2. Initialises the router
 *   3. Mounts global components (nav, footer, etc.)
 *   4. Runs any app-wide setup (theme, auth state, analytics, etc.)
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
 *   { path: '/about', view: () => import('./pages/about.js') }
 */

const routes = [
  // { path: '/',        view: () => import('./pages/home.js')    },
  // { path: '/about',   view: () => import('./pages/about.js')   },
  // { path: '/contact', view: () => import('./pages/contact.js') },
];

module.exports = { routes };
`;

// ── Root index.php ──────────────────────────────────────────────────────────
const rootIndexPHP = (projectName, phpBackend) => {
  const phpOpen = phpBackend
    ? `<?php require_once 'config/constants.php'; ?>\n`
    : '';
  return `${phpOpen}<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="assets/css/main.css">
    <link rel="stylesheet" href="assets/css/layout.css">
    <link rel="stylesheet" href="assets/css/components.css">
    <link rel="stylesheet" href="assets/css/animations.css">
</head>
<body>
    <div id="app">
        <!-- SPA mounts here -->
    </div>
    <script src="assets/js/app.js" type="module"></script>
</body>
</html>
`;
};

// ── PHP config stubs ────────────────────────────────────────────────────────
const constantsPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
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

const envPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
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

const databasePHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
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
                $username,
                $password,
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

const responsesPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
/**
 * JSON response helpers
 * Usage: jsonSuccess($data) / jsonError($message, $code)
 */

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

// ── PHP includes stubs ──────────────────────────────────────────────────────
const headersPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
/**
 * CORS + Content-Type headers
 * Include at the top of API endpoint files
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . (getenv('APP_URL') ?: '*'));
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
`;

const helpersPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
/**
 * Common utility helpers
 */

function sanitize(string $input): string {
    return htmlspecialchars(strip_tags(trim($input)), ENT_QUOTES, 'UTF-8');
}

function validateEmail(string $email): bool {
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}
`;

const rateLimitPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
/**
 * Session-based rate limiting
 * Usage: rateLimit('contact_form', 5, 60) — max 5 requests per 60 seconds
 */

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

const mailerPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
/**
 * PHPMailer wrapper
 * Requires: composer require phpmailer/phpmailer
 */

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

const authCheckPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
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

// ── Contact form stubs ──────────────────────────────────────────────────────
const contactPHP = (projectName, authorName, withMailer) => phpHeader(projectName, authorName) + `
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

const emailTemplatesPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
/**
 * Email template helpers
 * Usage: EmailTemplates::welcome($name) / EmailTemplates::passwordReset($name, $link)
 */
class EmailTemplates {

    private static function layout(string $title, string $body): string {
        $appName = getenv('APP_NAME') ?: '${projectName}';
        return <<<HTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>$title</title>
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

// ── Auth API stubs ──────────────────────────────────────────────────────────
const loginPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
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

const registerPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
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

const logoutPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
require_once '../../config/responses.php';
require_once '../../includes/headers.php';
session_start();
session_destroy();
jsonSuccess(['message' => 'Logged out successfully']);
`;

const forgotPasswordPHP = (projectName, authorName, withMailer) => phpHeader(projectName, authorName) + `
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
    $user = $stmt->fetch();

    // Always return success to prevent email enumeration
    if (!$user) {
        jsonSuccess(['message' => 'If this email exists, a reset link has been sent']);
    }

    $token      = bin2hex(random_bytes(32));
    $expires_at = date('Y-m-d H:i:s', strtotime('+1 hour'));

    $db->prepare("DELETE FROM password_resets WHERE email = :email")->execute(['email' => $email]);
    $stmt = $db->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (:email, :token, :expires_at)");
    $stmt->execute(['email' => $email, 'token' => $token, 'expires_at' => $expires_at]);

    $resetLink = getenv('APP_URL') . '/pages/reset-password.php?token=' . $token;

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
    }` : `
    // TODO: send email with reset link: $resetLink`}

    jsonSuccess(['message' => 'If this email exists, a reset link has been sent']);
} catch (PDOException $e) {
    jsonError('Server error', 500);
}
`;

const resetPasswordPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
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

// ── Auth pages ──────────────────────────────────────────────────────────────
const loginPagePHP = (projectName) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login — ${projectName}</title>
    <link rel="stylesheet" href="../assets/css/main.css">
    <link rel="stylesheet" href="../assets/css/components.css">
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
        if (result.success) window.location.href = '/pages/dashboard.php';
    });
    </script>
</body>
</html>
`;

const forgotPasswordPagePHP = (projectName) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forgot Password — ${projectName}</title>
    <link rel="stylesheet" href="../assets/css/main.css">
    <link rel="stylesheet" href="../assets/css/components.css">
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

const resetPasswordPagePHP = (projectName) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password — ${projectName}</title>
    <link rel="stylesheet" href="../assets/css/main.css">
    <link rel="stylesheet" href="../assets/css/components.css">
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
        if (result.success) setTimeout(() => window.location.href = '/pages/login.php', 2000);
    });
    </script>
</body>
</html>
`;

// ── User dashboard ──────────────────────────────────────────────────────────
const userDashboardPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
require_once '../includes/auth-check.php';
requireAuth();
$user = getAuthUser();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard — ${projectName}</title>
    <link rel="stylesheet" href="../assets/css/main.css">
    <link rel="stylesheet" href="../assets/css/components.css">
</head>
<body>
    <div class="container">
        <h1>Dashboard</h1>
        <p>Welcome, <?php echo htmlspecialchars($user['email']); ?>!</p>
        <button onclick="logout()" class="btn btn-primary">Logout</button>
    </div>
    <script>
    async function logout() {
        await fetch('/api/auth/logout.php');
        window.location.href = '/pages/login.php';
    }
    </script>
</body>
</html>
`;

// ── Admin stubs ─────────────────────────────────────────────────────────────
const adminDashboardAPIPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
require_once '../../config/database.php';
require_once '../../config/responses.php';
require_once '../../includes/headers.php';
require_once '../../includes/auth-check.php';
requireAdmin();

try {
    $db         = Database::getInstance()->getConnection();
    $totalUsers = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $newToday   = $db->query("SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()")->fetchColumn();

    jsonSuccess([
        'total_users' => (int) $totalUsers,
        'new_today'   => (int) $newToday,
    ]);
} catch (PDOException $e) {
    jsonError('Server error', 500);
}
`;

const adminPagePHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
require_once '../includes/auth-check.php';
requireAdmin();
$user = getAuthUser();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin — ${projectName}</title>
    <link rel="stylesheet" href="../assets/css/main.css">
    <link rel="stylesheet" href="../assets/css/components.css">
    <style>
        .admin-layout  { display: flex; min-height: 100vh; }
        .admin-sidebar { width: 240px; background: #1e293b; color: #fff; padding: 1.5rem; }
        .admin-sidebar h3 { margin-bottom: 1.5rem; font-size: 1rem; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.08em; }
        .admin-sidebar a  { display: block; color: #cbd5e1; text-decoration: none; padding: 0.5rem 0; }
        .admin-sidebar a:hover { color: #fff; }
        .admin-main    { flex: 1; padding: 2rem; background: #f8fafc; }
        .admin-header  { margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: center; }
        .stat-card     { background: #fff; border-radius: 0.75rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); display: inline-block; min-width: 180px; margin-right: 1rem; }
    </style>
</head>
<body>
<div class="admin-layout">
    <aside class="admin-sidebar">
        <h3>${projectName}</h3>
        <nav>
            <a href="/admin/dashboard.php">Dashboard</a>
        </nav>
    </aside>
    <div class="admin-main">
        <header class="admin-header">
            <h1>Admin Dashboard</h1>
            <span>Logged in as <?php echo htmlspecialchars($user['email']); ?></span>
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
            '<div class="stat-card"><p style="font-size:.75rem;color:#6b7280;">New Today</p><h2>'    + data.new_today   + '</h2></div>';
    });
</script>
</body>
</html>
`;

// ── Webhook stub ────────────────────────────────────────────────────────────
const webhookPHP = (projectName, authorName) => phpHeader(projectName, authorName) + `
require_once '../../config/responses.php';
header('Content-Type: application/json');

$payload   = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';

// TODO: Verify the webhook signature from your provider
// $expected = hash_hmac('sha256', $payload, getenv('WEBHOOK_SECRET'));
// if (!hash_equals($expected, $signature)) jsonError('Invalid signature', 401);

$data  = json_decode($payload, true);
$event = $data['event'] ?? '';

switch ($event) {
    // case 'payment.completed': break;
    // case 'payment.failed':    break;
    default:
        error_log('Unhandled webhook event: ' . $event);
}

jsonSuccess();
`;

// ── Database schema ─────────────────────────────────────────────────────────
const dbSchema = (projectName, authorName) => {
  const dbName = projectName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `-- Database Schema for ${projectName}
-- Generated by create-web-starter
-- Author: ${authorName}

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

// ── Dot-files ───────────────────────────────────────────────────────────────
const htaccess = (projectName) => `# ${projectName} — Apache Configuration
Options -Indexes
RewriteEngine On
RewriteBase /

# Remove .php extension from URLs
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME}\\.php -f
RewriteRule ^(.*)$ $1.php [L]

# SPA fallback — route all non-file, non-directory requests to index.php
# This lets app.js + router.js handle client-side navigation.
# Remove or adjust if you are NOT using a JS SPA pattern.
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [L,QSA]

# Block direct access to sensitive files
<FilesMatch "^\\.(env|gitignore|htaccess)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Prevent direct access to vendor directory
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

const envExample = (projectName) => {
  const dbName = projectName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return `# Environment Configuration — ${projectName}
# Copy this file to .env and fill in your values
# Never commit .env to version control

# Database
DB_HOST=localhost
DB_NAME=${dbName}
DB_USER=root
DB_PASS=

# Application
APP_NAME="${projectName}"
APP_URL=http://localhost
APP_ENV=development

# Security
SESSION_LIFETIME=3600
PASSWORD_HASH_COST=12

# Email (SMTP) — required for PHPMailer / contact form
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@${dbName}.com
SMTP_FROM_NAME="${projectName}"
`;
};

// ── Print generated tree ────────────────────────────────────────────────────
function printTree(dir, prefix = '') {
  const entries = fs.readdirSync(dir).sort();
  entries.forEach((entry, i) => {
    const isLast    = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPfx  = isLast ? '    ' : '│   ';
    const full      = path.join(dir, entry);
    const stat      = fs.statSync(full);
    if (stat.isDirectory()) {
      console.log(prefix + connector + chalk.cyan(entry + '/'));
      printTree(full, prefix + childPfx);
    } else {
      console.log(prefix + connector + chalk.white(entry));
    }
  });
}

// ── Main createProject ──────────────────────────────────────────────────────
async function createProject(projectConfig, appConfig) {
  const { projectName, authorName, complexity, phpBackend, features } = projectConfig;
  const projectPath = path.join(process.cwd(), projectName);

  if (shell.test('-e', projectPath)) {
    console.log(chalk.red(`\n❌ Folder "${projectName}" already exists.`));
    return;
  }

  console.log(chalk.bold(`\n✨ Creating project: ${chalk.cyan(projectName)} ...`));
  shell.mkdir('-p', projectPath);

  // ── Folders ──────────────────────────────────────────────────────────────
  console.log(chalk.dim('   Creating folder structure...'));
  const folders = buildFolderList({ complexity, phpBackend, features });
  folders.forEach((f) => shell.mkdir('-p', path.join(projectPath, f)));

  // Gitkeep stubs in empty JS sub-folders
  const jsKeepFolders = ['components', 'pages', 'utils'];
  if (complexity === 'medium' || complexity === 'complex') {
    jsKeepFolders.push('services', 'lib');
  }
  if (complexity === 'complex') {
    jsKeepFolders.push('store', 'middleware', 'modules');
  }
  jsKeepFolders.forEach((f) => {
    const p = path.join(projectPath, 'assets', 'js', f, '.gitkeep');
    if (fs.existsSync(path.dirname(p))) fs.writeFileSync(p, '');
  });

  // ── CSS ───────────────────────────────────────────────────────────────────
  const cssDir = (f) => path.join(projectPath, 'assets', 'css', f);
  fs.writeFileSync(cssDir('main.css'),       mainCSS());
  fs.writeFileSync(cssDir('layout.css'),     layoutCSS());
  fs.writeFileSync(cssDir('components.css'), componentsCSS());
  fs.writeFileSync(cssDir('animations.css'), animationsCSS());

  // ── JS ────────────────────────────────────────────────────────────────────
  const jsDir = (f) => path.join(projectPath, 'assets', 'js', f);
  fs.writeFileSync(jsDir('app.js'),    appJS());
  fs.writeFileSync(jsDir('router.js'), routerJS());

  // ── Root files ────────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(projectPath, 'index.php'),       rootIndexPHP(projectName, phpBackend));
  fs.writeFileSync(path.join(projectPath, '.htaccess'),        htaccess(projectName));
  fs.writeFileSync(path.join(projectPath, '.gitignore'),       gitignore());
  fs.writeFileSync(path.join(projectPath, '.gitattributes'),   gitattributes());
  fs.writeFileSync(path.join(projectPath, '.env.example'),     envExample(projectName));
  fs.writeFileSync(path.join(projectPath, 'uploads', '.gitkeep'), '');

  // ── PHP config layer ──────────────────────────────────────────────────────
  if (phpBackend) {
    const cfg = (f) => path.join(projectPath, 'config', f);
    fs.writeFileSync(cfg('constants.php'), constantsPHP(projectName, authorName));
    fs.writeFileSync(cfg('env.php'),       envPHP(projectName, authorName));
    fs.writeFileSync(cfg('responses.php'), responsesPHP(projectName, authorName));
    if (features.database) {
      fs.writeFileSync(cfg('database.php'), databasePHP(projectName, authorName));
    }

    // ── PHP includes layer ─────────────────────────────────────────────────
    const inc = (f) => path.join(projectPath, 'includes', f);
    fs.writeFileSync(inc('headers.php'),  headersPHP(projectName, authorName));
    fs.writeFileSync(inc('helpers.php'),  helpersPHP(projectName, authorName));
    if (features.contactForm) {
      fs.writeFileSync(inc('rate_limit.php'), rateLimitPHP(projectName, authorName));
      if (features.phpMailer) {
        fs.writeFileSync(inc('mailer.php'), mailerPHP(projectName, authorName));
      }
    }
    if (features.auth) {
      fs.writeFileSync(inc('auth-check.php'), authCheckPHP(projectName, authorName));
    }

    // ── Contact form ───────────────────────────────────────────────────────
    if (features.contactForm) {
      fs.writeFileSync(path.join(projectPath, 'api', 'contact.php'),         contactPHP(projectName, authorName, features.phpMailer));
      fs.writeFileSync(path.join(projectPath, 'api', 'email_templates.php'), emailTemplatesPHP(projectName, authorName));
    }

    // ── Auth API ───────────────────────────────────────────────────────────
    if (features.auth) {
      const auth = (f) => path.join(projectPath, 'api', 'auth', f);
      fs.writeFileSync(auth('login.php'),           loginPHP(projectName, authorName));
      fs.writeFileSync(auth('register.php'),        registerPHP(projectName, authorName));
      fs.writeFileSync(auth('logout.php'),          logoutPHP(projectName, authorName));
      fs.writeFileSync(auth('forgot-password.php'), forgotPasswordPHP(projectName, authorName, features.phpMailer));
      fs.writeFileSync(auth('reset-password.php'),  resetPasswordPHP(projectName, authorName));

      // Auth pages
      const pg = (f) => path.join(projectPath, 'pages', f);
      fs.writeFileSync(pg('login.php'),           loginPagePHP(projectName));
      fs.writeFileSync(pg('forgot-password.php'), forgotPasswordPagePHP(projectName));
      fs.writeFileSync(pg('reset-password.php'),  resetPasswordPagePHP(projectName));
      fs.writeFileSync(pg('dashboard.php'),       userDashboardPHP(projectName, authorName));
    }

    // ── Admin ──────────────────────────────────────────────────────────────
    if (features.admin) {
      fs.writeFileSync(path.join(projectPath, 'api', 'admin', 'dashboard.php'), adminDashboardAPIPHP(projectName, authorName));
      fs.writeFileSync(path.join(projectPath, 'admin', 'dashboard.php'),        adminPagePHP(projectName, authorName));
    }

    // ── Webhooks ───────────────────────────────────────────────────────────
    if (complexity === 'complex') {
      fs.writeFileSync(path.join(projectPath, 'api', 'webhooks', 'webhook.php'), webhookPHP(projectName, authorName));
    }

    // ── Database schema ────────────────────────────────────────────────────
    if (features.database) {
      fs.writeFileSync(path.join(projectPath, 'database', 'database.sql'), dbSchema(projectName, authorName));
    }

    // ── Composer ───────────────────────────────────────────────────────────
    if (features.phpMailer) {
      writeComposerJson(projectPath, projectName, authorName);
      await installPHPMailer(projectPath, appConfig);
    }
  }

  // ── Phosphor Icons ─────────────────────────────────────────────────────────
  if (features.phosphorIcons) {
    await downloadPhosphorIcons(projectPath);
  }

  // ── Docs ──────────────────────────────────────────────────────────────────
  fs.writeFileSync(path.join(projectPath, 'README.md'),       generateReadme(projectConfig));
  fs.writeFileSync(path.join(projectPath, 'ARCHITECTURE.md'), generateArchitecture(projectConfig));

  // ── Post-generation output ─────────────────────────────────────────────────
  console.log(chalk.bold.green(`\n✅ Project "${projectName}" created!\n`));
  console.log(chalk.bold('📁 ' + projectName + '/'));
  printTree(projectPath);

  console.log(chalk.bold('\n🚀 Next steps:\n'));
  console.log(chalk.cyan(`   cd ${projectName}`));
  if (phpBackend) {
    console.log(chalk.cyan('   cp .env.example .env'));
    console.log(chalk.dim('   # Edit .env with your DB credentials and SMTP settings'));
    if (features.database) {
      console.log(chalk.cyan('   mysql -u root -p < database/database.sql'));
    }
    if (features.phpMailer) {
      console.log(chalk.cyan('   composer install'));
    }
    console.log(chalk.cyan('   php -S localhost:8000'));
  } else {
    console.log(chalk.dim('   # Open index.php in your browser or set up a local server'));
    console.log(chalk.cyan('   php -S localhost:8000'));
  }

  console.log(chalk.bold.magenta(`\n🛠  Happy coding, ${authorName}! 🚀\n`));
}

module.exports = { createProject };
