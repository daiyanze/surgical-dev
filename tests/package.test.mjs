import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  assert.match(policy, /create_persistent_agents: false/);
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

test('four persistent roles and temporary helper assets exist', () => {
  for (const role of ['product-scout', 'engineer', 'verifier', 'operator', 'temporary-subagent']) {
    const path = `roles/${role}.md`;
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
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
  const schemaPaths = readdirSync(resolve(root, 'contracts'))
    .filter(name => name.endsWith('.schema.json'))
    .sort()
    .map(name => `contracts/${name}`);
  for (const name of ['task.schema.json', 'review.schema.json', 'project-plan.schema.json']) {
    assert.ok(schemaPaths.includes(`contracts/${name}`), `Missing contracts/${name}`);
  }
  for (const path of schemaPaths) {
    assert.ok(existsSync(resolve(root, path)), `Missing ${path}`);
    const schema = json(path);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
    assert.ok(Array.isArray(schema.required));
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

test('default limits table matches policy example', () => {
  const limits = Object.fromEntries([...read('contracts/project-policy.example.yaml').matchAll(/^\s+(max_[a-z_]+):\s*(\d+)/gm)].map(match => [match[1], match[2]]));
  assert.ok(Object.keys(limits).length > 0, 'No max_* limits found in policy example');
  const rows = read('contracts/README.md').split('\n')
    .filter(line => line.trim().startsWith('|'))
    .map(line => line.split('|').map(cell => cell.trim()));
  for (const [key, value] of Object.entries(limits)) {
    const row = rows.find(cells => cells[1] === `\`${key}\``);
    assert.ok(row, `contracts/README.md: missing table row for ${key}`);
    assert.equal(row[2], value, `contracts/README.md: wrong default for ${key}`);
  }
});

test('Karpathy-inspired engineering discipline covers four actionable habits', () => {
  const skill = read('skills/engineering-discipline/SKILL.md');
  for (const heading of ['Think before coding', 'Simplicity first', 'Surgical changes', 'Goal-driven execution']) {
    assert.ok(skill.includes(heading), heading);
  }
  assert.match(read('skills/surgical-dev/SKILL.md'), /engineering-discipline/);
  assert.match(read('roles/engineer.md'), /smallest solution/);
  assert.match(read('roles/verifier.md'), /unrelated changes/);
  assert.match(read('references/workflow.md'), /reproducing a bug/);
});

test('core invariants remain explicit', () => {
  assert.match(read('skills/surgical-dev/SKILL.md'), /BLOCKED/);
  assert.match(read('skills/surgical-dev/SKILL.md'), /same conversation/);
  assert.match(read('roles/verifier.md'), /CHANGES_REQUIRED/);
  assert.match(read('references/workflow.md'), /two fix-and-reverify cycles/);
  assert.match(read('references/workflow.md'), /dirty|untracked/);
  assert.match(read('references/workflow.md'), /not.*authorization/i);
});

test('Codex reviewer agent defines the required keys and defers to verify-change', () => {
  const toml = read('adapters/codex/agents/verifier.toml');
  for (const key of ['name', 'description', 'developer_instructions']) assert.match(toml, new RegExp(`^${key} = `, 'm'), key);
  assert.match(toml, /verify-change/);
  assert.match(read('adapters/codex/SETUP.md'), /\.agents\/skills/);
});
