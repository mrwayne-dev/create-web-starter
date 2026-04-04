#!/usr/bin/env node
const shell = require("shelljs");
const inquirer = require("inquirer").default;
const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const AdmZip = require("adm-zip");

// 📌 Config file for storing your name + composer path
const configPath = path.join(os.homedir(), ".webstarterrc.json");

// Load saved configuration (author & composer) or return defaults
function loadConfig() {
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath));
  }
  return { authorName: null, composerPath: null };
}

// Save configuration data
function saveConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

// Ask for author name once and save forever
async function getAuthorName(config) {
  if (config.authorName) return config.authorName;

  const ans = await inquirer.prompt([
    {
      name: "authorName",
      message: "✨ Your name (creator of projects):",
      validate: (input) => input ? true : "Name cannot be empty."
    }
  ]);

  config.authorName = ans.authorName;
  saveConfig(config);
  return ans.authorName;
}

// Build the correct shell command for any composer path
// .phar files must be invoked as: php "path/to/composer.phar"
function buildComposerCmd(composerPath) {
  if (composerPath.toLowerCase().endsWith(".phar")) {
    return `php "${composerPath}"`;
  }
  // Plain "composer" found in PATH — no quoting needed
  if (composerPath === "composer") return "composer";
  // Absolute path to .exe / .bat
  return `"${composerPath}"`;
}

// Find composer on the system. Validates that it actually runs before returning it.
function findComposer(config) {
  // Validate and use saved path if it still works
  if (config.composerPath && shell.test("-e", config.composerPath)) {
    const cmd = buildComposerCmd(config.composerPath);
    if (shell.exec(`${cmd} --version`, { silent: true }).code === 0) {
      return config.composerPath;
    }
    // Stale / broken path — clear it
    console.log("⚠  Saved composer path no longer works. Searching again...");
    config.composerPath = null;
    saveConfig(config);
  }

  // Check PATH (covers global installs and Composer's Windows installer)
  if (shell.which("composer")) return "composer";

  // Common Windows install locations (.bat preferred over .exe for PATH resolution)
  const windowsPaths = [
    "C:\\ProgramData\\ComposerSetup\\bin\\composer.bat",
    "C:\\ProgramData\\ComposerSetup\\bin\\composer.exe",
    "C:\\Program Files\\Composer\\composer.bat",
    "C:\\Program Files\\Composer\\composer.exe",
    `${process.env.USERPROFILE}\\AppData\\Local\\ComposerSetup\\bin\\composer.bat`,
    `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Composer\\composer.bat`,
    "C:\\tools\\composer\\composer.bat",   // Chocolatey
    "C:\\ProgramData\\chocolatey\\bin\\composer.bat"
  ];

  for (const p of windowsPaths) {
    if (shell.test("-e", p)) return p;
  }

  // Check for a .phar file in the user's webstarter cache
  const cachedPhar = path.join(os.homedir(), ".webstarter", "composer.phar");
  if (shell.test("-e", cachedPhar) && shell.which("php")) {
    if (shell.exec(`php "${cachedPhar}" --version`, { silent: true }).code === 0) {
      return cachedPhar;
    }
  }

  return null;
}

// Auto-download composer.phar to ~/.webstarter/ (requires PHP in PATH)
async function downloadComposerPhar(config) {
  if (!shell.which("php")) {
    console.log("❌ PHP is not in PATH. Install PHP first: https://www.php.net/downloads");
    return null;
  }

  const cacheDir = path.join(os.homedir(), ".webstarter");
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  const pharPath = path.join(cacheDir, "composer.phar");
  console.log("⬇  Downloading composer.phar to " + pharPath + " ...");

  return new Promise((resolve) => {
    const file = fs.createWriteStream(pharPath);

    const doDownload = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          doDownload(response.headers.location);
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          if (shell.exec(`php "${pharPath}" --version`, { silent: true }).code === 0) {
            console.log("✅ Composer downloaded successfully!");
            config.composerPath = pharPath;
            saveConfig(config);
            resolve(pharPath);
          } else {
            if (fs.existsSync(pharPath)) fs.unlinkSync(pharPath);
            console.log("⚠  Downloaded composer.phar appears invalid.");
            resolve(null);
          }
        });
      }).on("error", () => {
        if (fs.existsSync(pharPath)) fs.unlinkSync(pharPath);
        console.log("⚠  Failed to download composer.phar.");
        resolve(null);
      });
    };

    doDownload("https://getcomposer.org/composer-stable.phar");
  });
}

// Ask user for Composer path if missing and save it
async function requestComposerPath(config) {
  const ans = await inquirer.prompt([
    {
      name: "composerPath",
      message: "📌 Paste the full path to composer.exe / composer.phar:",
      validate: (input) => {
        if (!shell.test("-e", input.trim())) return "❌ File not found. Check the path and try again.";
        return true;
      }
    }
  ]);

  const p = ans.composerPath.trim();
  // Validate it actually runs
  const cmd = buildComposerCmd(p);
  if (shell.exec(`${cmd} --version`, { silent: true }).code !== 0) {
    console.log("⚠  That path exists but composer failed to run with it.");
    return null;
  }

  config.composerPath = p;
  saveConfig(config);
  return p;
}

