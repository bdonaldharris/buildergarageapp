import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function render(platform, userAgent = '', maxTouchPoints = 0) {
  const panels = ['windows', 'macos', 'linux'].map(name => ({ dataset: { platform: name }, hidden: false }));
  const options = ['windows', 'macos', 'linux', 'all'].map(value => ({
    value, checked: value === 'all', addEventListener(event, callback) { this.change = callback; }
  }));
  const selector = { hidden: true, querySelectorAll() { return options; } };
  const document = {
    querySelector(query) { return query === '.os-selector' ? selector : null; },
    querySelectorAll(query) { return query === '.download-platform' ? panels : []; }
  };
  runInNewContext(readFileSync('site.js', 'utf8'), { document, navigator: { platform, userAgent, maxTouchPoints } });
  return { selector, options, panels };
}

test('selects detected desktop OS and allows manual selection', () => {
  for (const [platform, expected] of [['Win32', 'windows'], ['MacIntel', 'macos'], ['Linux x86_64', 'linux']]) {
    const { selector, options, panels } = render(platform);
    assert.equal(selector.hidden, false);
    assert.equal(options.find(option => option.checked).value, expected);
    assert.deepEqual(panels.filter(panel => !panel.hidden).map(panel => panel.dataset.platform), [expected]);
    for (const chosen of ['windows', 'macos', 'linux', 'all']) {
      options.forEach(option => option.checked = option.value === chosen);
      options.find(option => option.checked).change();
      assert.deepEqual(panels.filter(panel => !panel.hidden).map(panel => panel.dataset.platform),
        chosen === 'all' ? ['windows', 'macos', 'linux'] : [chosen]);
    }
  }
});

test('shows every OS for unknown and mobile platforms', () => {
  for (const [platform, userAgent, touches] of [['', '', 0], ['Linux aarch64', 'Android', 0], ['MacIntel', 'iPad', 5], ['MacIntel', '', 5]]) {
    const { options, panels } = render(platform, userAgent, touches);
    assert.equal(options.find(option => option.checked).value, 'all');
    assert.ok(panels.every(panel => !panel.hidden));
  }
});
