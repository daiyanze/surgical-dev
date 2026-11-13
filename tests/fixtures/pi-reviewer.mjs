// Deterministic CLI protocol fixture. This is not a model or a Pi runtime.
import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
if (args.includes('--version')) {
  console.log('1.5.2');
  process.exit(0);
}
const sessionId = args[args.indexOf('--session-id') + 1];
const prompt = readFileSync(0, 'utf8');
const request = JSON.parse(prompt.slice(prompt.lastIndexOf('\nREQUEST_JSON\n') + 14));
for (const flag of ['--no-extensions', '--no-mcp', '--no-context-files', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-approve', '--no-session']) {
  if (!args.includes(flag)) throw new Error(`Unsafe reviewer arguments: missing ${flag}`);
}
if (args[args.indexOf('--tools') + 1] !== 'read,grep,find,ls') throw new Error('Reviewer must only receive read tools');
if (!existsSync('.git')) throw new Error('Reviewer needs its own Git checkout');
const source = readFileSync('answer.txt', 'utf8');
const mode = request.goal;
console.log(JSON.stringify({ type: 'session', version: 3, id: mode.includes('wrong-session') ? 'wrong' : sessionId, timestamp: new Date().toISOString(), cwd: process.cwd() }));
if (mode.includes('slow-review')) await new Promise(resolve => setTimeout(resolve, 30_000));
let pass = source.trim() === '42';
if (mode.includes('verifier-repair-once')) pass = pass && existsSync('repair.txt');
if (mode.includes('multi-pass')) pass = readFileSync('answer.txt', 'utf8').trim() === '42' && readFileSync('cover.txt', 'utf8').trim() === 'covered';
const criteria = request.acceptance_criteria ?? [{ id: 'AC-1', text: request.goal }];
const results = criteria.map(ac => ({ id: ac.id, result: pass ? 'PASS' : 'FAIL', evidence_refs: [pass ? 'answer.txt:1' : 'answer.txt:1'] }));
if (mode.includes('ac-2-fail')) results[results.length - 1].result = 'FAIL';
if (mode.includes('pass-but-ac-fail')) results[results.length - 1].result = 'FAIL';
if (mode.includes('missing-evidence')) results[0].evidence_refs = [];
if (mode.includes('wrong-criterion')) results[0].id = 'AC-99';
if (mode.includes('extra-field')) results[0].surprise = true;
if (mode.includes('duplicate-evidence')) results[0].evidence_refs.push('answer.txt:1');
if (mode.includes('partial-report')) results.pop();
const failing = results.filter(result => result.result !== 'PASS');
const verdict = mode.includes('pass-but-ac-fail') ? 'PASS' : (pass && failing.length === 0 ? 'PASS' : 'CHANGES_REQUIRED');
const report = {
  verdict,
  acceptance_results: results,
  blocking_findings: failing.length ? failing.map((result, index) => ({ id: `F-${index + 1}`, location: 'answer.txt:1', evidence: `Observed ${source.trim()}; ${result.id} is ${result.result}`, impact: `${result.id} not satisfied`, clearance_condition: `Make ${result.id} pass without changing scope` })) : [],
  non_blocking_suggestions: [],
  remaining_risks: [],
  blocked_reason: null,
};
if (mode.includes('duplicate-notes')) report.remaining_risks = ['one risk', 'one risk'];
if (mode.includes('report-diff')) report.remaining_risks = [`diff-length=${request.diff.length}`, `diff-has-large=${request.diff.includes('large.txt')}`, `diff-truncated=${request.diff.includes('...[truncated')}`];
if (mode.includes('blocked-review')) { report.verdict = 'BLOCKED'; report.blocked_reason = 'Missing reproducible evidence'; }
console.log(JSON.stringify({ type: 'tool_execution_end', toolCallId: 'read-1', toolName: 'read', result: { content: [{ type: 'text', text: source }] }, isError: false }));
if (mode.includes('reviewer-usage-mixed')) console.log(JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: 'intermediate' }], stopReason: 'stop' } }));
console.log(JSON.stringify({ type: 'message_end', message: { role: 'assistant', content: [{ type: 'text', text: mode.includes('invalid-json') ? 'I think it works' : JSON.stringify(report) }], stopReason: mode.includes('model-error') ? 'error' : 'stop', errorMessage: mode.includes('model-error') ? 'Provider failure' : undefined, ...(mode.includes('reviewer-usage') ? { usage: { input: 10, output: 5, total: 15, cost: 0.01 } } : {}) } }));
