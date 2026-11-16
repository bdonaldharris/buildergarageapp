import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { renderMarkdown } from './markdown.mjs';

const context = { source: resolve('.'), repo: 'https://github.com/example/framework', sha: 'verified-revision', path: 'scripts/guide.md' };

test('preserves fenced commands, lists, and tables as Markdown rather than paragraphs', () => {
  const html = renderMarkdown('## Setup\n\n```sh\n# A comment, not a heading\nprintf "<ready>\\n"\n```\n\n- **First** item\n\n| A | B |\n| --- | --- |\n| x | y |', context);
  assert.match(html, /<h2 id="setup">Setup<\/h2>/);
  assert.match(html, /<pre><code class="language-sh"># A comment, not a heading\nprintf &quot;&lt;ready&gt;\\n&quot;\n<\/code><\/pre>/);
  assert.match(html, /<ul>\n<li><strong>First<\/strong> item<\/li>/);
  assert.match(html, /<div class="table-scroll" role="region" aria-label="Scrollable table" tabindex="0"><table>[\s\S]*<td>x<\/td>[\s\S]*<\/table>\n<\/div>/);
});

test('resolves document, directory, and image links against the pinned source', () => {
  const html = renderMarkdown('[Guide](../README.md#build)\n\n[Assets](../assets/)\n\n![Logo](../assets/logo.png)\n\n[Local](#setup)', context);
  assert.match(html, /href="https:\/\/github.com\/example\/framework\/blob\/verified-revision\/README.md#build"/);
  assert.match(html, /href="https:\/\/github.com\/example\/framework\/tree\/verified-revision\/assets\/"/);
  assert.match(html, /src="https:\/\/github.com\/example\/framework\/raw\/verified-revision\/assets\/logo.png"/);
  assert.match(html, /href="#setup"/);
});

test('omits source HTML and reports unsafe or broken links instead of emitting them', () => {
  assert.equal(renderMarkdown('<script>alert(1)</script>', context), '');
  assert.throws(() => renderMarkdown('[Bad](javascript:alert)', context), /Unsupported URL/);
  assert.throws(() => renderMarkdown('[Missing](missing-file.md)', context), /Missing source link/);
});
