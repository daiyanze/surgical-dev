import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skills = ['surgical-dev', 'ship-feature', 'fix-bug', 'delegate-bounded-task', 'verify-change', 'prepare-release'];
const read = path => readFileSync(resolve(root, path), 'utf8');
const json = path => JSON.parse(read(path));

function files(dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules' || entry.name === '.git') return [];
    const full = resolve(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
function withoutCode(text) {
  let fence = null;
  return text.split('\n').filter(line => {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (match) {
      if (fence === null) fence = match[1][0];
      else if (fence === match[1][0]) fence = null;
      return false;
    }
    return fence === null;
  }).join('\n');
}

test('manifest exposes only existing content, with no runtime hooks', () => {
  assert.ok(existsSync(resolve(root, 'package.json')), 'package.json is required');
  const pkg = json('package.json');
  assert.equal(pkg.name, 'surgical-dev');
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.pi, { skills: ['./skills'] });
  for (const path of pkg.files) assert.ok(existsSync(resolve(root, path)), `Missing packaged path: ${path}`);
  assert.ok(!pkg.dependencies, 'Content pack must have no runtime dependencies');
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) assert.ok(!pkg.scripts?.[hook]);
});

for (const name of skills) {
  test(`skill ${name} has valid metadata and bounded instructions`, () => {
    const path = `skills/${name}/SKILL.md`;
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
    const text = read(path);
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(match, 'YAML frontmatter is required');
    const metadata = Object.fromEntries(match[1].split('\n').filter(Boolean).map(line => {
      const pos = line.indexOf(':');
      assert.ok(pos > 0);
      return [line.slice(0, pos), line.slice(pos + 1).trim()];
    }));
    assert.equal(metadata.name, name);
    assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(metadata.description.startsWith('Use when'));
    assert.ok(metadata.description.length <= 1024);
    assert.ok(text.split('\n').length < 500);
    assert.ok(!text.includes('For now, only confirm'), 'Setup-only stop must not become a task rule');
    assert.ok(text.includes('## Return'), 'Output contract is required');
  });
}

test('three role assets exist without one-time setup instructions', () => {
  for (const role of ['engineer', 'verifier', 'worker']) {
    const path = `roles/${role}.md`;
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
    assert.ok(!read(path).includes('For now, only confirm'));
  }
});

test('all local Markdown file links resolve inside the package', () => {
  const markdown = files().filter(p => p.endsWith('.md'));
  for (const path of markdown) {
    const text = withoutCode(readFileSync(path, 'utf8'));
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const full = resolve(dirname(path), decodeURIComponent(target));
      assert.ok(!relative(root, full).startsWith(`..${sep}`), `Link escapes package: ${target}`);
      assert.ok(existsSync(full), `${relative(root, path)} -> ${target}`);
    }
  }
});

test('schemas parse and declare JSON Schema 2020-12', () => {
  for (const path of ['contracts/task.schema.json', 'contracts/review.schema.json']) {
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
    const schema = json(path);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
    assert.ok(Array.isArray(schema.required));
  }
});

test('Grok setup copies match canonical roles', () => {
  for (const role of ['engineer', 'verifier']) {
    const path = `adapters/grok-bot/${role.toUpperCase()}_SETUP.md`;
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
    const content = read(path);
    assert.ok(content.includes(read(`roles/${role}.md`).trim()));
    assert.ok(content.includes('For now, only confirm'));
  }
});

test('examples are explicitly non-authorizing and initially blocked or brief', () => {
  const task = json('examples/task.brief.json');
  const review = json('examples/review.blocked.json');
  assert.equal(task.status, 'BRIEF');
  assert.equal(task.approval_source, null);
  assert.deepEqual(task.allowed_actions, []);
  assert.equal(task.fix_cycles_used, 0);
  assert.equal(review.verdict, 'BLOCKED');
  assert.equal(review.reviewer_session_ref, null);
});

test('core invariants remain explicit', () => {
  assert.match(read('skills/surgical-dev/SKILL.md'), /BLOCKED/);
  assert.match(read('skills/surgical-dev/SKILL.md'), /same conversation/);
  assert.match(read('roles/verifier.md'), /CHANGES_REQUIRED/);
  assert.match(read('references/workflow.md'), /two fix-and-reverify cycles/);
  assert.match(read('references/workflow.md'), /dirty|untracked/);
  assert.match(read('references/workflow.md'), /not.*authorization/i);
});

test('self-contained Grok copies exist and their source hashes are current', async () => {
  const { createHash } = await import('node:crypto');
  for (const name of skills) {
    const path = `adapters/grok-bot/private-skills/${name}.md`;
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
    const text = read(path);
    assert.ok(!/\]\(\.\.\//.test(text), 'Export must not leave package-relative links');
    const block = text.match(/<!-- Generated copy\. Canonical source hashes:\n([\s\S]*?)\n-->/);
    assert.ok(block, 'Source inventory is required');
    for (const line of block[1].split('\n')) {
      const [source, digest] = line.split(' ');
      assert.ok(existsSync(resolve(root, source)));
      const actual = createHash('sha256').update(readFileSync(resolve(root, source))).digest('hex');
      assert.equal(actual, digest, `${path}: stale copy of ${source}`);
    }
  }
});
