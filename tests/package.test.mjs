import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skills = ['surgical-dev', 'ship-feature', 'fix-bug', 'delegate-bounded-task', 'verify-change', 'prepare-release', 'discover-opportunity', 'evaluate-outcome', 'release-and-observe', 'handle-incident', 'decompose-project', 'integrate-workstreams'];
const read = path => readFileSync(resolve(root, path), 'utf8');
const json = path => JSON.parse(read(path));

test('current operating docs contain no version-transition guide links', () => {
  const guidePattern = /(?:migration|upgrade|transition-guide)\.md$/i;
  for (const path of files()) {
    assert.ok(!guidePattern.test(path), `Obsolete guide: ${relative(root, path)}`);
    if (path.endsWith('.md')) assert.ok(!/\]\([^)]*(?:migration|upgrade|transition-guide)\.md(?:#[^)]*)?\)/i.test(readFileSync(path, 'utf8')));
  }
});

test('project organization is owned by Engineer rather than the user', () => {
  const role = read('roles/engineer.md');
  assert.match(role, /integration owner/i);
  assert.match(role, /decompose-project/);
  assert.match(role, /integrate-workstreams/);
  const brief = read('templates/project-goal.md');
  for (const word of ['Goal:', 'Constraints:', 'Budget:', 'Permissions:']) assert.ok(brief.includes(word));
  assert.match(brief, /Do not ask me to split tasks or assign agents/);
});

test('parallel workstreams and auxiliary subagents have distinct contracts', () => {
  const policy = read('contracts/project-policy.example.yaml');
  for (const field of ['max_active_engineers', 'max_active_verifiers', 'max_active_subagents_project', 'max_total_active_executions', 'max_active_integrations_per_target', 'serial_fallback']) assert.ok(policy.includes(field + ':'), field);
  assert.match(policy, /automation_enabled: false/);
  assert.match(policy, /profile: DRAFT_ONLY/);
  assert.match(policy, /create_persistent_bots: false/);
  assert.match(read('contracts/project-plan.md'), /dependency.*snapshot|snapshot.*dependency/i);
  assert.match(read('contracts/project-plan.md'), /acyclic/i);
  assert.match(read('contracts/project-plan.md'), /lease/i);
});

test('project readiness requires independent integration acceptance', () => {
  const workflow = read('references/workflow.md');
  assert.match(workflow, /Integration Passed/);
  assert.match(workflow, /INTEGRATION_READY/);
  assert.match(workflow, /PR_READY/);
  assert.match(read('roles/verifier.md'), /integration/i);
  assert.match(read('roles/operator.md'), /integration/i);
  const packet = read('templates/integration-review.md');
  for (const word of ['Plan revision:', 'Workstream snapshots:', 'Integrated snapshot:', 'Project acceptance criteria:', 'Independent reviewer:']) assert.ok(packet.includes(word), word);
});

test('project plan example has explicit dependencies, boundaries and no authority', () => {
  const plan = json('examples/project.plan.json');
  assert.equal(plan.authorization_ref, null);
  assert.equal(plan.status, 'DRAFT');
  assert.equal(plan.integration_owner_ref, null);
  assert.equal(plan.workstreams.length, 3);
  const ids = new Set(plan.workstreams.map(w => w.workstream_id));
  assert.equal(ids.size, plan.workstreams.length);
  for (const w of plan.workstreams) {
    assert.equal(w.assignee_execution_ref, null);
    assert.ok(w.write_paths.length > 0);
    assert.ok(w.acceptance_criteria.length > 0);
    assert.ok(w.depends_on.every(d => ids.has(d) && d !== w.workstream_id));
  }
  const visited = new Set();
  const active = new Set();
  const visit = id => {
    assert.ok(!active.has(id), 'Dependency cycle');
    if (visited.has(id)) return;
    active.add(id);
    plan.workstreams.find(w => w.workstream_id === id).depends_on.forEach(visit);
    active.delete(id); visited.add(id);
  };
  ids.forEach(visit);
});

function files(dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', 'surgeon-local', '__pycache__'].includes(entry.name)) return [];
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

test('four persistent roles and temporary helper assets exist without one-time setup instructions', () => {
  for (const role of ['product-scout', 'engineer', 'verifier', 'operator', 'temporary-subagent']) {
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
  for (const role of ['product-scout', 'engineer', 'verifier', 'operator']) {
    const path = `adapters/grok-bot/${role.toUpperCase().replaceAll('-', '_')}_SETUP.md`;
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
    const content = read(path);
    assert.ok(content.includes(read(`roles/${role}.md`).trim()));
    assert.ok(content.includes('## Setup-only response'));
    assert.ok(content.includes(read('roles/team-boundaries.md').trim()));
    assert.ok(!/supersed|adopts the migration|v1.*v2|v2.*v1/i.test(content));
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
