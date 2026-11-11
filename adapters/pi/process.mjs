import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// argv is deliberate: configured checks never pass through a shell parser.
export function runProcess(argv, { cwd, signal, timeoutMs = 120_000, env = process.env, input, maxBytes = 2 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return resolve({ code: null, stdout: '', stderr: '', aborted: true, timedOut: false });
    const child = spawn(argv[0], argv.slice(1), { cwd, env, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    const stdout = [], stderr = [];
    let bytes = 0, aborted = false, timedOut = false, overflow = false, killTimer;
    const kill = sig => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, sig);
        else child.kill(sig);
      } catch (error) { if (error.code !== 'ESRCH') child.kill(sig); }
    };
    const stop = () => {
      kill('SIGTERM');
      if (!killTimer) killTimer = setTimeout(() => kill('SIGKILL'), 500);
    };
    const onAbort = () => { aborted = true; stop(); };
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
    const consume = stream => chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) { overflow = true; stop(); return; }
      (stream === 'stdout' ? stdout : stderr).push(chunk);
    };
    child.stdout.on('data', consume('stdout'));
    child.stderr.on('data', consume('stderr'));
    child.stdin.on('error', () => {}); // A failed/aborted child can close stdin early.
    child.stdin.end(input);
    const cleanup = () => { clearTimeout(timer); clearTimeout(killTimer); signal?.removeEventListener('abort', onAbort); };
    child.on('error', error => { cleanup(); reject(error); });
    child.on('close', (code, exitSignal) => {
      // A child may exit on TERM while its background children ignore it and
      // close their stdio. Finish cancelling the process group before releasing
      // ownership, rather than discarding the pending KILL with this timer.
      if (killTimer) kill('SIGKILL');
      cleanup();
      resolve({ code, signal: exitSignal, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8'), aborted, timedOut, overflow });
    });
    if (signal?.aborted) onAbort();
  });
}

export async function git(cwd, args, options = {}) {
  const result = await runProcess(['git', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, ...options });
  if (result.code !== 0 || result.aborted || result.timedOut || result.overflow) {
    throw new Error(`Git ${args[0]} failed: ${result.stderr || result.signal || 'interrupted'}`);
  }
  return result.stdout.trim();
}

export async function captureSnapshot(cwd, signal) {
  if (await git(cwd, ['ls-files', '--unmerged'], { signal })) throw new Error('Resolve Git conflicts before verification');
  if (/^160000 /m.test(await git(cwd, ['ls-files', '--stage'], { signal }))) throw new Error('The single-repository pilot does not support submodules');
  const directory = await mkdtemp(join(tmpdir(), 'surgical-index-'));
  const env = { ...process.env, GIT_INDEX_FILE: join(directory, 'index') };
  try {
    const head = await git(cwd, ['rev-parse', 'HEAD'], { signal });
    // Preserve indexed paths, including newly force-added ignored source.
    const indexedTree = await git(cwd, ['write-tree'], { signal });
    await git(cwd, ['read-tree', indexedTree], { env, signal });
    await git(cwd, ['add', '-A', '--', '.'], { env, signal });
    const tree = await git(cwd, ['write-tree'], { env, signal });
    return { head, tree };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export async function withReviewWorktree(cwd, snapshot, taskId, operation, signal) {
  const directory = await mkdtemp(join(tmpdir(), 'surgical-review-'));
  const checkout = join(directory, 'checkout');
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Surgical Dev', GIT_AUTHOR_EMAIL: 'surgical-dev@example.invalid',
    GIT_COMMITTER_NAME: 'Surgical Dev', GIT_COMMITTER_EMAIL: 'surgical-dev@example.invalid',
  };
  let added = false;
  try {
    const commit = await git(cwd, ['-c', 'commit.gpgsign=false', 'commit-tree', snapshot.tree, '-p', snapshot.head], {
      env, signal, input: `Independent review snapshot for ${taskId}\n`,
    });
    await git(cwd, ['worktree', 'add', '--detach', checkout, commit], { signal });
    added = true;
    return await operation({ checkout, commit });
  } finally {
    // Cleanup must still run after cancellation. Only this disposable checkout is removed.
    if (added) await git(cwd, ['worktree', 'remove', '--force', checkout]);
    await rm(directory, { recursive: true, force: true });
  }
}
