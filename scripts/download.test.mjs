import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function render(platform, userAgent = '', maxTouchPoints = 0) {
  const panels = ['windows', 'macos', 'linux'].map(name => ({ dataset: { platform: name }, hidden: false }));
  const select = { value: 'all', addEventListener(event, callback) { this.change = callback; } };
  const document = {
    querySelector(selector) { return selector === '#download-os' ? select : null; },
    querySelectorAll(selector) { return selector === '.download-platform' ? panels : []; }
  };
  runInNewContext(readFileSync('site.js', 'utf8'), { document, navigator: { platform, userAgent, maxTouchPoints } });
  return { select, panels };
}

test('selects detected desktop OS and allows manual selection', () => {
  for (const [platform, expected] of [['Win32', 'windows'], ['MacIntel', 'macos'], ['Linux x86_64', 'linux']]) {
    const { select, panels } = render(platform);
    assert.equal(select.value, expected);
    assert.deepEqual(panels.filter(panel => !panel.hidden).map(panel => panel.dataset.platform), [expected]);
    select.value = 'all';
    select.change();
    assert.equal(panels.filter(panel => !panel.hidden).length, 3);
  }
});

test('shows every OS for unknown and mobile platforms', () => {
  for (const [platform, userAgent, touches] of [['', '', 0], ['Linux aarch64', 'Android', 0], ['MacIntel', 'iPad', 5], ['MacIntel', '', 5]]) {
    const { select, panels } = render(platform, userAgent, touches);
    assert.equal(select.value, 'all');
    assert.ok(panels.every(panel => !panel.hidden));
  }
});
