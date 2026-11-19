(() => {
  const menu = document.querySelector('.menu');
  const nav = document.querySelector('header nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', open);
      menu.textContent = open ? 'Close' : 'Menu';
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && nav.classList.contains('open')) menu.click();
    });
  }

  document.querySelectorAll('.copy').forEach(button => button.addEventListener('click', async () => {
    const pre = button.parentElement.querySelector('pre');
    const live = button.parentElement.querySelector('.copy-live');
    const value = pre.textContent.split('\n')
      .filter(line => !line.trim().startsWith('#'))
      .map(line => line.replace(/^\$\s?/, '')).join('\n');
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = 'Copied';
      live.textContent = 'Commands copied';
      setTimeout(() => button.textContent = 'Copy', 2000);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      live.textContent = 'Clipboard unavailable. Commands selected; copy them manually.';
    }
  }));

  document.querySelectorAll('.install-tabs').forEach(group => {
    const tabs = [...group.querySelectorAll('[role=tab]')];
    const panels = [...group.querySelectorAll('[role=tabpanel]')];
    tabs.forEach((tab, index) => tab.addEventListener('click', () => {
      tabs.forEach((item, other) => item.setAttribute('aria-selected', index === other));
      panels.forEach((panel, other) => panel.hidden = index !== other);
    }));
    group.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        const index = tabs.indexOf(document.activeElement);
        tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].focus();
        event.preventDefault();
      }
    });
  });

  const osSelector = document.querySelector('.os-selector');
  if (osSelector) {
    const options = [...osSelector.querySelectorAll('input[name=download-os]')];
    const platforms = [...document.querySelectorAll('.download-platform')];
    function showPlatform() {
      const selected = options.find(option => option.checked).value;
      platforms.forEach(panel => panel.hidden = selected !== 'all' && panel.dataset.platform !== selected);
    }
    const userAgent = navigator.userAgent || '';
    const platform = navigator.userAgentData?.platform || navigator.platform || '';
    let detected = 'all';
    if (!/android|iphone|ipad|ipod/i.test(`${platform} ${userAgent}`)) {
      if (/windows|win32|win64/i.test(platform)) detected = 'windows';
      else if (/mac/i.test(platform) && !(navigator.maxTouchPoints > 1 && /mac/i.test(platform))) detected = 'macos';
      else if (/linux/i.test(platform)) detected = 'linux';
    }
    options.forEach(option => {
      option.checked = option.value === detected;
      option.addEventListener('change', showPlatform);
    });
    showPlatform();
    osSelector.hidden = false;
  }

  const search = document.querySelector('#library-search');
  if (!search) return;
  const rows = [...document.querySelectorAll('.resource-row')];
  const count = document.querySelector('#result-count');
  const filters = [...document.querySelectorAll('.filters input')];
  const tabs = [...document.querySelectorAll('.tabs button')];
  const empty = document.querySelector('.empty');
  const selectedRow = rows.find(row => row.classList.contains('selected'));
  const detail = document.querySelector('.detail-panel .artifact');
  const detailPlaceholder = document.querySelector('.detail-placeholder');
  const initial = new URLSearchParams(location.search);
  let type = tabs.some(tab => tab.dataset.type === initial.get('type')) ? initial.get('type') : 'all';
  search.value = initial.get('q') || '';
  filters.forEach(input => input.checked = initial.getAll('role').includes(input.value));

  function apply() {
    const query = search.value.toLowerCase();
    const roles = filters.filter(input => input.checked).map(input => input.value);
    let total = 0;
    rows.forEach(row => {
      const match = (!query || row.textContent.toLowerCase().includes(query))
        && (type === 'all' || row.dataset.type === type)
        && (!roles.length || roles.includes(row.dataset.role));
      row.hidden = !match;
      if (match) total++;
    });
    count.textContent = `${total} ${total === 1 ? 'part' : 'parts'}`;
    empty.hidden = total !== 0;
    tabs.forEach(tab => {
      const active = tab.dataset.type === type;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', active);
    });
    if (selectedRow && detail && detailPlaceholder) {
      detail.hidden = selectedRow.hidden;
      detailPlaceholder.hidden = !selectedRow.hidden;
    }
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (type !== 'all') params.set('type', type);
    roles.forEach(role => params.append('role', role));
    history.replaceState({}, '', params.size ? `?${params}` : location.pathname);
  }

  search.addEventListener('input', apply);
  filters.forEach(input => input.addEventListener('change', apply));
  tabs.forEach(tab => tab.addEventListener('click', () => {
    type = tab.dataset.type;
    apply();
  }));
  document.querySelector('.clear').addEventListener('click', () => {
    search.value = '';
    filters.forEach(input => input.checked = false);
    type = 'all';
    apply();
  });
  document.querySelector('.filter-toggle').addEventListener('click', event => {
    const open = document.querySelector('.filters').classList.toggle('open');
    event.currentTarget.setAttribute('aria-expanded', open);
  });
  apply();
})();
