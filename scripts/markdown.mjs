import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { Marked, Renderer } from 'marked';

const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderMarkdown(markdown, { source, repo, sha, path }) {
  function sourceURL(href, image = false) {
    if (href.startsWith('#')) return href;
    const url = new URL(href, `https://source.invalid/${path}`);
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) {
      throw new Error(`Unsupported URL in ${path}: ${href}`);
    }
    if (url.origin !== 'https://source.invalid') return url.href;
    const target = resolve(source, '.' + decodeURIComponent(url.pathname));
    if (!existsSync(target)) throw new Error(`Missing source link in ${path}: ${href}`);
    const kind = image ? 'raw' : statSync(target).isDirectory() ? 'tree' : 'blob';
    return `${repo}/${kind}/${sha}${url.pathname}${url.search}${url.hash}`;
  }

  const renderer = new Renderer();
  const headings = new Map();
  renderer.html = () => '';
  const renderTable = renderer.table;
  renderer.table = function (token) {
    return `<div class="table-scroll" role="region" aria-label="Scrollable table" tabindex="0">${renderTable.call(this, token)}</div>\n`;
  };
  renderer.heading = function ({ tokens, depth }) {
    const text = this.parser.parseInline(tokens);
    const base = text.replace(/<[^>]*>/g, '').toLowerCase().replace(/&[^;]+;/g, '').replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-');
    const count = headings.get(base) || 0;
    headings.set(base, count + 1);
    const id = count ? `${base}-${count}` : base;
    return `<h${depth} id="${escape(id)}">${text}</h${depth}>\n`;
  };
  renderer.link = function ({ href, title, tokens }) {
    return `<a href="${escape(sourceURL(href))}"${title ? ` title="${escape(title)}"` : ''}>${this.parser.parseInline(tokens)}</a>`;
  };
  renderer.image = ({ href, title, text }) => `<img src="${escape(sourceURL(href, true))}" alt="${escape(text)}"${title ? ` title="${escape(title)}"` : ''} loading="lazy">`;
  return new Marked({ renderer, gfm: true }).parse(markdown);
}
