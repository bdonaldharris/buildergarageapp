export function openExternalLinks(html) {
  return html.replace(/<a\b[^>]*>/g, tag => {
    const href = tag.match(/\bhref="([^"]*)"/)?.[1];
    if (!href) return tag;
    const url = new URL(href.replace(/&amp;/g, '&'), 'https://buildergarage.app');
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === 'https://buildergarage.app') return tag;
    return tag.replace(/\s(?:target|rel)="[^"]*"/g, '')
      .replace(/>$/, ' target="_blank" rel="noopener noreferrer">');
  });
}
