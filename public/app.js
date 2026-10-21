const $ = (selector) => document.querySelector(selector);
const state = { news: [], kev: [], kevTotal: 0, shownKev: 8, onlyMatches: false, products: loadProducts() };

function loadProducts() {
  try { return JSON.parse(localStorage.getItem('yoru-products') || '[]').filter((v) => typeof v === 'string'); }
  catch { return []; }
}
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function dateLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date not provided';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
function ago(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'DATE UNAVAILABLE';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  return days === 0 ? 'TODAY' : days === 1 ? '1 DAY AGO' : `${days} DAYS AGO`;
}
function typeFrom(text) {
  const t = text.toLowerCase();
  if (/ransom|encrypt files|extortion/.test(t)) return 'Ransomware';
  if (/data breach|exposed data|stolen data|leak|records exposed/.test(t)) return 'Data breach';
  if (/phishing|credential|social engineering/.test(t)) return 'Phishing / credential theft';
  if (/distributed denial|\bddos\b/.test(t)) return 'DDoS';
  if (/zero.day|zero day|actively exploit|exploited in the wild/.test(t)) return 'Exploited vulnerability';
  if (/malware|trojan|botnet|backdoor/.test(t)) return 'Malware';
  if (/supply.chain/.test(t)) return 'Supply-chain incident';
  return 'Cybersecurity report';
}
function reportedMoney(text) {
  const match = text.match(/(?:\$|USD\s?)(?:\d[\d,.]*\s?(?:million|billion|m|b|k)?|\d[\d,.]*\s?bn)\b|\b(?:\d[\d,.]*\s?(?:million|billion))\s?(?:dollars|USD)\b/i);
  return match?.[0] || 'Not stated in feed';
}
function runtime(text) {
  const match = text.match(/\b(?:for|over|more than|at least)\s+\d+(?:\.\d+)?\s*(?:hours?|days?|weeks?|months?|years?)\b/i);
  return match?.[0] || 'Not stated in feed';
}
function target(text) {
  const found = text.match(/\b(?:targeting|targeted|hits|hit|attacks on|breach at|breach of|compromises|compromised)\s+([^,.;:!?]{3,65})/i);
  return found?.[1]?.replace(/\s+/g, ' ').trim() || 'Not stated in feed';
}
function effect(text) {
  const lower = text.toLowerCase();
  if (/data breach|expos|leak|stolen|records/.test(lower)) return 'Potential data exposure (see source)';
  if (/ransom|encrypt|extort/.test(lower)) return 'Potential service disruption or extortion';
  if (/outage|disrupt|shut down|unavailable/.test(lower)) return 'Service disruption reported';
  if (/patched|fix|update|vulnerability/.test(lower)) return 'Security flaw / remediation report';
  return 'Details in linked report';
}
function matchesProduct(entry) {
  const haystack = `${entry.vendorProject || ''} ${entry.product || ''} ${entry.vulnerabilityName || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return state.products.find((product) => {
    const term = product.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (term.length < 3) return false;
    return (` ${haystack} `).includes(` ${term} `);
  });
}
function renderNews() {
  const q = $('#news-search').value.trim().toLowerCase();
  const source = $('#news-source').value;
  const list = state.news.filter((item) => (source === 'all' || source === item.source) && `${item.title} ${item.summary} ${item.source}`.toLowerCase().includes(q));
  $('#news-pill').textContent = list.length;
  $('#incident-count').textContent = state.news.length || '0';
  $('#news-grid').innerHTML = list.length ? list.slice(0, 18).map((item, index) => {
    const context = `${item.title}. ${item.summary}`;
    return `<article class="news-card"><div class="card-meta"><span class="source-tag">${esc(item.source)}</span><span>${esc(dateLabel(item.published))} · ${esc(ago(item.published))}</span></div><h3>${esc(item.title)}</h3><p>${esc(item.summary || 'The publisher did not provide a summary in its feed. Open the report for details.')}</p><div class="impact-row"><span>AUTO-TAG <b>${esc(typeFrom(context))}</b></span><span>TARGET HINT <b>${esc(target(context))}</b></span></div><div class="impact-row"><span>RUNTIME <b>${esc(runtime(context))}</b></span><span>REPORTED LOSS <b>${esc(reportedMoney(context))}</b></span><span>POSSIBLE EFFECT <b>${esc(effect(context))}</b></span></div><a class="source-link" href="${esc(item.link)}" target="_blank" rel="noopener noreferrer">OPEN ORIGINAL SOURCE <span>↗</span></a></article>`;
  }).join('') : '<div class="empty-state">No stories match this search. Try a broader term or refresh sources.</div>';
}
function renderSourceOptions(sources = []) {
  const select = $('#news-source');
  const selected = select.value;
  select.innerHTML = '<option value="all">All sources</option>' + sources.filter((source) => source.available).map((source) => `<option value="${esc(source.name)}">${esc(source.name)} (${source.count})</option>`).join('');
  select.value = sources.some((source) => source.available && source.name === selected) ? selected : 'all';
}
function renderKev() {
  const q = $('#kev-search').value.trim().toLowerCase();
  const list = state.kev.filter((entry) => {
    const match = matchesProduct(entry);
    return (!state.onlyMatches || Boolean(match)) && `${entry.cveID} ${entry.vendorProject} ${entry.product} ${entry.vulnerabilityName} ${entry.shortDescription}`.toLowerCase().includes(q);
  });
  $('#kev-pill').textContent = state.kev.length ? `${state.kev.length} RECENT` : 'CISA';
  $('#kev-count').textContent = state.kevTotal ? state.kevTotal.toLocaleString() : '—';
  const currentMatches = state.kev.filter(matchesProduct).length;
  if (state.products.length) {
    $('#match-count').textContent = String(currentMatches);
    $('#match-note').textContent = currentMatches ? 'possible name matches in loaded entries' : 'none in loaded entries; not a safety check';
  } else {
    $('#match-count').textContent = 'Set profile'; $('#match-note').textContent = 'Track the products you use';
  }
  const visible = list.slice(0, state.shownKev);
  $('#kev-grid').innerHTML = visible.length ? visible.map((entry, index) => {
    const matched = matchesProduct(entry);
    const fix = entry.requiredAction ? entry.requiredAction : 'Check the linked vendor advisory for an available fix.';
    return `<article class="kev-card"><div class="cve-badge">${esc(entry.cveID)}${matched ? `<span class="match-badge">POSSIBLE MATCH</span>` : ''}</div><div class="kev-main"><h3>${esc(entry.vulnerabilityName || 'Known exploited vulnerability')}</h3><p>${esc(fix)}</p><div class="kev-product">${esc(entry.vendorProject || 'Vendor not specified')} · ${esc(entry.product || 'Product not specified')} · Added ${esc(dateLabel(entry.dateAdded))}</div></div><div class="kev-date"><strong>${esc(entry.knownRansomwareCampaignUse === 'Known' ? 'RANSOMWARE USE KNOWN' : 'EXPLOITED IN WILD')}</strong><a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${encodeURIComponent(entry.cveID)}" target="_blank" rel="noopener noreferrer">VIEW CISA ENTRY ↗</a></div></article>`;
  }).join('') : '<div class="empty-state">No vulnerability entries match. Set a tracked product or clear the search/filter.</div>';
  $('#load-more').hidden = visible.length >= list.length;
  $('#kev-filter').classList.toggle('on', state.onlyMatches);
  $('#kev-filter').textContent = state.onlyMatches ? 'Showing matches ×' : 'All entries';
}
async function loadData({ refresh = false } = {}) {
  const button = $('#refresh'); button.classList.add('busy'); button.disabled = true;
  $('#news-status').textContent = 'Connecting to incident reporting feeds…';
  $('#kev-status').textContent = 'Retrieving CISA exploited-vulnerability catalog…';
  try {
    const suffix = refresh ? `?refresh=${Date.now()}` : '';
    const [newsResult, kevResult] = await Promise.allSettled([fetch(`/api/news${suffix}`).then((r) => { if (!r.ok) throw new Error('Could not load news feeds'); return r.json(); }), fetch(`/api/kev${suffix}`).then((r) => { if (!r.ok) throw new Error('Could not load CISA catalog'); return r.json(); })]);
    let sourceSummary = '0 / 8 NEWS';
    if (newsResult.status === 'fulfilled') {
      const news = newsResult.value; state.news = news.items || [];
      renderSourceOptions(news.sources || []);
      const online = (news.sources || []).filter((source) => source.available).length;
      $('#feed-health').textContent = `${online}/${(news.sources || []).length} SOURCES`;
      sourceSummary = `${online} / ${(news.sources || []).length} NEWS`;
      $('#feed-health').classList.toggle('offline', online === 0);
      $('#feed-health-detail').textContent = online ? `Monitoring ${online} public sources` : 'No sources responded';
      $('#news-status').textContent = news.unavailable?.length ? `${online} sources available; unavailable: ${news.unavailable.join(', ')}.` : `${online} public sources reporting · duplicate links removed`;
      $('#news-status').classList.toggle('error', !state.news.length);
      renderNews();
    } else {
      $('#feed-health').textContent = 'NEWS OFFLINE'; $('#feed-health').classList.add('offline');
      $('#feed-health-detail').textContent = 'Incident feeds unavailable'; sourceSummary = '0 / 8 NEWS';
      $('#news-status').textContent = `Incident feeds unavailable: ${newsResult.reason.message}.`; $('#news-status').classList.add('error');
      $('#news-grid').innerHTML = '<div class="empty-state">No incident articles loaded. YORU will not substitute made-up incidents. Try Refresh again later.</div>';
    }
    if (kevResult.status === 'fulfilled') {
      const kev = kevResult.value; state.kev = kev.entries || []; state.kevTotal = Number(kev.count || 0);
      $('#kev-status').textContent = kev.updated ? `Catalog updated ${dateLabel(kev.updated)} · ${state.kevTotal.toLocaleString()} known exploited vulnerabilities total` : 'CISA catalog data loaded';
      $('#kev-status').classList.remove('error'); renderKev();
    } else {
      $('#kev-status').textContent = `CISA catalog unavailable: ${kevResult.reason.message}.`; $('#kev-status').classList.add('error');
      $('#kev-grid').innerHTML = '<div class="empty-state">CISA catalog not loaded. Try Refresh again later.</div>';
    }
    $('#feed-source-count').textContent = `${sourceSummary} · KEV ${kevResult.status === 'fulfilled' ? 'OK' : 'OFFLINE'}`;
    $('#last-updated').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } finally { button.classList.remove('busy'); button.disabled = false; }
}
function openProfile() { $('#products').value = state.products.join(', '); $('#profile-dialog').showModal(); }
$('#refresh').addEventListener('click', () => loadData({ refresh: true }));
$('#news-search').addEventListener('input', renderNews);
$('#news-source').addEventListener('change', renderNews);
$('#kev-search').addEventListener('input', renderKev);
$('#kev-filter').addEventListener('click', () => { state.onlyMatches = !state.onlyMatches; state.shownKev = 8; renderKev(); });
$('#load-more').addEventListener('click', () => { state.shownKev += 8; renderKev(); });
$('#profile-open').addEventListener('click', openProfile);
$('#profile-form').addEventListener('submit', (event) => {
  if (event.submitter?.id !== 'save-profile') return;
  event.preventDefault();
  state.products = $('#products').value.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, 30);
  localStorage.setItem('yoru-products', JSON.stringify(state.products));
  $('#profile-dialog').close(); renderKev();
});
$('#disclaimer-more').addEventListener('click', () => $('#notes-dialog').showModal());
loadData();
setInterval(() => loadData({ refresh: true }), 8 * 60 * 1000);