// Write composer.json directly — avoids relying on interactive `composer init`
function writeComposerJson(projectPath, projectName, authorName) {
  const packageName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const composerJson = {
    name: `${packageName}/${packageName}`,
    description: `${projectName} - PHP Web Application`,
    type: "project",
    authors: [{ name: authorName }],
    require: {
      php: ">=7.4"
    },
    autoload: {
      "psr-4": { "App\\": "src/" }
    },
    config: {
      "optimize-autoloader": true
    }
  };

  fs.writeFileSync(
    path.join(projectPath, "composer.json"),
    JSON.stringify(composerJson, null, 4)
  );
  console.log("📋 composer.json created.");
}

// Find or ask for composer path, then install PHPMailer
async function installPHPMailer(projectPath, config) {
  console.log("\n📨 Preparing PHPMailer installation...");

  let composerPath = findComposer(config);

  if (!composerPath) {
    console.log("\n⚠  Composer not found on your system.");

    const { action } = await inquirer.prompt([
      {
        name: "action",
        type: "list",
        message: "How would you like to proceed?",
        choices: [
          { name: "⬇  Auto-download composer.phar (requires PHP in PATH)", value: "auto" },
          { name: "📌 I have composer — let me enter the path manually",    value: "manual" },
          { name: "⏭  Skip PHPMailer for now",                              value: "skip" }
        ]
      }
    ]);

    if (action === "auto") {
      composerPath = await downloadComposerPhar(config);
    } else if (action === "manual") {
      composerPath = await requestComposerPath(config);
    } else {
      console.log("⏭  Skipping PHPMailer. Install later: composer require phpmailer/phpmailer");
      return;
    }

    if (!composerPath) {
      console.log("❌ Could not find a working Composer. Skipping PHPMailer.");
      console.log("💡 Install Composer from: https://getcomposer.org/download/");
      console.log("💡 Then run inside the project: composer require phpmailer/phpmailer");
      return;
    }
  }

  const composerCmd = buildComposerCmd(composerPath);
  console.log("📦 Installing PHPMailer via Composer...");

  // --working-dir ensures composer always targets the correct project folder
  const result = shell.exec(
    `${composerCmd} require phpmailer/phpmailer --working-dir="${projectPath}"`
  );

  if (result.code !== 0) {
    console.log("⚠  PHPMailer installation failed.");
    console.log("💡 Try manually inside your project:");
    console.log("   cd " + projectPath);
    console.log("   composer require phpmailer/phpmailer");
  } else {
    console.log("✅ PHPMailer installed successfully!");
  }
}

// 🎨 Download Phosphor Icons
async function downloadPhosphorIcons(projectPath) {
  console.log("\n🎨 Downloading Phosphor Icons...");

  const iconsDir = path.join(projectPath, "assets", "icons");
  const zipPath = path.join(projectPath, "phosphor-icons.zip");

  const downloadUrl = "https://github.com/phosphor-icons/core/archive/refs/heads/main.zip";

  return new Promise((resolve) => {
    const file = fs.createWriteStream(zipPath);

    const handleRedirect = (url) => {
      https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          handleRedirect(response.headers.location);
          return;
        }
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          extractPhosphorIcons(zipPath, iconsDir);
          resolve();
        });
      }).on("error", () => {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
        console.log("⚠️  Could not download Phosphor Icons. Add them manually from https://phosphoricons.com");
        resolve();
      });
    };

    https.get(downloadUrl, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(zipPath);
        handleRedirect(response.headers.location);
        return;
      }
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        extractPhosphorIcons(zipPath, iconsDir);
        resolve();
      });
    }).on("error", () => {
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      console.log("⚠️  Could not download Phosphor Icons. Add them manually from https://phosphoricons.com");
      resolve();
    });
  });
}

// Extract Phosphor Icons from ZIP
function extractPhosphorIcons(zipPath, targetDir) {
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(targetDir, true);
    fs.unlinkSync(zipPath);
    console.log("✅ Phosphor Icons extracted successfully!");
    console.log("📁 Icons available in: assets/icons/");
  } catch (error) {
    console.log("⚠️  Error extracting icons. Add them manually from https://phosphoricons.com");
  }
}

