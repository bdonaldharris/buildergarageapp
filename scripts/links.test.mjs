import assert from 'node:assert/strict';
import test from 'node:test';
import { openExternalLinks } from './links.mjs';

test('opens external web links safely, preserving link content and accessibility', () => {
  for (const href of ['https://github.com/example/repo', 'http://example.org/', '//example.org/']) {
    const html = openExternalLinks(`<a href="${href}" target="_self" rel="opener" aria-label="Source">Source</a>`);
    assert.equal(html, `<a href="${href}" aria-label="Source" target="_blank" rel="noopener noreferrer">Source</a>`);
    assert.equal(openExternalLinks(html), html);
  }
});

test('preserves internal navigation, downloads, email links, and code examples', () => {
  const html = '<a href="/">Home</a><a href="../learn/">Learn</a><a href="#setup">Setup</a><a href="https://buildergarage.app/updates/">Updates</a><a href="/downloads/skill.zip" download>Download</a><a href="mailto:hello@example.org">Email</a><pre>&lt;a href="https://example.org"&gt;</pre>';
  assert.equal(openExternalLinks(html), html);
});
