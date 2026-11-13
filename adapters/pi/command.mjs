// The /surgical slash command.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TERMINAL } from './loop.mjs';
import { COMMAND_CONFIRMATION_SOURCE, parseRequirementDocument } from './spec.mjs';
import { loadLearning } from './learning.mjs';
import { formatSpec } from './status.mjs';

const RESERVED_COMMANDS = new Set(['discuss', 'import', 'confirm', 'run', 'status', 'lessons', 'stop', 'discard']);

export function registerCommand(pi, { s, mutateRepository, flushPersist, restoreDiscussionTools, clearDisplayed, markDisplayed, confirmDisplayedDraft, show, stop, beginDiscussion, startRun }) {
  pi.registerCommand('surgical', {
    description: 'Start with /surgical <goal>; advanced: discuss <goal> | import <file> | confirm | run | status | lessons | stop | discard',
    handler: async (args, ctx) => {
      const raw = args ?? '';
      const trimmed = raw.trimStart();
      const first = trimmed.match(/^(\S+)/)?.[1] ?? '';
      if (!first || first === 'status') { show(ctx); return; }
      if (first === 'lessons') {
        try {
          const { records } = await loadLearning(ctx.cwd);
          const lines = records.slice(-20).map(item =>
            `${item.label} [${item.kind}] (${item.count}x, last seen ${item.last_seen})`);
          const body = lines.length ? `Local Learning Loop records (latest 20):\n${lines.join('\n')}` : 'No local Learning Loop records yet.';
          pi.sendMessage({ customType: 'surgical-learning', display: true,
            content: `${body}\nRecords are advisory and stay in Git metadata.`,
          });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-learning', display: true, content: `Learning records unavailable: ${error.message}` });
        }
        return;
      }
      if (!RESERVED_COMMANDS.has(first)) {
        try { await beginDiscussion(ctx, raw.trim()); }
        catch (error) { pi.sendMessage({ customType: 'surgical-status', content: `Discussion could not start: ${error.message}`, display: true }); }
        return;
      }
      const [verb, ...parts] = trimmed.trim().split(/\s+/);
      if (verb === 'stop') { await stop(ctx, 'CANCELLED', 'Stopped by user'); await flushPersist(); show(ctx); return; }
      if (verb === 'discard') {
        if (s.active && !TERMINAL.has(s.active.state.status)) { pi.sendMessage({ customType: 'surgical-status', content: 'Stop the active run before discarding scope.', display: true }); return; }
        try {
          await mutateRepository(ctx, state => { state.draft_spec = null; return state; });
          s.discussion = false; s.draftSpec = null; clearDisplayed();
          restoreDiscussionTools();
          pi.sendMessage({ customType: 'surgical-status', content: 'Draft Goal Specification discarded. No implementation was started.', display: true });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Discard failed: ${error.message}`, display: true });
        }
        return;
      }
      if (verb === 'confirm') {
        try {
          const confirmed = await confirmDisplayedDraft(ctx, COMMAND_CONFIRMATION_SOURCE);
          pi.sendMessage({
            customType: 'surgical-status', display: true,
            content: `${formatSpec(confirmed)}\n\nConfirmed and frozen. Use /surgical run to start. Confirmation source: ${confirmed.confirmation.source} (${confirmed.confirmation.session_id}).`,
          });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Confirmation failed: ${error.message}`, display: true });
        }
        return;
      }
      if (verb === 'import') {
        if (!parts.length) { pi.sendMessage({ customType: 'surgical-status', content: 'Usage: /surgical import <requirements.md|requirements.json>', display: true }); return; }
        if ((s.active && !TERMINAL.has(s.active.state.status)) || s.starting) { pi.sendMessage({ customType: 'surgical-status', content: 'An implementation run is already active.', display: true }); return; }
        try {
          const path = resolve(ctx.cwd, parts.join(' '));
          const text = await readFile(path, 'utf8');
          const draft = parseRequirementDocument(text, path);
          await mutateRepository(ctx, state => { state.draft_spec = draft; state.confirmed_spec = null; return state; });
          s.draftSpec = draft;
          s.confirmedSpec = null;
          s.discussion = false;
          restoreDiscussionTools();
          clearDisplayed();
          pi.sendMessage({
            customType: 'surgical-spec-draft', display: true,
            content: `${formatSpec(draft)}\n\nImported without a redundant discussion turn. Review this full draft. Reply with 确认，开始 (or confirm and start) to confirm this exact revision and start automatically, or use /surgical confirm. No implementation has started.`,
            details: draft,
          });
          markDisplayed(draft, ctx);
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Import failed: ${error.message}`, display: true });
        }
        return;
      }
      if (verb === 'discuss') {
        if (!parts.length) { pi.sendMessage({ customType: 'surgical-status', content: 'Usage: /surgical discuss <goal>', display: true }); return; }
        try { await beginDiscussion(ctx, parts.join(' ')); }
        catch (error) { pi.sendMessage({ customType: 'surgical-status', content: `Discussion could not start: ${error.message}`, display: true }); }
        return;
      }
      if (verb !== 'run') {
        pi.sendMessage({ customType: 'surgical-status', content: 'Usage: /surgical <goal> | discuss <goal> | import <file> | confirm | run | status | lessons | stop | discard', display: true });
        return;
      }
      if (parts.length) {
        const requested = parts.join(' ');
        if (s.confirmedSpec && requested === s.confirmedSpec.goal) { await startRun(ctx); return; }
        try {
          await beginDiscussion(ctx, requested);
          pi.sendMessage({ customType: 'surgical-status', display: true, content: 'The requested goal does not exactly match the confirmed scope, so the old confirmation is invalid. This is requirement discussion only; review the full draft, then confirm with 确认，开始 / confirm and start or the advanced /surgical confirm, and /surgical run.' });
        } catch (error) {
          pi.sendMessage({ customType: 'surgical-status', content: `Discussion could not start: ${error.message}`, display: true });
        }
        return;
      }
      if (s.draftSpec || s.discussion) {
        pi.sendMessage({ customType: 'surgical-status', display: true, content: 'A draft/discussion is pending. Review /surgical status, then confirm the shown draft or /surgical discard before /surgical run without a goal.' });
        return;
      }
      await startRun(ctx);
    },
  });
}