// 🏗️ MAIN PROJECT CREATOR
async function createProject({ projectName, includeAuth, includeAdmin, includeMailer, includeIcons }, authorName, config) {
  const projectPath = path.join(process.cwd(), projectName);

  if (shell.test("-e", projectPath)) {
    console.log(`❌ Folder "${projectName}" already exists.`);
    return;
  }

  console.log(`\n✨ Creating project: ${projectName}...`);
  shell.mkdir("-p", projectPath);

  const header = (extra = "") => `<?php
/**
 * Project: ${projectName}
 * Created by: ${authorName}
 * Generated: ${new Date().toISOString().split("T")[0]}
 * ${extra}
 */
`;

  console.log("📂 Creating folder structure...");

  // Build full folder list matching the truepathexpress structure
  const folders = [
    "api/auth",
    "api/payments",
    "api/tracking",
    "api/utilities",
    "api/webhooks",
    "assets/css/admin",
    "assets/js",
    "assets/fonts",
    "assets/images",
    "assets/favicon",
    "assets/icons",
    "config",
    "includes",
    "pages/public",
    "pages/user",
    "uploads",
    "dbschema",
    "src"
  ];

  if (includeAdmin) {
    folders.push("api/admin-dashboard", "pages/admin");
  }

  folders.forEach((f) => shell.mkdir("-p", path.join(projectPath, f)));

  // ── Database schema ──────────────────────────────────────────────────────────
  const dbSchema = `-- Database Schema for ${projectName}
-- Generated by WebStarter CLI
-- Created by ${authorName}

CREATE DATABASE IF NOT EXISTS \`${projectName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}\`;
USE \`${projectName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}\`;

CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\`           INT AUTO_INCREMENT PRIMARY KEY,
  \`email\`        VARCHAR(255) UNIQUE NOT NULL,
  \`password\`     VARCHAR(255) NOT NULL,
  \`full_name\`    VARCHAR(255),
  \`created_at\`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  \`is_verified\`  BOOLEAN DEFAULT FALSE,
  \`role\`         ENUM('user','admin') DEFAULT 'user'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`password_resets\` (
  \`id\`          INT AUTO_INCREMENT PRIMARY KEY,
  \`email\`       VARCHAR(255) NOT NULL,
  \`token\`       VARCHAR(255) NOT NULL,
  \`created_at\`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`expires_at\`  TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`sessions\` (
  \`id\`             INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\`        INT NOT NULL,
  \`session_token\`  VARCHAR(255) UNIQUE NOT NULL,
  \`ip_address\`     VARCHAR(45),
  \`user_agent\`     TEXT,
  \`created_at\`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`expires_at\`     TIMESTAMP NOT NULL,
  FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

  fs.writeFileSync(path.join(projectPath, "dbschema", "database.sql"), dbSchema);

  // ── CSS ──────────────────────────────────────────────────────────────────────
  const mainCSS = `/* ${projectName} - Main Styles */
:root {
  --primary-color: #3b82f6;
  --secondary-color: #8b5cf6;
  --text-color: #1f2937;
  --bg-color: #ffffff;
  --border-color: #e5e7eb;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: var(--text-color);
  background-color: var(--bg-color);
  line-height: 1.6;
}

.container { max-width: 1200px; margin: 0 auto; padding: 0 1rem; }

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.btn-primary { background-color: var(--primary-color); color: white; }
.btn-primary:hover { opacity: 0.9; }
`;

  const responsiveCSS = `/* Responsive Styles */
@media (max-width: 768px) {
  .container { padding: 0 0.5rem; }
  h1 { font-size: 1.75rem; }
}
@media (max-width: 480px) {
  .btn { width: 100%; }
}
`;

  const adminCSS = `/* Admin Panel Styles - ${projectName} */
:root {
  --admin-sidebar-width: 260px;
  --admin-header-height: 60px;
  --admin-primary: #1e293b;
  --admin-accent: #3b82f6;
}

.admin-layout {
  display: flex;
  min-height: 100vh;
}

.admin-sidebar {
  width: var(--admin-sidebar-width);
  background: var(--admin-primary);
  color: #fff;
  padding: 1rem;
}

.admin-main {
  flex: 1;
  padding: 2rem;
  background: #f8fafc;
}

.admin-header {
  height: var(--admin-header-height);
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
}

.stat-card {
  background: #fff;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: 0.75rem;
  overflow: hidden;
}

.data-table th, .data-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid #e2e8f0;
}

