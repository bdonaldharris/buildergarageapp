import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function library(params) {
  const rows = ['cli', 'skills', 'manuals'].map(value => ({
    dataset: { type: value, role: value === 'skills' ? 'planner' : '' }, textContent: value, hidden: false
  }));
  const tabs = ['all', 'cli', 'skills', 'manuals'].map(value => ({
    dataset: { type: value }, classList: { toggle(name, active) { this.active = active; } },
    setAttribute(name, value) { this[name] = String(value); },
    addEventListener(name, callback) { this.click = callback; }
  }));
  const search = { value: '', addEventListener() {} };
  const count = {}, empty = {};
  const filters = [{ value: 'planner', addEventListener() {} }];
  const button = { addEventListener() {} };
  const document = {
    querySelector(selector) {
      return ({
        '#library-search': search, '#result-count': count, '.empty': empty,
        '.clear': button, '.filter-toggle': button
      })[selector] || null;
    },
    querySelectorAll(selector) {
      return ({ '.resource-row': rows, '.tabs button': tabs, '.filters input': filters })[selector] || [];
    }
  };
  runInNewContext(readFileSync('site.js', 'utf8'), {
    document, URLSearchParams, location: { search: params, pathname: '/library/' },
    history: { replaceState() {} }
  });
  return { rows, tabs, filters };
}

test('category links restore the correct filter in the standalone resource list', () => {
  for (const type of ['cli', 'skills', 'manuals']) {
    const { rows, tabs } = library(`?type=${type}`);
    assert.deepEqual(rows.filter(row => !row.hidden).map(row => row.dataset.type), [type]);
    assert.equal(tabs.find(tab => tab.dataset.type === type)['aria-pressed'], 'true');
    tabs.find(tab => tab.dataset.type === 'all').click();
    assert.ok(rows.every(row => !row.hidden));
  }
});

test('a saved Technician role filter restores matching resources', () => {
  const { rows, filters } = library('?role=planner');
  assert.equal(filters[0].checked, true);
  assert.deepEqual(rows.filter(row => !row.hidden).map(row => row.dataset.type), ['skills']);
});
