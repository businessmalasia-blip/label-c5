// ============================================================================
// ticketmaster.js — live data layer for the Viagogo-style clone.
// Three clean layers, each independently testable:
//   1. DATA    — talks to the Ticketmaster Discovery API, knows nothing of HTML
//   2. ADAPTER — flattens TM's nested JSON into our render-ready shape
//   3. RENDER  — clones the ORIGINAL Viagogo event card and fills it with data
// The markup/CSS is never authored here: we cloneNode() viagogo's real card so
// the design stays pixel-perfect; only text/attributes are substituted.
// ============================================================================

// ---------- 0. ANTI-FLASH STYLE ----------
// Hide the static (Bad Bunny) carousels/grids the instant this script parses —
// i.e. before the browser finishes painting the rest of the body — so users
// never see a flash of mock content before the live data lands. init*()
// functions clear `data-tm-loading` once they've repainted a section.
(function injectAntiFlashStyle() {
  const style = document.createElement('style');
  style.textContent = `
    [data-carousel-index], ul[data-testid="primaryGrid"], ul[data-testid="restGrid"] {
      visibility: hidden;
    }
    [data-tm-loaded] [data-carousel-index],
    [data-tm-loaded] ul[data-testid="primaryGrid"],
    [data-tm-loaded] ul[data-testid="restGrid"] {
      visibility: visible;
    }
  `;
  document.head.appendChild(style);
})();

// ---------- 1. DATA LAYER ----------
const TM_API_KEY = 'GF5xmT4oNCokX74vmAdx6Dw0hyKVKipA'; // public consumer key
const TM_BASE = 'https://app.ticketmaster.com/discovery/v2';

// Category -> Ticketmaster classification segment
const TM_SEGMENTS = {
  sport: 'Sports',
  concert: 'Music',
  theatre: 'Arts & Theatre',
};

async function fetchEvents({ segmentName = 'Music', size = 12, city = '' } = {}) {
  const params = new URLSearchParams({
    apikey: TM_API_KEY,
    segmentName,
    sort: 'date,asc',
    size: String(size),
  });
  if (city) params.set('city', city);
  const res = await fetch(`${TM_BASE}/events.json?${params}`);
  if (!res.ok) throw new Error(`Ticketmaster API error: ${res.status}`);
  const data = await res.json();
  return data._embedded?.events || [];
}

async function fetchEventById(id) {
  const params = new URLSearchParams({ apikey: TM_API_KEY });
  const res = await fetch(`${TM_BASE}/events/${encodeURIComponent(id)}.json?${params}`);
  if (!res.ok) throw new Error(`Ticketmaster API error: ${res.status}`);
  return res.json();
}

// All events (tour dates) for one attraction/performer — powers the artist page.
async function fetchEventsByAttraction(attractionId, { size = 40 } = {}) {
  const params = new URLSearchParams({
    apikey: TM_API_KEY,
    attractionId,
    sort: 'date,asc',
    size: String(size),
  });
  const res = await fetch(`${TM_BASE}/events.json?${params}`);
  if (!res.ok) throw new Error(`Ticketmaster API error: ${res.status}`);
  const data = await res.json();
  return data._embedded?.events || [];
}

// ---------- 2. ADAPTER LAYER ----------
// Raw TM event -> flat object with exactly the fields our card markup needs.
function mapEventToCard(raw) {
  const venue = raw._embedded?.venues?.[0];
  const attraction = raw._embedded?.attractions?.[0];
  const image = (raw.images || []).find(i => i.width >= 640) || raw.images?.[0];
  const price = raw.priceRanges?.[0]?.min;
  const currency = raw.priceRanges?.[0]?.currency || 'USD';
  return {
    id: raw.id,
    title: raw.name,
    attractionId: attraction?.id || '',
    attractionName: attraction?.name || raw.name,
    date: raw.dates?.start?.localDate || '',
    time: raw.dates?.start?.localTime || '',
    venue: venue?.name || 'Venue TBA',
    city: venue?.city?.name || '',
    country: venue?.country?.name || '',
    countryCode: venue?.country?.countryCode || '',
    price: price != null ? Math.round(price) : null,
    currency,
    image: image?.url || '',
  };
}

