import { readFile } from 'node:fs/promises';
import { createRun, advanceRun, loadConfig, STATE_ENTRY, TERMINAL } from './loop.mjs';
import { runProcess } from './process.mjs';

export function registerSurgicalLoop(pi) {
  let active, lastState, starting;
  const show = () => pi.sendMessage({
    customType: 'surgical-status', display: true,
    content: lastState
      ? `Surgical Dev: ${lastState.status}\n${lastState.reason ?? (lastState.status === 'PR_READY' ? `Checks and independent review passed for recorded tree ${lastState.acceptedSnapshot?.tree}. Delivery was not performed.` : lastState.goal)}`
      : 'No Surgical Dev run in this session. Use /surgical run <goal> after configuring .surgical-dev.json.',
    details: lastState ?? null,
  });
  const stop = async (ctx, status, reason) => {
    starting?.abort();
    if (active && !TERMINAL.has(active.state.status)) {
      await active.stop(status, reason);
      ctx.abort();
    }
  };

  pi.registerCommand('surgical', {
    description: 'Run a bounded development loop: run <goal>, status, stop',
    handler: async (args, ctx) => {
      const [verb = 'status', ...parts] = args.trim().split(/\s+/);
      if (!verb || verb === 'status') { show(); return; }
      if (verb === 'stop') { await stop(ctx, 'CANCELLED', 'Stopped by user'); show(); return; }
      if (verb !== 'run' || !parts.length) {
        pi.sendMessage({ customType: 'surgical-status', content: 'Usage: /surgical run <goal> | status | stop', display: true });
        return;
      }
      if (starting || !ctx.isIdle() || (active && (!TERMINAL.has(active.state.status) || active.busy))) {
        pi.sendMessage({ customType: 'surgical-status', content: 'An agent or Surgical Dev run is already active.', display: true });
        return;
      }
      const startup = new AbortController();
      starting = startup;
      let run;
      try {
        const { config, policyDigest } = await loadConfig(ctx.cwd);
        const version = await runProcess([...config.reviewerCommand, '--version'], { cwd: ctx.cwd, signal: startup.signal, timeoutMs: 10_000 });
        if (startup.signal.aborted) throw new Error('Startup cancelled');
        const match = version.stdout.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:\s|$)/);
        if (version.code !== 0 || !match || Number(match[1]) < 1 || (Number(match[1]) === 1 && (Number(match[2]) < 5 || (Number(match[2]) === 5 && Number(match[3]) < 2)))) {
          throw new Error('The Pi loop and reviewer require Pi v1.5.2 or later');
        }
        const engineer = await readFile(new URL('../../roles/engineer.md', import.meta.url), 'utf8');
        const discipline = await readFile(new URL('../../skills/engineering-discipline/SKILL.md', import.meta.url), 'utf8');
        run = await createRun({
          cwd: ctx.cwd, goal: parts.join(' '), config, policyDigest,
          engineerSessionId: ctx.sessionManager.getSessionId(),
          model: ctx.model ? { provider: ctx.model.provider, id: ctx.model.id } : undefined,
          onChange: state => {
            lastState = state;
            pi.appendEntry(STATE_ENTRY, state);
            ctx.ui.setStatus('surgical', `${state.status} · checks ${state.checkAttempts} · reviews ${state.reviewAttempts}`);
            if (state.status === 'TIMED_OUT') ctx.abort();
          },
        });
        active = run;
        if (startup.signal.aborted) { await run.stop('CANCELLED', 'Startup cancelled'); return; }
        const prompt = `${engineer}\n\n${discipline}\n\nSurgical Dev task ${active.state.id}\nAC-1: ${active.state.goal}\nRequired check commands (argv): ${JSON.stringify(config.checks)}\n\nKeep implementation, debugging and fixes in this Engineer session. Make routine in-scope decisions yourself. Do not request intermediate human handoffs: the extension runs checks and supplies independent review feedback after you finish a turn. Never approve your own implementation. Do not change .surgical-dev.json, weaken checks, hide changes with ignore rules, push, merge, release or deploy. Stop your turn when the candidate is ready to check. If the goal needs unavailable access or an unresolved product decision, explain the blocker. The target of this run is PR_READY for this one workstream.\n\nImplement the goal now.`;
        // A custom trigger enters Pi's active-run lifecycle synchronously. Waiting
        // keeps print/JSON mode alive; sendUserMessage has asynchronous preflight.
        run.engineerRunning = true;
        pi.sendMessage({ customType: 'surgical-goal', content: prompt, display: true }, { triggerTurn: true });
        await ctx.waitForIdle();
        run.engineerRunning = false;
        if (!TERMINAL.has(run.state.status)) await run.stop('BLOCKED', 'Pi settled without completing the independent acceptance loop');
      } catch (error) {
        if (run && !TERMINAL.has(run.state.status)) await run.stop('BLOCKED', error.message);
        else { pi.sendMessage({ customType: 'surgical-status', content: `Surgical Dev could not start: ${error.message}`, display: true }); return; }
      } finally {
        if (run) {
          await ctx.waitForIdle();
          run.engineerRunning = false;
          if (TERMINAL.has(run.state.status)) await run.close();
        }
        if (starting === startup) starting = undefined;
      }
      show();
    },
  });

  pi.on('turn_start', async (_event, ctx) => {
    if (!active || TERMINAL.has(active.state.status)) return;
    active.state.turnsUsed++;
    active.save();
    if (active.state.turnsUsed > active.state.config.maxTurns) await stop(ctx, 'ESCALATED', 'Engineer turn budget exhausted');
  });

  pi.on('agent_before_settle', async (event, ctx) => {
    if (!active || TERMINAL.has(active.state.status)) return;
    if (ctx.sessionManager.getSessionId() !== active.state.engineerSessionId) {
      await active.stop('BLOCKED', 'Engineer session changed');
      return;
    }
    if (event.outcome !== 'completed') {
      await active.stop(event.outcome === 'aborted' ? 'CANCELLED' : 'BLOCKED', `Engineer ended with ${event.outcome}`);
      return;
    }
    if (event.continue || event.context.pendingMessages.length || ctx.hasPendingMessages()) return;
    const result = await advanceRun(active);
    if (result.action === 'continue') {
      // Pi recalculates canContinue after committing our user-role feedback.
      if (active.state.turnsUsed >= active.state.config.maxTurns) {
        await active.stop('ESCALATED', 'No further Engineer turn is available; feedback retained');
        return;
      }
      return {
        entries: [...event.entries, { type: 'custom_message', customType: 'surgical-feedback', content: result.feedback, display: false }],
        continue: true,
      };
    }
  });

  pi.on('agent_settled', async (event) => {
    if (!active) return;
    active.engineerRunning = false;
    if (event.aborted) await active.stop('CANCELLED', 'Agent abort observed at settlement; no continuation dispatched');
    else if (active.readySnapshot && !TERMINAL.has(active.state.status)) {
      try { await active.finish(); }
      catch (error) { await active.stop('BLOCKED', error.message); }
    }
    if (TERMINAL.has(active.state.status)) await active.close();
  });

  pi.on('session_start', async (_event, ctx) => {
    active = undefined;
    const entries = ctx.sessionManager.getEntries();
    lastState = entries.filter(entry => entry.type === 'custom' && entry.customType === STATE_ENTRY).at(-1)?.data;
    if (lastState && !TERMINAL.has(lastState.status)) {
      lastState = { ...lastState, status: 'BLOCKED', reason: 'Previous run was interrupted. Inspect its processes and repository lock; automatic restart recovery is not enabled.' };
      pi.appendEntry(STATE_ENTRY, lastState);
    }
  });
  pi.on('session_before_switch', async (_event, ctx) => { await stop(ctx, 'CANCELLED', 'Session switched'); });
  pi.on('session_shutdown', async (_event, ctx) => { await stop(ctx, 'CANCELLED', 'Pi session shut down'); });
}
