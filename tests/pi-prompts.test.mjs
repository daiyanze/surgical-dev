import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPiVersion } from '../adapters/pi/prompts.mjs';

test('Pi version gate accepts 1.5.2+ and rejects older or unparsable output', () => {
  const run = stdout => () => assertPiVersion({ code: 0, stdout });
  for (const ok of ['1.5.2', '1.5.3\n', '1.6.0', '2.0.0']) assert.doesNotThrow(run(ok), ok);
  for (const bad of ['1.5.1', '1.4.9', '0.9.9', 'junk', '']) assert.throws(run(bad), /v1\.5\.2/, bad);
  assert.throws(() => assertPiVersion({ code: 1, stdout: '1.5.2' }), /v1\.5\.2/);
});
