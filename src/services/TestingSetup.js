'use strict';

const fs   = require('fs');
const path = require('path');

// ── PHPUnit config for Custom PHP ────────────────────────────────────────────

function phpUnitXml(projectName) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true">
    <testsuites>
        <testsuite name="${projectName}">
            <directory suffix="Test.php">./tests</directory>
        </testsuite>
    </testsuites>
</phpunit>
`;
}

function phpExampleTest(projectName) {
  return `<?php

use PHPUnit\\Framework\\TestCase;

class ExampleTest extends TestCase
{
    public function test_true_is_true(): void
    {
        $this->assertTrue(true);
    }
}
`;
}

// ── Vitest config for React ──────────────────────────────────────────────────

function vitestConfig(useTs, srcDir = 'src') {
  return `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './${srcDir}/setupTests.${useTs ? 'ts' : 'js'}',
  },
});
`;
}

function vitestSetup() {
  return `import '@testing-library/jest-dom';\n`;
}

function reactAppTest(useTs) {
  const ext = useTs ? 'tsx' : 'jsx';
  return `import { render, screen } from '@testing-library/react';
import App from '../App.${ext}';

test('renders app', () => {
  render(<App />);
  expect(document.body).toBeTruthy();
});
`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Write testing scaffolding for a Custom PHP project.
 */
function setupPhp(projectDir, projectName) {
  const testsDir = path.join(projectDir, 'tests');
  fs.mkdirSync(testsDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'phpunit.xml'),           phpUnitXml(projectName));
  fs.writeFileSync(path.join(testsDir,   'ExampleTest.php'),       phpExampleTest(projectName));
}

/**
 * Write Vitest setup for a React frontend.
 * @param {string}  frontendDir  Path to the React app root
 * @param {boolean} useTs
 * @param {string}  srcDir       Source directory relative to frontendDir (default: 'src').
 *                               Pass 'resources/js' for Inertia projects.
 */
function setupReact(frontendDir, useTs = false, srcDir = 'src') {
  const ext     = useTs ? 'ts' : 'js';
  const testDir = path.join(frontendDir, srcDir, '__tests__');
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(path.join(frontendDir, `vitest.config.${ext}`),                    vitestConfig(useTs, srcDir));
  fs.writeFileSync(path.join(frontendDir, srcDir, `setupTests.${ext}`),               vitestSetup());
  fs.writeFileSync(path.join(testDir,     `App.test.${useTs ? 'tsx' : 'jsx'}`),       reactAppTest(useTs));
}

module.exports = { setupPhp, setupReact };
