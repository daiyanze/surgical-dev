import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReview } from './review-schema.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skills = readdirSync(resolve(root, 'skills'), { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(resolve(root, 'skills', entry.name, 'SKILL.md')))
  .map(entry => entry.name)
  .sort();
const read = path => readFileSync(resolve(root, path), 'utf8');
const json = path => JSON.parse(read(path));

test('skills are derived from the skills directory', () => {
  assert.ok(skills.length > 0, 'No skills found under skills/');
});

test('current operating docs contain no version-transition guide links', () => {
  const guidePattern = /(?:migration|upgrade|transition-guide)\.md$/i;
  for (const path of files()) {
    assert.ok(!guidePattern.test(path), `Obsolete guide: ${relative(root, path)}`);
    if (path.endsWith('.md')) assert.ok(!/\]\([^)]*(?:migration|upgrade|transition-guide)\.md(?:#[^)]*)?\)/i.test(readFileSync(path, 'utf8')));
  }
});

test('project readiness requires an independent final PASS', () => {
  const workflow = read('references/workflow.md');
  assert.match(workflow, /PR_READY/);
  assert.match(workflow, /independent Verifier/i);
});

function files(dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', '.venv', '__pycache__'].includes(entry.name)) return [];
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

test('manifest exposes Skills and the opt-in Pi extension without install-time hooks', () => {
  assert.ok(existsSync(resolve(root, 'package.json')), 'package.json is required');
  const pkg = json('package.json');
  assert.equal(pkg.name, 'surgical-dev');
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.pi, { skills: ['./skills'], extensions: ['./adapters/pi/extensions/surgical.ts'] });
  for (const path of pkg.pi.extensions) assert.ok(existsSync(resolve(root, path)), `Missing extension: ${path}`);
  for (const path of pkg.files) assert.ok(existsSync(resolve(root, path)), `Missing packaged path: ${path}`);
  assert.ok(!pkg.dependencies, 'The extension must use host APIs and Node standard library only');
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
    assert.ok(text.includes('## Return'), 'Output contract is required');
  });
}

test('role charters exist', () => {
  const roles = ['worker', 'verifier'];
  const charters = readdirSync(resolve(root, 'roles'))
    .filter(name => name.endsWith('.md') && !['README.md', 'team-boundaries.md'].includes(name))
    .map(name => name.slice(0, -3));
  assert.deepEqual(charters.sort(), [...roles].sort());
  for (const role of roles) {
    const path = `roles/${role}.md`;
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
  }
  const worker = read('roles/worker.md');
  for (const method of ['ship-feature', 'fix-bug']) {
    assert.ok(worker.includes(method), `Worker must reference ${method}`);
  }
  for (const removed of ['prepare-release', 'release-and-observe', 'handle-incident', 'discover-opportunity', 'product-scout']) {
    assert.ok(!worker.includes(removed), `Worker must not own removed method ${removed}`);
  }
});

test('removed Scout, delivery, incident and unimplemented multi-workstream assets are absent', () => {
  assert.equal(skills.length, 6, `Expected six Skills, found ${skills.length}`);
  const removedSkills = [
    'discover-opportunity', 'evaluate-outcome', 'handle-incident', 'prepare-release', 'release-and-observe',
    'decompose-project', 'integrate-workstreams', 'delegate-bounded-task',
  ];
  for (const name of removedSkills) assert.ok(!existsSync(resolve(root, 'skills', name)), `Removed Skill still present: ${name}`);
  const removedPaths = [
    'roles/product-scout.md',
    'roles/temporary-subagent.md',
    'workflows',
    'templates/incident-packet.md',
    'templates/opportunity-brief.md',
    'templates/outcome-assessment.md',
    'templates/release-handoff.md',
    'templates/integration-review.md',
    'templates/project-plan.md',
    'templates/subagent-handoff.md',
    'contracts/project-plan.md',
    'contracts/project-plan.schema.json',
    'examples/project.plan.json',
    'skills/verify-change/references/templates/integration-review.md',
    'contracts/project-policy.example.yaml',
    'templates/project-goal.md',
    'tests/acceptance-scenarios.md',
    'tests/contracts_test.py',
    'tests/requirements.txt',
  ];
  for (const path of removedPaths) assert.ok(!existsSync(resolve(root, path)), `Removed path still present: ${path}`);
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

test('standalone Skills include their canonical Markdown references', () => {
  for (const name of skills) {
    const skillDir = resolve(root, 'skills', name);
    const skill = read(`skills/${name}/SKILL.md`);
    const localLinks = [...withoutCode(skill).matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
      .map(match => match[1].split('#')[0])
      .filter(target => target && !/^[a-z][a-z0-9+.-]*:/i.test(target));
    for (const target of localLinks) {
      assert.ok(target.startsWith('references/'), `${name}: out-of-skill link ${target}`);
      const bundled = resolve(skillDir, target);
      const canonical = resolve(root, target.slice('references/'.length));
      assert.ok(existsSync(bundled), `${name}: missing reference ${target}`);
      assert.equal(readFileSync(bundled, 'utf8'), readFileSync(canonical, 'utf8'),
        `${name}: stale reference ${target}`);
    }
  }
});

test('schemas parse and declare JSON Schema 2020-12', () => {
  const schemaPaths = readdirSync(resolve(root, 'contracts'))
    .filter(name => name.endsWith('.schema.json'))
    .sort()
    .map(name => `contracts/${name}`);
  assert.ok(schemaPaths.includes('contracts/review.schema.json'), 'Missing contracts/review.schema.json');
  for (const path of schemaPaths) {
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
    const schema = json(path);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
    assert.ok(Array.isArray(schema.required));
  }
});

test('example review is explicitly blocked and valid against the schema', () => {
  const review = json('examples/review.blocked.json');
  assert.equal(validateReview(review), true, JSON.stringify(validateReview.errors));
  assert.equal(review.verdict, 'BLOCKED');
  assert.equal(review.reviewer_session_ref, null);
});

test('Karpathy-inspired engineering discipline covers four actionable habits', () => {
  const skill = read('skills/engineering-discipline/SKILL.md');
  for (const heading of ['Think before coding', 'Simplicity first', 'Surgical changes', 'Goal-driven execution']) {
    assert.ok(skill.includes(heading), heading);
  }
  assert.match(read('skills/surgical-dev/SKILL.md'), /engineering-discipline/);
});

test('core invariants remain explicit', () => {
  assert.match(read('skills/surgical-dev/SKILL.md'), /BLOCKED/);
  assert.match(read('skills/surgical-dev/SKILL.md'), /same conversation/);
  assert.match(read('roles/verifier.md'), /CHANGES_REQUIRED/);
  assert.match(read('references/workflow.md'), /not.*authorization/i);
});

test('Codex reviewer agent defines the required keys and defers to verify-change', () => {
  const toml = read('adapters/codex/agents/verifier.toml');
  for (const key of ['name', 'description', 'developer_instructions']) assert.match(toml, new RegExp(`^${key} = `, 'm'), key);
  assert.match(toml, /verify-change/);
  assert.match(read('adapters/codex/SETUP.md'), /\.agents\/skills/);
});