.data-table th { background: #f1f5f9; font-weight: 600; }
`;

  fs.writeFileSync(path.join(projectPath, "assets", "css", "main.css"), mainCSS);
  fs.writeFileSync(path.join(projectPath, "assets", "css", "responsive.css"), responsiveCSS);
  fs.writeFileSync(path.join(projectPath, "assets", "css", "admin", "styles.css"), adminCSS);

  // ── .env ─────────────────────────────────────────────────────────────────────
  const envTemplate = `# Environment Configuration - ${projectName}

# Database
DB_HOST=localhost
DB_NAME=${projectName.toLowerCase().replace(/[^a-z0-9_]/g, "_")}
DB_USER=root
DB_PASS=

# Application
APP_NAME="${projectName}"
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
SMTP_FROM=noreply@${projectName.toLowerCase()}.com
SMTP_FROM_NAME="${projectName}"
`;

  fs.writeFileSync(path.join(projectPath, ".env"), envTemplate);

  // ── Config files ──────────────────────────────────────────────────────────────
  const constantsFile = header() + `
define('APP_ROOT', dirname(__DIR__));
define('CONFIG_PATH', APP_ROOT . '/config');
define('INCLUDES_PATH', APP_ROOT . '/includes');
define('UPLOADS_PATH', APP_ROOT . '/uploads');

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

  const envFile = header() + `
function loadEnv($path) {
    if (!file_exists($path)) return;

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') === false) continue;

        list($name, $value) = explode('=', $line, 2);
        $name  = trim($name);
        $value = trim($value, " \t\n\r\0\x0B\"'");

        if (!array_key_exists($name, $_ENV)) {
            putenv("$name=$value");
            $_ENV[$name] = $value;
        }
    }
}

loadEnv(dirname(__DIR__) . '/.env');
`;

  const databaseFile = header() + `
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
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        return $this->conn;
    }
}
`;

  fs.writeFileSync(path.join(projectPath, "config", "constants.php"), constantsFile);
  fs.writeFileSync(path.join(projectPath, "config", "env.php"), envFile);
  fs.writeFileSync(path.join(projectPath, "config", "database.php"), databaseFile);

  // ── Auth files ────────────────────────────────────────────────────────────────
  if (includeAuth) {
    const loginAPI = header() + `
require_once '../../config/database.php';
header('Content-Type: application/json');
session_start();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input    = json_decode(file_get_contents('php://input'), true);
$email    = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if (empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Email and password required']);
    exit;
}

try {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT * FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['email']   = $user['email'];
        $_SESSION['role']    = $user['role'];
        echo json_encode(['success' => true, 'message' => 'Login successful']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid credentials']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
`;

    const registerAPI = header() + `
require_once '../../config/database.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input     = json_decode(file_get_contents('php://input'), true);
$email     = trim($input['email'] ?? '');
$password  = $input['password'] ?? '';
$full_name = trim($input['full_name'] ?? '');

if (empty($email) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Email and password required']);
    exit;
}

if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters']);
    exit;
}

try {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);

    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Email already registered']);
        exit;
    }

    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $stmt   = $db->prepare("INSERT INTO users (email, password, full_name) VALUES (:email, :password, :full_name)");
    $stmt->execute(['email' => $email, 'password' => $hashed, 'full_name' => $full_name]);

    echo json_encode(['success' => true, 'message' => 'Registration successful']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
`;

    const logoutAPI = header() + `
session_start();
session_destroy();
header('Content-Type: application/json');
echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
`;

    const forgotPasswordAPI = header() + `
require_once '../../config/database.php';
${includeMailer ? "require_once __DIR__ . '/../../vendor/autoload.php';\nuse PHPMailer\\PHPMailer\\PHPMailer;\nuse PHPMailer\\PHPMailer\\SMTP;\nuse PHPMailer\\PHPMailer\\Exception;" : ""}
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$email = trim($input['email'] ?? '');

if (empty($email)) {
    echo json_encode(['success' => false, 'message' => 'Email is required']);
    exit;
}

try {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch();

    // Always return success to prevent email enumeration
    if (!$user) {
        echo json_encode(['success' => true, 'message' => 'If this email exists, a reset link has been sent']);
        exit;
    }

    $token      = bin2hex(random_bytes(32));
    $expires_at = date('Y-m-d H:i:s', strtotime('+1 hour'));

    // Remove any existing tokens for this email
    $db->prepare("DELETE FROM password_resets WHERE email = :email")->execute(['email' => $email]);

    $stmt = $db->prepare("INSERT INTO password_resets (email, token, expires_at) VALUES (:email, :token, :expires_at)");
    $stmt->execute(['email' => $email, 'token' => $token, 'expires_at' => $expires_at]);

    $resetLink = getenv('APP_URL') . '/pages/public/reset-password.php?token=' . $token;

    ${includeMailer ? `
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = getenv('SMTP_HOST');
    $mail->SMTPAuth   = true;
    $mail->Username   = getenv('SMTP_USER');
    $mail->Password   = getenv('SMTP_PASS');
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = (int) getenv('SMTP_PORT');

    $mail->setFrom(getenv('SMTP_FROM'), getenv('SMTP_FROM_NAME'));
    $mail->addAddress($email);
    $mail->isHTML(true);
    $mail->Subject = 'Password Reset - ' . getenv('APP_NAME');
    $mail->Body    = '<p>Click the link below to reset your password (expires in 1 hour):</p>'
                   . '<p><a href="' . $resetLink . '">' . $resetLink . '</a></p>';
    $mail->send();` : `
    // TODO: Send email with reset link: $resetLink`}

    echo json_encode(['success' => true, 'message' => 'If this email exists, a reset link has been sent']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
`;

    const resetPasswordAPI = header() + `
require_once '../../config/database.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input    = json_decode(file_get_contents('php://input'), true);
$token    = trim($input['token'] ?? '');
$password = $input['password'] ?? '';

if (empty($token) || empty($password)) {
    echo json_encode(['success' => false, 'message' => 'Token and new password are required']);
    exit;
}

if (strlen($password) < 8) {
    echo json_encode(['success' => false, 'message' => 'Password must be at least 8 characters']);
    exit;
}

try {
    $db   = Database::getInstance()->getConnection();
    $stmt = $db->prepare(
        "SELECT * FROM password_resets WHERE token = :token AND expires_at > NOW()"
    );
    $stmt->execute(['token' => $token]);
    $reset = $stmt->fetch();

    if (!$reset) {
        echo json_encode(['success' => false, 'message' => 'Invalid or expired reset token']);
        exit;
    }

    $hashed = password_hash($password, PASSWORD_DEFAULT);
    $db->prepare("UPDATE users SET password = :password WHERE email = :email")
       ->execute(['password' => $hashed, 'email' => $reset['email']]);

    $db->prepare("DELETE FROM password_resets WHERE email = :email")
       ->execute(['email' => $reset['email']]);

    echo json_encode(['success' => true, 'message' => 'Password reset successfully']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
`;

    fs.writeFileSync(path.join(projectPath, "api", "auth", "login.php"), loginAPI);
    fs.writeFileSync(path.join(projectPath, "api", "auth", "register.php"), registerAPI);
    fs.writeFileSync(path.join(projectPath, "api", "auth", "logout.php"), logoutAPI);
    fs.writeFileSync(path.join(projectPath, "api", "auth", "forgot-password.php"), forgotPasswordAPI);
    fs.writeFileSync(path.join(projectPath, "api", "auth", "reset-password.php"), resetPasswordAPI);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────
  const authCheck = header() + `
session_start();

function requireAuth() {
    if (!isset($_SESSION['user_id'])) {
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }
}

function requireAdmin() {
    requireAuth();
    if ($_SESSION['role'] !== 'admin') {
        header('Content-Type: application/json');
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Forbidden']);
        exit;
    }
}

function getAuthUser() {
    return [
        'id'    => $_SESSION['user_id'] ?? null,
        'email' => $_SESSION['email']   ?? null,
        'role'  => $_SESSION['role']    ?? null,
    ];
}
`;

  const contactAPI = header() + `
require_once '../../config/env.php';
${includeMailer ? "require_once __DIR__ . '/../../vendor/autoload.php';\nuse PHPMailer\\PHPMailer\\PHPMailer;\nuse PHPMailer\\PHPMailer\\SMTP;\nuse PHPMailer\\PHPMailer\\Exception;" : ""}
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$input   = json_decode(file_get_contents('php://input'), true);
$name    = htmlspecialchars(trim($input['name']    ?? ''), ENT_QUOTES, 'UTF-8');
$email   = filter_var(trim($input['email']  ?? ''), FILTER_VALIDATE_EMAIL);
$subject = htmlspecialchars(trim($input['subject'] ?? 'Contact Form'), ENT_QUOTES, 'UTF-8');
$message = htmlspecialchars(trim($input['message'] ?? ''), ENT_QUOTES, 'UTF-8');

if (!$name || !$email || !$message) {
    echo json_encode(['success' => false, 'message' => 'Name, email, and message are required']);
    exit;
}

${includeMailer ? `
try {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = getenv('SMTP_HOST');
    $mail->SMTPAuth   = true;
    $mail->Username   = getenv('SMTP_USER');
    $mail->Password   = getenv('SMTP_PASS');
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = (int) getenv('SMTP_PORT');

    $mail->setFrom(getenv('SMTP_FROM'), getenv('SMTP_FROM_NAME'));
    $mail->addAddress(getenv('SMTP_USER'));
    $mail->addReplyTo($email, $name);
    $mail->isHTML(true);
    $mail->Subject = $subject . ' - Contact Form';
    $mail->Body    = "<p><strong>From:</strong> $name ($email)</p>"
                   . "<p><strong>Message:</strong><br>" . nl2br($message) . "</p>";
    $mail->send();

    echo json_encode(['success' => true, 'message' => 'Message sent successfully']);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to send message']);
}
` : `
// PHPMailer not installed — log or handle the message here
error_log("Contact from $name ($email): $message");
echo json_encode(['success' => true, 'message' => 'Message received']);
`}
`;

  const emailTemplates = header() + `
/**
 * Email template helpers for ${projectName}
 * Usage: EmailTemplates::welcome($name, $email)
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
              . "<p>Hi $name, click the button below to reset your password. This link expires in 1 hour.</p>"
              . "<a class='btn' href='$resetLink'>Reset Password</a>"
              . "<p style='margin-top:16px;font-size:12px;color:#6b7280;'>If you didn't request this, ignore this email.</p>";
        return self::layout('Password Reset', $body);
    }
}
`;

  const imageUpload = header() + `
require_once '../../config/env.php';
require_once '../../api/utilities/auth-check.php';
header('Content-Type: application/json');

requireAuth();

$allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
$maxSize      = 5 * 1024 * 1024; // 5 MB

if (!isset($_FILES['image'])) {
    echo json_encode(['success' => false, 'message' => 'No image uploaded']);
    exit;
}

$file = $_FILES['image'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(['success' => false, 'message' => 'Upload error']);
    exit;
}

if (!in_array($file['type'], $allowedTypes)) {
    echo json_encode(['success' => false, 'message' => 'Only JPEG, PNG, GIF, WEBP allowed']);
    exit;
}

if ($file['size'] > $maxSize) {
    echo json_encode(['success' => false, 'message' => 'File too large (max 5MB)']);
    exit;
}

$ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
$filename = uniqid('img_', true) . '.' . strtolower($ext);
$dest     = dirname(__DIR__, 2) . '/uploads/' . $filename;

if (move_uploaded_file($file['tmp_name'], $dest)) {
    $url = getenv('APP_URL') . '/uploads/' . $filename;
    echo json_encode(['success' => true, 'url' => $url, 'filename' => $filename]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to save file']);
}
`;

  fs.writeFileSync(path.join(projectPath, "api", "utilities", "auth-check.php"), authCheck);
  fs.writeFileSync(path.join(projectPath, "api", "utilities", "contact.php"), contactAPI);
  fs.writeFileSync(path.join(projectPath, "api", "utilities", "email_templates.php"), emailTemplates);
  fs.writeFileSync(path.join(projectPath, "api", "utilities", "image-upload.php"), imageUpload);

  // ── Tracking ──────────────────────────────────────────────────────────────────
  const trackingAPI = header() + `
require_once '../../config/database.php';
header('Content-Type: application/json');

$trackingId = trim($_GET['id'] ?? '');

if (empty($trackingId)) {
    echo json_encode(['success' => false, 'message' => 'Tracking ID is required']);
    exit;
}

// TODO: Query your shipments/orders table using the tracking ID
// Example:
// $db   = Database::getInstance()->getConnection();
// $stmt = $db->prepare("SELECT * FROM shipments WHERE tracking_id = :id");
// $stmt->execute(['id' => $trackingId]);
// $shipment = $stmt->fetch();
//
// if (!$shipment) {
//     echo json_encode(['success' => false, 'message' => 'Tracking ID not found']);
//     exit;
// }
//
// echo json_encode(['success' => true, 'data' => $shipment]);

echo json_encode([
    'success' => true,
    'data'    => [
        'tracking_id' => $trackingId,
        'status'      => 'In Transit',
        'updated_at'  => date('Y-m-d H:i:s'),
    ]
]);
`;

  fs.writeFileSync(path.join(projectPath, "api", "tracking", "tracking.php"), trackingAPI);

  // ── Webhooks ──────────────────────────────────────────────────────────────────
  const webhookHandler = header() + `
// Webhook handler - verify signatures before processing
header('Content-Type: application/json');

$payload   = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_SIGNATURE'] ?? '';

// TODO: Verify the webhook signature from your payment/service provider
// Example for generic HMAC:
// $expected = hash_hmac('sha256', $payload, getenv('WEBHOOK_SECRET'));
// if (!hash_equals($expected, $signature)) {
//     http_response_code(401);
//     echo json_encode(['success' => false, 'message' => 'Invalid signature']);
//     exit;
// }

$data  = json_decode($payload, true);
$event = $data['event'] ?? '';

switch ($event) {
    case 'payment.completed':
        // TODO: Handle successful payment
        break;
    case 'payment.failed':
        // TODO: Handle failed payment
        break;
    default:
        // Unknown event — log it
        error_log('Unhandled webhook event: ' . $event);
}

http_response_code(200);
echo json_encode(['success' => true]);
`;

  fs.writeFileSync(path.join(projectPath, "api", "webhooks", "webhook.php"), webhookHandler);

  // ── Admin dashboard files ─────────────────────────────────────────────────────
  if (includeAdmin) {
    const adminDashboardAPI = header() + `
require_once '../../config/database.php';
require_once '../../api/utilities/auth-check.php';
header('Content-Type: application/json');

requireAdmin();

try {
    $db = Database::getInstance()->getConnection();

    $totalUsers  = $db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    $newToday    = $db->query("SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()")->fetchColumn();

    echo json_encode([
        'success' => true,
        'data'    => [
            'total_users' => (int) $totalUsers,
            'new_today'   => (int) $newToday,
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
`;

    const adminTransactionsAPI = header() + `
require_once '../../config/database.php';
require_once '../../api/utilities/auth-check.php';
header('Content-Type: application/json');

requireAdmin();

// TODO: Query your transactions table
// Example:
// $db   = Database::getInstance()->getConnection();
// $stmt = $db->query("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 50");
// echo json_encode(['success' => true, 'data' => $stmt->fetchAll()]);

echo json_encode(['success' => true, 'data' => []]);
`;

    const adminPackagesAPI = header() + `
require_once '../../config/database.php';
require_once '../../api/utilities/auth-check.php';
header('Content-Type: application/json');

requireAdmin();

// TODO: Query your packages/products table
echo json_encode(['success' => true, 'data' => []]);
`;

    fs.writeFileSync(path.join(projectPath, "api", "admin-dashboard", "dashboard.php"), adminDashboardAPI);
    fs.writeFileSync(path.join(projectPath, "api", "admin-dashboard", "transactions.php"), adminTransactionsAPI);
    fs.writeFileSync(path.join(projectPath, "api", "admin-dashboard", "packages.php"), adminPackagesAPI);

    const adminPage = header() + `
require_once '../../api/utilities/auth-check.php';
requireAdmin();
$user = getAuthUser();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin - ${projectName}</title>
    <link rel="stylesheet" href="../../assets/css/main.css">
    <link rel="stylesheet" href="../../assets/css/admin/styles.css">
</head>
<body>
<div class="admin-layout">
    <aside class="admin-sidebar">
        <h3>${projectName}</h3>
        <nav>
            <a href="dashboard.php">Dashboard</a>
        </nav>
    </aside>
    <div class="admin-main">
        <header class="admin-header">
            <span>Welcome, <?php echo htmlspecialchars($user['email']); ?></span>
        </header>
        <h1>Admin Dashboard</h1>
        <div id="stats"></div>
    </div>
</div>
<script>
fetch('/api/admin-dashboard/dashboard.php')
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            document.getElementById('stats').innerHTML =
                '<div class="stat-card"><h3>Total Users</h3><p>' + data.data.total_users + '</p></div>';
        }
    });
</script>
</body>
</html>
`;

    fs.writeFileSync(path.join(projectPath, "pages", "admin", "dashboard.php"), adminPage);
  }

  // ── Public pages ──────────────────────────────────────────────────────────────
  const indexPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <link rel="stylesheet" href="../../assets/css/main.css">
    <link rel="stylesheet" href="../../assets/css/responsive.css">
</head>
<body>
    <div class="container">
        <h1>Welcome to ${projectName}</h1>
        <p>Created by ${authorName}</p>
    </div>
</body>
</html>`;

  fs.writeFileSync(path.join(projectPath, "pages", "public", "index.php"), indexPage);

  if (includeAuth) {
    const loginPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - ${projectName}</title>
    <link rel="stylesheet" href="../../assets/css/main.css">
</head>
<body>
    <div class="container">
        <h1>Login</h1>
        <form id="loginForm">
            <input type="email" name="email" placeholder="Email" required><br><br>
            <input type="password" name="password" placeholder="Password" required><br><br>
            <button type="submit" class="btn btn-primary">Login</button>
        </form>
        <p><a href="forgot-password.php">Forgot password?</a></p>
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
        alert(result.message);
        if (result.success) window.location.href = '/pages/user/dashboard.php';
    });
    </script>
</body>
</html>`;

    const forgotPasswordPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forgot Password - ${projectName}</title>
    <link rel="stylesheet" href="../../assets/css/main.css">
</head>
<body>
    <div class="container">
        <h1>Forgot Password</h1>
        <form id="forgotForm">
            <input type="email" name="email" placeholder="Your email" required><br><br>
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
        document.getElementById('msg').textContent = result.message;
    });
    </script>
</body>
</html>`;

    const resetPasswordPage = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - ${projectName}</title>
    <link rel="stylesheet" href="../../assets/css/main.css">
</head>
<body>
    <div class="container">
        <h1>Reset Password</h1>
        <form id="resetForm">
            <input type="password" name="password" placeholder="New password" minlength="8" required><br><br>
            <input type="password" name="confirm" placeholder="Confirm password" required><br><br>
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
        document.getElementById('msg').textContent = result.message;
        if (result.success) setTimeout(() => window.location.href = '/pages/public/login.php', 2000);
    });
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(projectPath, "pages", "public", "login.php"), loginPage);
    fs.writeFileSync(path.join(projectPath, "pages", "public", "forgot-password.php"), forgotPasswordPage);
    fs.writeFileSync(path.join(projectPath, "pages", "public", "reset-password.php"), resetPasswordPage);
  }

  // ── User dashboard ────────────────────────────────────────────────────────────
  const userDashboard = header() + `
require_once '../../api/utilities/auth-check.php';
requireAuth();
$user = getAuthUser();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - ${projectName}</title>
    <link rel="stylesheet" href="../../assets/css/main.css">
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
        window.location.href = '/pages/public/login.php';
    }
    </script>
</body>
</html>
`;

  fs.writeFileSync(path.join(projectPath, "pages", "user", "dashboard.php"), userDashboard);

  // ── Root index.php ────────────────────────────────────────────────────────────
  const rootIndex = header() + `
header('Location: /pages/public/index.php');
exit;
`;
  fs.writeFileSync(path.join(projectPath, "index.php"), rootIndex);

  // ── .htaccess ─────────────────────────────────────────────────────────────────
  const htaccess = `# ${projectName} - Apache Config
Options -Indexes
RewriteEngine On
RewriteBase /

# Remove .php extension
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_FILENAME}\\.php -f
RewriteRule ^(.*)$ $1.php [L]

# Route unknown URLs to index.php
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.php [L,QSA]

# Block direct access to sensitive files
<FilesMatch "^\\.(env|gitignore|htaccess)$">
    Order allow,deny
    Deny from all
</FilesMatch>

# Prevent access to vendor directory
<IfModule mod_rewrite.c>
    RewriteRule ^vendor/ - [F,L]
</IfModule>
`;
  fs.writeFileSync(path.join(projectPath, ".htaccess"), htaccess);

  // ── .gitignore ────────────────────────────────────────────────────────────────
  const gitignore = `/vendor/
/node_modules/
.env
.vscode/
.idea/
*.log
/uploads/*
!uploads/.gitkeep
.DS_Store
Thumbs.db
`;
  fs.writeFileSync(path.join(projectPath, ".gitignore"), gitignore);

  // ── .gitattributes ────────────────────────────────────────────────────────────
  const gitattributes = `* text=auto
*.php text eol=lf
*.js  text eol=lf
*.css text eol=lf
*.sql text eol=lf
*.md  text eol=lf
`;
  fs.writeFileSync(path.join(projectPath, ".gitattributes"), gitattributes);

  // Keep uploads folder tracked in git
  fs.writeFileSync(path.join(projectPath, "uploads", ".gitkeep"), "");

  // ── README ────────────────────────────────────────────────────────────────────
  const readme = `# ${projectName}

> Created by **${authorName}** using WebStarter CLI

## Quick Setup

\`\`\`bash
# 1. Import database
mysql -u root -p < dbschema/database.sql

# 2. Configure environment
cp .env .env.local
# Edit .env with your DB credentials and SMTP settings

# 3. Install dependencies (if not already done)
composer install

# 4. Start dev server
php -S localhost:8000
\`\`\`

## Features

${includeAuth ? "- ✅ Authentication (login, register, forgot/reset password)" : ""}
${includeAdmin ? "- ✅ Admin panel (`/pages/admin/dashboard.php`)" : ""}
${includeMailer ? "- ✅ PHPMailer (SMTP email)" : ""}
${includeIcons ? "- ✅ Phosphor Icons (`assets/icons/`)" : ""}

## Project Structure

\`\`\`
├── api/
│   ├── auth/           # Login, register, password reset
│   ├── admin-dashboard/# Admin API endpoints
│   ├── tracking/       # Tracking endpoint
│   ├── utilities/      # Auth check, contact, image upload, email templates
│   └── webhooks/       # Webhook handler
├── assets/
│   ├── css/            # Stylesheets (+ admin/styles.css)
│   ├── fonts/          # Custom fonts
│   ├── icons/          # Phosphor Icons
│   └── images/
├── config/             # DB, env, constants
├── pages/
│   ├── public/         # Public-facing pages
│   ├── user/           # Authenticated user pages
│   └── admin/          # Admin pages
├── dbschema/           # SQL schema
└── uploads/            # User uploads
\`\`\`
`;
  fs.writeFileSync(path.join(projectPath, "README.md"), readme);

  // ── Write composer.json then install PHPMailer ────────────────────────────────
  if (includeMailer) {
    writeComposerJson(projectPath, projectName, authorName);
    await installPHPMailer(projectPath, config);
  }

  // ── Download Phosphor Icons ───────────────────────────────────────────────────
  if (includeIcons) {
    // Pass projectPath explicitly — NOT process.cwd() which points to the CLI dir
    await downloadPhosphorIcons(projectPath);
  }

  console.log(`\n🎉 Project "${projectName}" created at: ${projectPath}`);
  console.log(`\n🚀 Next steps:`);
  console.log(`   cd ${projectName}`);
  console.log(`   mysql -u root -p < dbschema/database.sql`);
  console.log(`   Edit .env with your DB + SMTP credentials`);
  console.log(`   php -S localhost:8000`);
  console.log("\n🛠  Happy coding, " + authorName + "! 🚀");
}

// 🎬 START
async function start() {
  console.log("\n╔════════════════════════════════════╗");
  console.log("║   WebStarter CLI - PHP Generator   ║");
  console.log("╚════════════════════════════════════╝\n");

  let config = loadConfig();
  const authorName = await getAuthorName(config);

  const answers = await inquirer.prompt([
    {
      name: "projectName",
      message: "📁 Project name:",
      validate: (input) => input.trim() ? true : "Project name is required"
    },
    {
      name: "includeAuth",
      type: "confirm",
      message: "🔐 Include authentication (login, register, forgot/reset password)?",
      default: true
    },
    {
      name: "includeAdmin",
      type: "confirm",
      message: "👨‍💼 Include admin panel?",
      default: false
    },
    {
      name: "includeMailer",
      type: "confirm",
      message: "📨 Install PHPMailer (requires Composer)?",
      default: true
    },
    {
      name: "includeIcons",
      type: "confirm",
      message: "🎨 Download Phosphor Icons?",
      default: true
    }
  ]);

  await createProject(answers, authorName, config);
}

start();
