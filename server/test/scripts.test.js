import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const readJson = (relative) => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const rootPkg = readJson('../../package.json');
const serverPkg = readJson('../package.json');

describe('npm scripts are cross-platform', () => {
  const scripts = [
    ...Object.entries(rootPkg.scripts).map(([name, cmd]) => [`root:${name}`, cmd]),
    ...Object.entries(serverPkg.scripts).map(([name, cmd]) => [`server:${name}`, cmd]),
  ];

  // `VAR=value cmd` is POSIX-shell syntax and fails in Windows cmd/PowerShell.
  it.each(scripts)('%s sets env vars only through cross-env', (name, cmd) => {
    for (const part of cmd.split(/&&|\|\||;/)) {
      if (/\b[A-Z_][A-Z0-9_]*=\S/.test(part)) expect(part.trim()).toMatch(/^cross-env\s/);
    }
  });

  it('runs the production server with NODE_ENV=production via cross-env', () => {
    expect(serverPkg.scripts.start).toBe('cross-env NODE_ENV=production node src/index.js');
    expect(rootPkg.scripts.start).toBe('npm run start -w server');
  });

  it('ships cross-env as a runtime dependency (dev deps are skipped in production installs)', () => {
    expect(serverPkg.dependencies).toHaveProperty('cross-env');
  });
});
