import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

function library(type) {
  const rows = ['cli', 'skills', 'manuals'].map(value => ({
    dataset: { type: value, role: '' }, textContent: value, hidden: false,
    classList: { contains: name => name === 'selected' && value === 'cli' }
  }));
  const tabs = ['all', 'cli', 'skills', 'manuals'].map(value => ({
    dataset: { type: value }, classList: { toggle(name, active) { this.active = active; } },
    setAttribute(name, value) { this[name] = String(value); },
    addEventListener(name, callback) { this.click = callback; }
  }));
  const search = { value: '', addEventListener() {} };
  const count = {}, empty = {}, detail = {}, placeholder = {};
  const button = { addEventListener() {} };
  const document = {
    querySelector(selector) {
      return ({
        '#library-search': search, '#result-count': count, '.empty': empty,
        '.detail-panel .artifact': detail, '.detail-placeholder': placeholder,
        '.clear': button, '.filter-toggle': button
      })[selector] || null;
    },
    querySelectorAll(selector) {
      return ({ '.resource-row': rows, '.tabs button': tabs })[selector] || [];
    }
  };
  runInNewContext(readFileSync('site.js', 'utf8'), {
    document, URLSearchParams, location: { search: `?type=${type}`, pathname: '/library/' },
    history: { replaceState() {} }
  });
  return { rows, tabs, detail, placeholder };
}

test('category links restore the correct filter and do not show unrelated CLI details', () => {
  for (const type of ['cli', 'skills', 'manuals']) {
    const { rows, tabs, detail, placeholder } = library(type);
    assert.deepEqual(rows.filter(row => !row.hidden).map(row => row.dataset.type), [type]);
    assert.equal(tabs.find(tab => tab.dataset.type === type)['aria-pressed'], 'true');
    assert.equal(detail.hidden, type !== 'cli');
    assert.equal(placeholder.hidden, type === 'cli');
    tabs.find(tab => tab.dataset.type === 'all').click();
    assert.equal(detail.hidden, false);
    assert.equal(placeholder.hidden, true);
  }
});
