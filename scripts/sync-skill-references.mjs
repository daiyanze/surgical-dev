#!/usr/bin/env node
// Bundle referenced Markdown alongside Skills for standalone installers.
// Pi loads the whole package; the skills CLI installs skill directories separately.
// No network calls or agent setup are performed here.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const LINK = /\]\(((?:\.\.\/\.\.\/|references\/)(?:roles|references|contracts|templates)\/[^)#]+)(#[^)]*)?\)/g;

const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);

const stale = [];
for (const name of readdirSync(join(root, 'skills')).sort()) {
  const skillDir = join(root, 'skills', name);
  const skill = join(skillDir, 'SKILL.md');
  if (!existsSync(skill)) continue;
  const original = readFileSync(skill, 'utf8');
  const expected = new Set();
  const updated = original.replace(LINK, (_, path, fragment = '') => {
    const rel = path.startsWith('../../') ? path.slice(6) : path.slice('references/'.length);
    const source = resolve(root, rel);
    if (!existsSync(source) || !statSync(source).isFile() || !source.startsWith(root + sep)) {
      throw new Error(`Missing/out-of-package reference: ${skill}: ${path}`);
    }
    const dest = join(skillDir, 'references', rel);
    expected.add(dest);
    const desired = readFileSync(source);
    if (!existsSync(dest) || !readFileSync(dest).equals(desired)) {
      if (check) stale.push(relative(root, dest));
      else { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, desired); }
    }
    return `](${relative(skillDir, dest).split(sep).join('/')}${fragment})`;
  });
  if (updated !== original) {
    if (check) stale.push(relative(root, skill));
    else writeFileSync(skill, updated);
  }
  const refDir = join(skillDir, 'references');
  if (existsSync(refDir)) {
    for (const f of walk(refDir)) if (f.endsWith('.md') && !expected.has(f)) stale.push(relative(root, f));
  }
}
if (stale.length) {
  console.log('Unexpected or unsynchronized Skill files:\n' + stale.join('\n'));
  process.exit(1);
}
console.log(`Skill reference bundles: ${check ? 'current' : 'synchronized'}`);