// ---------- 3. RENDER LAYER ----------
const TM_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TM_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Build the cross-page URL so every field travels to the detail page.
function tmEventParams(ev) {
  return new URLSearchParams({
    id: ev.id,
    title: ev.title,
    venue: ev.venue,
    city: ev.city,
    country: ev.country,
    date: ev.date,
    time: ev.time || '',
    price: ev.price ?? '',
    currency: ev.currency,
    img: ev.image,
  }).toString();
}

// Map a currency code to its symbol for the "From €309" style price lines.
const TM_CURRENCY_SYMBOLS = { USD: '$', EUR: '€', GBP: '£', TRY: '₺', CAD: '$', AUD: '$' };
function currencySymbol(code) { return TM_CURRENCY_SYMBOLS[code] || (code ? code + ' ' : '$'); }

// "7:00 PM" from a 24h "19:00:00" local time.
function formatClock(localTime) {
  if (!localTime) return 'Time TBA';
  const [h, m] = localTime.split(':');
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

// Inject live data into an EXISTING viagogo artist-grid card (an <a> node),
// mutating only the elements it ships with — flag stays a flag, every bdi
// keeps its slot. The caller clones the whole <li> wrapper first.
function fillGridCard(card, ev) {
  // Route every card to ITS OWN event (real params, no hardcode) + a11y title
  card.setAttribute('href', `fticket.html?${tmEventParams(ev)}`);
  card.setAttribute('title', ev.title);

  // Calendar block (month / day / weekday)
  const d = ev.date ? new Date(ev.date + 'T00:00:00') : null;
  if (d && !isNaN(d)) {
    const sec = card.querySelector('.eventGridListItemCalendar__contentSecondary');
    const pri = card.querySelector('.eventGridListItemCalendar__contentPrimary');
    const chin = card.querySelector('.eventGridListItemCalendar__chinContent');
    if (sec) sec.textContent = TM_MONTHS[d.getMonth()];
    if (pri) pri.textContent = String(d.getDate());
    if (chin) chin.textContent = TM_WEEKDAYS[d.getDay()];
    const timeEl = card.querySelector('time');
    if (timeEl) timeEl.setAttribute('datetime', ev.date);
  }

  // Country flag — keep it a flag, just swap to the event's country.
  const flag = card.querySelector('.eventGridListItemContent__contentFlag');
  if (flag && ev.countryCode) {
    flag.setAttribute('src', `https://img.vggcdn.net/broadway-icons/v2.16.0/flags/small/${ev.countryCode.toLowerCase()}.svg`);
    flag.setAttribute('alt', `Flag of ${ev.countryCode.toUpperCase()}`);
  }

  // Location (sibling of flag) + venue (second content part) in the title row.
  const titleParts = card.querySelectorAll('.eventGridListItemTitle__title .eventGridListItemContent__contentPart');
  const locBdi = titleParts[0]?.querySelector('bdi');
  if (locBdi) locBdi.textContent = [ev.city, ev.country].filter(Boolean).join(', ') || ev.country || '—';
  const venueBdi = titleParts[1]?.querySelector('bdi');
  if (venueBdi) venueBdi.textContent = ev.venue;

  // Subtitle row: "From €309" / time / artist name.
  const subParts = card.querySelectorAll('.eventGridListItemSubtitle__subtitle .eventGridListItemContent__contentPart');
  const priceBdi = subParts[0]?.querySelector('bdi');
  if (priceBdi) priceBdi.textContent = ev.price != null ? `From ${currencySymbol(ev.currency)}${ev.price}` : 'See prices';
  const timeBdi = subParts[1]?.querySelector('bdi');
  if (timeBdi) timeBdi.textContent = formatClock(ev.time);
  const nameBdi = subParts[2]?.querySelector('bdi');
  if (nameBdi) nameBdi.textContent = ev.attractionName || ev.title;

  return card;
}

// Hide the frozen skeleton/shimmer loaders captured in the homepage snapshot
// (empty bway-gTnEAZ blocks under the carousel that would otherwise pulse
// forever because the real viagogo app never hydrates them).
function hideSkeletonLoaders() {
  document.querySelectorAll('.bway-gTnEAZ').forEach(el => {
    const box = el.closest('[aria-hidden="true"]') || el.parentElement;
    if (box) box.style.display = 'none';
  });
}

// Repaint the artist page hero (h1 "<Artist> Tickets" + performer image) for
// the loaded artist. We swap every banner/logo image that the original page
// shipped for Bad Bunny so the live performer's own picture shows instead.
function paintArtistHeader(name, image) {
  if (name) {
    const h1 = document.getElementById('hero-banner-content') || document.querySelector('h1');
    if (h1) h1.textContent = `${name} Tickets`;
    document.title = `${name} Tickets - viagogo`;
  }
  if (image) {
    document.querySelectorAll('img[alt^="Bad Bunny"]').forEach(img => {
      img.setAttribute('src', image);
      img.removeAttribute('srcset'); // drop the old responsive set so our src wins
      // Ticketmaster art is 16:9 while viagogo's slots are square/portrait —
      // cover-fit so people's photos crop cleanly instead of stretching.
      img.style.objectFit = 'cover';
      img.setAttribute('alt', name ? `${name} Tickets` : img.getAttribute('alt'));
    });
  }
}

// Replace the static demo grid on artist.html with a live grid. If the page was
// opened for a specific artist (?attractionId=), we load THAT artist's full
// list of tour dates; otherwise we fall back to a category feed.
// Sort/filter state for the artist-page "all locations" grid, driven by the
// Date / Price dropdowns. Re-applied on every repaint (filter change, page nav).
let GRID_SORT = { date: 'all', price: 'none' };

function applyGridSort(events) {
  let out = events.slice();
  if (GRID_SORT.date === 'soon') {
    out = out.filter(e => {
      const d = new Date(e.date);
      const days = (d - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    });
  }
  if (GRID_SORT.price === 'asc') out.sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (GRID_SORT.price === 'desc') out.sort((a, b) => (b.price || 0) - (a.price || 0));
  return out;
}

async function initLiveGrid() {
  const firstCard = document.querySelector('a[class*="eventGridListItem__container"]');
  if (!firstCard) return; // not a grid page

  // The artist page can ship either ONE grid or TWO. Detect them explicitly by
  // their data-testid so we never process the same <ul> twice.
  let primaryUl = document.querySelector('ul[data-testid="primaryGrid"]');
  let restUl = document.querySelector('ul[data-testid="restGrid"]');
  // Fallback for snapshots without testids: use whatever <ul> holds firstCard.
  if (!primaryUl && !restUl) {
    primaryUl = firstCard.closest('ul');
  }
  // If only restGrid exists, treat IT as the single primary grid (and disable
  // the secondary path) so we don't double-render into the same element.
  if (!primaryUl && restUl) { primaryUl = restUl; restUl = null; }
  const ul = primaryUl;
  if (!ul) return;
  const cardLi = (Array.from(ul.children).find(li =>
    li.querySelector && li.querySelector('a[class*="eventGridListItem__container"]'))) || firstCard.closest('li');
  if (!cardLi) return;

  const q = new URLSearchParams(location.search);
  const attractionId = q.get('attractionId');
  const artistName = q.get('name');
  paintArtistHeader(artistName, q.get('img'));

  // Hide the original (Bad Bunny) rows immediately so there's no flash of
  // stale content while we fetch — the "couple seconds of Bad Bunny" bug.
  const gridSection = ul.closest('[class*="sc-oo2xkq-1"]') || ul.parentElement;
  if (gridSection) gridSection.style.visibility = 'hidden';

  const restCardLiTpl = restUl
    ? Array.from(restUl.children).find(li => li.querySelector('a[class*="eventGridListItem__container"]'))
    : null;
  const restPageSize = restUl
    ? Array.from(restUl.children).filter(li => li.querySelector('a[class*="eventGridListItem__container"]')).length
    : 0;
  const restSection = restUl ? (restUl.closest('[class*="sc-oo2xkq-1"]') || restUl.parentElement) : null;

  let allEvents = [];
  async function load(city = '') {
    try {
      const raw = attractionId
        ? await fetchEventsByAttraction(attractionId)
        : await fetchEvents({ segmentName: TM_SEGMENTS[q.get('cat')] || 'Music', size: 40, city });
      allEvents = raw.map(mapEventToCard).filter(e => e.title);
    } catch (err) {
      console.error('[ticketmaster] grid load failed:', err);
      allEvents = [];
    }
  }
  await load();
  if (!allEvents.length) { if (gridSection) gridSection.style.visibility = ''; return; }

  // ---- primary grid: first N events ("near you") ----
  const oldCardLis = Array.from(ul.children).filter(li =>
    li.querySelector('a[class*="eventGridListItem__container"]'));
  const primaryCount = Math.min(oldCardLis.length || 3, allEvents.length);

  function renderPrimary() {
    const primaryEvents = allEvents.slice(0, primaryCount);
    const fragment = document.createDocumentFragment();
    primaryEvents.forEach(ev => {
      const li = cardLi.cloneNode(true);
      const card = li.querySelector('a[class*="eventGridListItem__container"]');
      if (card) fillGridCard(card, ev);
      fragment.appendChild(li);
    });
    ul.querySelectorAll('li').forEach(li => {
      if (li.querySelector('a[class*="eventGridListItem__container"]')) li.remove();
    });
    ul.appendChild(fragment);
    const heading = ul.querySelector('h2, h3');
    if (heading && /event/i.test(heading.textContent)) {
      heading.textContent = `${primaryEvents.length} event${primaryEvents.length === 1 ? '' : 's'} near you`;
    }
  }

  // ---- secondary grid: remaining events, paged + sortable/filterable ----
  let restPage = 0;
  function restEventsSorted() {
    return applyGridSort(allEvents.slice(primaryCount));
  }
  function renderRest() {
    if (!restUl || !restCardLiTpl) return;
    const sorted = restEventsSorted();
    if (!sorted.length) { if (restSection) restSection.style.display = 'none'; return; }
    if (restSection) restSection.style.display = '';
    const totalPages = Math.max(1, Math.ceil(sorted.length / restPageSize));
    restPage = Math.min(restPage, totalPages - 1);
    const pageEvents = sorted.slice(restPage * restPageSize, (restPage + 1) * restPageSize);

    const fragment = document.createDocumentFragment();
    pageEvents.forEach(ev => {
      const li = restCardLiTpl.cloneNode(true);
      const card = li.querySelector('a[class*="eventGridListItem__container"]');
      if (card) fillGridCard(card, ev);
      fragment.appendChild(li);
    });
    restUl.querySelectorAll('li').forEach(li => {
      if (li.querySelector('a[class*="eventGridListItem__container"]')) li.remove();
    });
    restUl.appendChild(fragment);
    const restHeading = restUl.querySelector('h2, h3, span');
    if (restHeading) restHeading.textContent = `${sorted.length} event${sorted.length === 1 ? '' : 's'} in all locations`;

    // Wire (or rewire) the original numbered pagination buttons to real pages.
    const buttons = Array.from(document.querySelectorAll('[data-testid^="restGrid-"]'));
    buttons.forEach((btn, i) => {
      btn.style.display = i < totalPages ? '' : 'none';
      btn.setAttribute('aria-current', i === restPage ? 'true' : 'false');
      btn.onclick = (e) => {
        e.preventDefault();
        restPage = i;
        renderRest();
        restUl.scrollIntoView({ block: 'nearest' });
      };
    });
  }

  function renderAll() {
    renderPrimary();
    restPage = 0;
    renderRest();
    if (typeof tagEventCards === 'function') tagEventCards();
  }
  renderAll();
  if (gridSection) gridSection.style.visibility = '';

  // ---- wire the Location / Date / Price filter pills ----
  const comboboxes = document.querySelectorAll('[role="combobox"]');
  const locationBox = Array.from(comboboxes).find(c => c.getAttribute('aria-label') === 'Filter by location');
  const dateBox = Array.from(comboboxes).find(c => c.getAttribute('aria-label') === 'Filter by date');
  const priceBox = Array.from(comboboxes).find(c => c.getAttribute('aria-label') === 'Filter by price');

  if (locationBox && typeof attachDropdown === 'function') {
    const label = locationBox.querySelector('.sc-bCwfaA');
    attachDropdown(locationBox, TM_CITIES.map(c => ({ label: c })), async (opt) => {
      if (label) label.textContent = opt.label;
      if (gridSection) gridSection.style.visibility = 'hidden';
      await load(opt.label);
      if (!allEvents.length) { allEvents = []; }
      renderAll();
      if (gridSection) gridSection.style.visibility = '';
    });
  }
  if (dateBox && typeof attachDropdown === 'function') {
    const label = dateBox.querySelector('.sc-bCwfaA');
    attachDropdown(dateBox, [{ label: 'All dates', value: 'all' }, { label: 'Next 7 days', value: 'soon' }], (opt) => {
      if (label) label.textContent = opt.label;
      GRID_SORT.date = opt.value;
      restPage = 0;
      renderRest();
    });
  }
  if (priceBox && typeof attachDropdown === 'function') {
    const label = priceBox.querySelector('.sc-bCwfaA');
    attachDropdown(priceBox, [
      { label: 'Price', value: 'none' },
      { label: 'Lowest first', value: 'asc' },
      { label: 'Highest first', value: 'desc' },
    ], (opt) => {
      if (label) label.textContent = opt.label;
      GRID_SORT.price = opt.value;
      restPage = 0;
      renderRest();
    });
  }

  // ---- "Popular artists near you" — fill with real attractions from TM ----
  fillPopularArtists(allEvents);
}

// Repaint the static "Popular artists near you" tile list with real performers
// pulled from the events we already fetched (deduped by attraction).
function fillPopularArtists(events) {
  const heading = Array.from(document.querySelectorAll('h2, h3'))
    .find(h => h.textContent.trim() === 'Popular artists near you');
  if (!heading) return;
  let scope = heading.parentElement;
  let list = null;
  for (let i = 0; i < 4 && scope; i++) {
    const item = scope.querySelector('a[href*="-Biletleri"] img[alt]');
    if (item) { list = item.closest('a').parentElement; break; }
    scope = scope.parentElement;
  }
  if (!list) return;
  const tpl = list.children[0];
  if (!tpl) return;

  const seen = new Set();
  const artists = [];
  events.forEach(ev => {
    if (ev.attractionId && !seen.has(ev.attractionId)) {
      seen.add(ev.attractionId);
      artists.push(ev);
    }
  });
  if (!artists.length) return;

  const fragment = document.createDocumentFragment();
  artists.slice(0, list.children.length || 6).forEach(ev => {
    const item = tpl.cloneNode(true);
    const img = item.querySelector('img[alt]');
    if (img) {
      if (ev.image) { img.setAttribute('src', ev.image); img.removeAttribute('srcset'); }
      img.setAttribute('alt', ev.attractionName || ev.title);
      img.style.objectFit = 'cover';
    }
    const h3 = item.querySelector('h3');
    if (h3) h3.textContent = ev.attractionName || ev.title;
    const link = item.querySelector('a');
    if (link) {
      link.setAttribute('href', `artist.html?attractionId=${encodeURIComponent(ev.attractionId)}&name=${encodeURIComponent(ev.attractionName || ev.title)}&img=${encodeURIComponent(ev.image || '')}`);
    }
    fragment.appendChild(item);
  });
  list.replaceChildren(fragment);
}

// Read a live event handed over through the URL (sквозная передача данных),
// so the detail page paints real TM data without a second network call.
function liveEventFromUrl() {
  const q = new URLSearchParams(location.search);
  if (!q.get('title')) return null;
  const price = parseFloat(q.get('price'));
  return {
    id: q.get('id') || 'live',
    artist: q.get('title'),
    venue: q.get('venue') || 'Venue TBA',
    city: q.get('city') || '',
    country: q.get('country') || '',
    date: q.get('date') ? `${q.get('date')}T${q.get('time') || '19:00:00'}` : new Date().toISOString(),
    time: formatClock(q.get('time')),
    currency: q.get('currency') === 'USD' ? '$' : (q.get('currency') || '$'),
    basePrice: Number.isFinite(price) && price > 0 ? price : 120,
    image: q.get('img') || '',
    _live: true,
  };
}

// ---------- HOMEPAGE CAROUSELS ----------
// Each real content carousel on the homepage is filled with live data for a
// dedicated category. We locate the carousel by its section heading text, then
// clone the carousel's OWN first card so the markup/classes stay pixel-perfect.
const CAROUSEL_CATEGORIES = {
  // The live homepage carousel "Recommended for you" is a wall of concert
  // artists, so it maps to Music. "Popular events" (when present) does too.
  'Popular events': 'Music',
  'Recommended for you': 'Music',
  'Recently viewed': 'Arts & Theatre',
};

function findCarouselTrack(headingText) {
  // Accept either an exact string or a predicate, so artist-page carousels with
  // dynamic headings ("Bad Bunny fans also love") can be matched by substring.
  const match = typeof headingText === 'function'
    ? headingText
    : (t) => t === headingText;
  const heading = Array.from(document.querySelectorAll('h2, h3, h4, span'))
    .find(h => match(h.textContent.trim()) && h.children.length === 0);
  if (!heading) return null;
  // Walk up until we reach the ancestor that actually contains the carousel.
  let scope = heading.parentElement;
  for (let i = 0; i < 4 && scope; i++) {
    const firstCard = scope.querySelector('[data-carousel-index]');
    if (firstCard) return { track: firstCard.parentElement, template: firstCard };
    scope = scope.parentElement;
  }
  return null;
}

// Format a TM localDate into the carousel's "10 Jun" style subtitle.
function shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? '' : `${d.getDate()} ${TM_MONTHS[d.getMonth()]}`;
}

// Inject one live event into a cloned carousel card (title + date + image),
// keeping the original viagogo markup/classes 1:1.
function fillCarouselCard(templateNode, ev) {
  const card = templateNode.cloneNode(true);

  const img = card.querySelector('img[alt]');
  if (img) {
    if (ev.image) { img.setAttribute('src', ev.image); img.removeAttribute('srcset'); }
    img.style.objectFit = 'cover'; // keep TM 16:9 art from stretching in the slot
    img.setAttribute('alt', ev.title);
  }
  // Card title lives in an h2/h3 inside the card
  const title = card.querySelector('h2, h3');
  if (title) title.textContent = ev.title;

  // The card has up to two subtitle <p>s that are NOT inside the Follow button:
  //   [0] = date line  ("Sat, 27 Jun • 20:00" / "30 Jul")
  //   [1] = location/“N events near you” line
  const subs = Array.from(card.querySelectorAll('p')).filter(p => !p.closest('button'));
  if (subs[0]) {
    const dateLine = ev.time
      ? `${shortDate(ev.date)} • ${formatClock(ev.time)}`
      : shortDate(ev.date);
    subs[0].textContent = dateLine || 'See dates';
  }
  if (subs[1]) {
    subs[1].textContent = [ev.city, ev.country].filter(Boolean).join(', ') || 'Find tickets';
  }

  // The overlay <a> is the card's click target. If this event belongs to an
  // attraction (artist/performer), route to the ARTIST page so all of that
  // artist's tour dates load — exactly like clicking an artist on viagogo.
  // Otherwise fall straight through to the event detail page.
  const link = card.querySelector('a[aria-label]');
  if (link) {
    const href = ev.attractionId
      ? `artist.html?attractionId=${encodeURIComponent(ev.attractionId)}&name=${encodeURIComponent(ev.attractionName || ev.title)}&img=${encodeURIComponent(ev.image || '')}`
      : `fticket.html?${tmEventParams(ev)}`;
    link.setAttribute('href', href);
    link.setAttribute('aria-label', ev.title);
  }
  return card;
}

// Artist-page recommendation carousels. Headings are dynamic per artist, so we
// match by substring and fill each with live Music events from Ticketmaster.
const ARTIST_CAROUSELS = [
  { match: (t) => /fans also love$/i.test(t), category: 'Music' },
  { match: (t) => /^Trending events/i.test(t), category: 'Music' },
  { match: (t) => /^Popular artists near you$/i.test(t), category: 'Music' },
];

async function fillCarousel(headingText, category, city = '') {
  const found = findCarouselTrack(headingText);
  if (!found) return; // section not on this page -> nothing to do
  // Hide the static cards while we fetch so the user never sees a flash of
  // the original placeholder content before the live cards land.
  found.track.style.visibility = 'hidden';
  let events;
  try {
    events = (await fetchEvents({ segmentName: category, size: 10, city }))
      .map(mapEventToCard)
      .filter(e => e.title);
  } catch (err) {
    console.error(`[ticketmaster] "${headingText}" load failed:`, err);
    found.track.style.visibility = ''; // fallback: reveal original cards
    return;
  }
  if (!events.length) { found.track.style.visibility = ''; return; }
  const fragment = document.createDocumentFragment();
  events.forEach(ev => fragment.appendChild(fillCarouselCard(found.template, ev)));
  found.track.replaceChildren(fragment);
  found.track.style.visibility = '';
}

let TM_CURRENT_CITY = '';

function refreshCarousels() {
  Object.entries(CAROUSEL_CATEGORIES).forEach(([heading, category]) => {
    fillCarousel(heading, category, TM_CURRENT_CITY);
  });
}

async function initLiveCarousels() {
  // Only act on pages that actually have carousels.
  if (!document.querySelector('[data-carousel-index]')) return;
  hideSkeletonLoaders(); // kill the frozen shimmer blocks under the carousel
  const jobs = [
    ...Object.entries(CAROUSEL_CATEGORIES).map(([heading, category]) => fillCarousel(heading, category, TM_CURRENT_CITY)),
    ...ARTIST_CAROUSELS.map(({ match, category }) => fillCarousel(match, category, TM_CURRENT_CITY)),
  ];
  await Promise.allSettled(jobs);
}

// Cities offered by the original "Filter by location" combobox. Selecting one
// re-queries Ticketmaster scoped to that city, so every carousel reflects it.
const TM_CITIES = ['Paris', 'London', 'Cologne', 'Berlin', 'Madrid', 'Amsterdam', 'New York'];

function wireLocationFilter() {
  const combobox = document.querySelector('[role="combobox"][aria-label="Filter by location"]');
  const label = combobox?.querySelector('.sc-bCwfaA');
  if (!combobox || !label || typeof attachDropdown !== 'function') return;
  attachDropdown(combobox, TM_CITIES.map(c => ({ label: c })), (opt) => {
    label.textContent = opt.label;
    TM_CURRENT_CITY = opt.label;
    refreshCarousels();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Reveal hidden sections (see injectAntiFlashStyle) once everything that can
  // repaint has settled — success or failure, so the page never stays hidden.
  const reveal = () => document.documentElement.setAttribute('data-tm-loaded', '1');
  const safetyTimer = setTimeout(reveal, 6000);

  Promise.allSettled([initLiveGrid(), initLiveCarousels()]).then(() => {
    clearTimeout(safetyTimer);
    reveal();
  });
  wireLocationFilter(); // "Filter by location" combobox -> live city-scoped queries
});
