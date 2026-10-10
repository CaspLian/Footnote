import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseDeviceVoice, NarrationController, splitNarrationText, type SpeechAdapter } from './narration-controller';

test('voice selection stays in the requested language', () => {
  const voices = [
    { identifier: 'en', language: 'en-US' },
    { identifier: 'es-spain', language: 'es-ES', quality: 'Enhanced' },
    { identifier: 'es-us', language: 'es_US' },
  ];
  assert.equal(chooseDeviceVoice(voices, 'es')?.identifier, 'es-us');
  assert.equal(chooseDeviceVoice(voices.slice(0, 1), 'es'), undefined);
});

test('narration chunks fit the device limit without losing words', () => {
  const text = 'One sentence. Another sentence to read aloud. Then the last one.';
  const chunks = splitNarrationText(text, 20);
  assert.ok(chunks.every(chunk => chunk.length <= 20));
  assert.equal(chunks.join(' ').replace(/\s+/g, ' '), text);
});

test('navigation cancellation during voice discovery never starts stale speech', async () => {
  let resolveVoices!: (voices: { identifier: string; language: string }[]) => void;
  let starts = 0;
  const controller = new NarrationController({
    stop: async () => {},
    getVoices: () => new Promise(resolve => { resolveVoices = resolve; }),
    start: () => { starts++; },
    maxLength: 4000,
  });
  const pending = controller.speak('Read this bill.', 'en');
  await Promise.resolve();
  await controller.stop();
  resolveVoices([{ identifier: 'en', language: 'en-US' }]);
  await pending;
  assert.equal(starts, 0);
  assert.equal(controller.getSnapshot().status, 'idle');
});

test('changing narration invalidates callbacks from the previous utterance', async () => {
  const callbacks: Parameters<SpeechAdapter['start']>[1][] = [];
  const controller = new NarrationController({
    stop: async () => {},
    getVoices: async () => [{ identifier: 'en', language: 'en-US' }, { identifier: 'es', language: 'es-US' }],
    start: (_text, options) => { callbacks.push(options); options.onStart(); },
    maxLength: 4000,
  });
  await controller.speak('First bill.', 'en');
  await controller.speak('Segunda factura.', 'es');
  assert.equal(callbacks[1].voice, 'es');
  callbacks[0].onDone();
  assert.equal(controller.getSnapshot().status, 'speaking');
  callbacks[1].onDone();
  assert.equal(controller.getSnapshot().status, 'idle');
});

test('unavailable voices surface recovery and do not speak another language', async () => {
  let starts = 0;
  const controller = new NarrationController({ stop: async () => {}, getVoices: async () => [{ identifier: 'en', language: 'en-US' }], start: () => { starts++; }, maxLength: 4000 });
  await assert.rejects(controller.speak('Factura.', 'es'), { code: 'voice-unavailable' });
  assert.equal(controller.getSnapshot().status, 'unavailable');
  assert.equal(starts, 0);
});
