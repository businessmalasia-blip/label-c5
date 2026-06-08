// ============================================================================
// viagogo clone — universal dynamic engine (Stage 2)
// Architecture note: this whole file is a placeholder data layer designed to
// be swapped for real Ticketmaster API calls later. Every function that
// currently reads from `mockEvents` / `generateMockEvent` / ticket builders
// is the seam where a real fetch() to the Ticketmaster API would go.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. EVENT DATABASE (seeded from real data captured in the artist.html grid)
//    + a deterministic generator so ANY event id opens without a 404.
// ---------------------------------------------------------------------------
const mockEvents = {
  0: { id: 0, artist: 'Bad Bunny', venue: 'Paris La Defense Arena', city: 'Nanterre', country: 'France',  date: '2026-07-04T19:00:00+02:00', time: '7:00 PM', currency: '€', basePrice: 219 },
  1: { id: 1, artist: 'Bad Bunny', venue: 'Paris La Defense Arena', city: 'Nanterre', country: 'France',  date: '2026-07-05T19:00:00+02:00', time: '7:00 PM', currency: '€', basePrice: 229 },
  2: { id: 2, artist: 'Bad Bunny', venue: 'King Baudouin Stadium', city: 'Brussels', country: 'Belgium', date: '2026-07-22T19:00:00+02:00', time: 'TBA',     currency: '€', basePrice: 245 },
  3: { id: 3, artist: 'Bad Bunny', venue: 'Riyadh Air Metropolitano (Metropolitano Stadium)', city: 'Madrid', country: 'Spain', date: '2026-06-10T20:00:00+02:00', time: '8:00 PM', currency: '€', basePrice: 259 },
  4: { id: 4, artist: 'Bad Bunny', venue: 'Riyadh Air Metropolitano (Metropolitano Stadium)', city: 'Madrid', country: 'Spain', date: '2026-06-11T20:00:00+02:00', time: '8:00 PM', currency: '€', basePrice: 265 },
  5: { id: 5, artist: 'Bad Bunny', venue: 'Riyadh Air Metropolitano (Metropolitano Stadium)', city: 'Madrid', country: 'Spain', date: '2026-06-14T20:00:00+02:00', time: '8:00 PM', currency: '€', basePrice: 271 },
  6: { id: 6, artist: 'Bad Bunny', venue: 'Riyadh Air Metropolitano (Metropolitano Stadium)', city: 'Madrid', country: 'Spain', date: '2026-06-15T20:00:00+02:00', time: '8:00 PM', currency: '€', basePrice: 275 },
  7: { id: 7, artist: 'Bad Bunny', venue: 'Merkur Spiel-Arena (formerly Esprit Arena)', city: 'Düsseldorf', country: 'Germany', date: '2026-06-20T20:00:00+02:00', time: '8:00 PM', currency: '€', basePrice: 209 },
  8: { id: 8, artist: 'Bad Bunny', venue: 'Merkur Spiel-Arena (formerly Esprit Arena)', city: 'Düsseldorf', country: 'Germany', date: '2026-06-21T20:00:00+02:00', time: '8:00 PM', currency: '€', basePrice: 215 },
};

// World pool used by the generator so that literally any id (sport, theatre,
// any city/country) resolves to *something* with viagogo's original look.
const WORLD_POOL = [
  { artist: 'New York Knicks',          venue: 'Madison Square Garden',     city: 'New York',  country: 'USA',     currency: '$' },
  { artist: 'Real Madrid vs Barcelona', venue: 'Santiago Bernabéu',         city: 'Madrid',    country: 'Spain',   currency: '€' },
  { artist: 'Hamilton',                 venue: 'Victoria Palace Theatre',   city: 'London',    country: 'UK',      currency: '£' },
  { artist: 'Ariana Grande',            venue: 'The O2 Arena',              city: 'London',    country: 'UK',      currency: '£' },
  { artist: 'Coldplay',                 venue: 'Allianz Arena',             city: 'Munich',    country: 'Germany', currency: '€' },
  { artist: 'World Cup 2026',           venue: 'MetLife Stadium',           city: 'New York',  country: 'USA',     currency: '$' },
  { artist: 'Galatasaray vs Fenerbahçe', venue: 'Rams Park',                city: 'Istanbul',  country: 'Turkey',  currency: '₺' },
];

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

// Deterministic pseudo-random generator (so the same id always renders the
// same "data" — exactly how a real cached API response would behave)
function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateMockEvent(rawId) {
  const seed = hashSeed(String(rawId));
  const rand = seededRandom(seed);
  const pick = WORLD_POOL[seed % WORLD_POOL.length];
  const day = (seed % 27) + 1;
  const hour = 18 + (seed % 4);
  return {
    id: rawId,
    artist: pick.artist,
    venue: pick.venue,
    city: pick.city,
    country: pick.country,
    date: `2026-${String((seed % 12) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${hour}:00:00+00:00`,
    time: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
    currency: pick.currency,
    basePrice: 80 + Math.floor(rand() * 400),
    _generated: true,
  };
}

function resolveEvent(rawId) {
  if (rawId == null) return mockEvents[0];
  if (mockEvents[rawId] != null) return mockEvents[rawId];
  return generateMockEvent(rawId);
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ---------------------------------------------------------------------------
// 2. UNIVERSAL ROUTER — intercept clicks on event cards anywhere on the site
//    and route them through our own templates with ?event_id=
// ---------------------------------------------------------------------------
function wireUniversalRouter() {
  document.querySelectorAll('a[class*="eventGridListItem__container"]').forEach((a, idx) => {
    if (a.dataset.routed) return;
    a.dataset.routed = '1';
    const id = a.dataset.eventId != null ? a.dataset.eventId : idx;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `fticket.html?event_id=${encodeURIComponent(id)}`;
    });
  });

  // Ticket "buy" CTA -> checkout (delegated, since the list re-renders)
  document.body.addEventListener('click', (e) => {
    const card = e.target.closest('[data-listing-id]');
    if (!card) return;
    const cta = e.target.closest('button, a');
    if (!cta) return;
    e.preventDefault();
    const id = card.getAttribute('data-listing-id');
    const price = card.getAttribute('data-price') || '';
    const section = card.querySelector('h3')?.textContent?.trim() || '';
    const row = (card.querySelector('span'))
      ? Array.from(card.querySelectorAll('span')).map(s => s.textContent).find(t => /Row/.test(t)) || ''
      : '';
    const seat = card.getAttribute('data-seat') || '';
    const params = new URLSearchParams({ listing_id: id, price, section, row, seat, event_id: getQueryParam('event_id') || '0' });
    window.location.href = `checkout.html?${params.toString()}`;
  });
}

// Tag each grid card with a stable index-based event id for the router above
function tagEventCards() {
  document.querySelectorAll('a[class*="eventGridListItem__container"]').forEach((a, idx) => {
    a.dataset.eventId = String(idx);
  });
}

// ---------------------------------------------------------------------------
// 3. EVENT DETAIL PAGE (fticket.html) — repaint header + generate ticket grid
//    for whatever event id is in the URL.
// ---------------------------------------------------------------------------
const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatEventDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${WEEKDAYS[d.getUTCDay()]} · ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function paintEventHeader(ev) {
  const header = document.getElementById('event-detail-header');
  if (!header) return;
  const h1 = header.querySelector('h1');
  if (h1) h1.textContent = ev.artist;
  const dateSpan = Array.from(header.querySelectorAll('span')).find(s => /·/.test(s.textContent));
  if (dateSpan) dateSpan.textContent = `${formatEventDate(ev.date)} · ${ev.time}`;
  const venueBtn = Array.from(header.querySelectorAll('button')).find(b => /Arena|Stadium|Theatre|Garden|Park|Bernabéu/i.test(b.textContent));
  if (venueBtn) venueBtn.textContent = `${ev.venue}, ${ev.city}, ${ev.country}`;
  document.title = `${ev.artist} Tickets - ${ev.venue} - viagogo`;
}

const ROWS = ['1','3','5','6','8','9','12','14','17','20','22','25','31','—'];

// The venue map ships its real section geometry inside the hidden
// `#section-map-base > #map-def` SVG. Each <g sprite-identifier="sNNN"> is a
// section; the listing cards reference it via data-feature-id="<eid>_<NNN>".
// We read those real sprites once so generated tickets point at genuine map
// sections — that is what makes the hover-highlight land exactly 1:1.
let MAP_SPRITES = null;
function getMapSprites() {
  if (MAP_SPRITES) return MAP_SPRITES;
  const def = document.querySelector('#section-map-base #map-def');
  MAP_SPRITES = def
    ? Array.from(def.querySelectorAll('g[sprite-identifier]')).map(g => ({
        sprite: g.getAttribute('sprite-identifier').replace(/^s/, ''),
        eid: g.querySelector('path')?.getAttribute('eid') || '1152',
      }))
    : [];
  return MAP_SPRITES;
}

// Stable, human-looking section label derived from a real sprite number, so
// the same map section always shows the same "Section NNN" on its card.
function sectionLabelForSprite(sprite) {
  return String(100 + (parseInt(sprite, 10) % 230));
}

function buildTicketsForEvent(ev) {
  const seed = hashSeed(`${ev.id}-${ev.artist}-${ev.venue}`);
  const rand = seededRandom(seed);
  const sprites = getMapSprites();
  const count = 50 + Math.floor(rand() * 101); // 50..150 listings, stable per seed
  const tickets = [];
  for (let i = 0; i < count; i++) {
    const sp = sprites.length
      ? sprites[Math.floor(rand() * sprites.length)]
      : { sprite: String(1191644 + i), eid: '1152' };
    const section = sectionLabelForSprite(sp.sprite);
    const row = ROWS[Math.floor(rand() * ROWS.length)];
    tickets.push({
      id: String(seed + i * 97),
      feature: `${sp.eid}_${sp.sprite}`, // real map feature id -> drives highlight
      sprite: sp.sprite,
      section,
      row,
      seat: row === '—' ? '—' : String(1 + Math.floor(rand() * 30)),
      qty: 1 + Math.floor(rand() * 4),
      price: Math.round(ev.basePrice * (0.7 + rand() * 1.6)),
      venue: ev.venue,
      currency: ev.currency,
    });
  }
  return tickets;
}

let ticketCardTemplate = null;
let currentTickets = [];
let activeFilters = { qty: 'any', sort: 'price-asc', sprite: null };

function captureTicketTemplate() {
  const list = document.getElementById('listings-container');
  if (!list) return null;
  const wrapper = list.querySelector('[data-image-container="true"]');
  if (!wrapper) return null;
  let tpl = wrapper.outerHTML;
  tpl = tpl.replace(/data-listing-id="\d+"/, 'data-listing-id="__ID__" data-seat="__SEAT__" data-sprite="__SPRITE__"')
           .replace(/data-feature-id="[^"]*"/, 'data-feature-id="__FEATURE__"')
           .replace(/data-price="[^"]*"/, 'data-price="__PRICE__"')
           .replace(/alt="[^"]*- Section [^"]*"/, 'alt="__VENUE__ - Section __SECTION__"')
           .replace(/>Section [^<]*<\/h3>/, '>Section __SECTION__</h3>')
           .replace(/<span>Row [^<]*<\/span>/, '<span>Row __ROW__</span>')
           .replace(/data-listing-cta-id="listing-\d+"/, 'data-listing-cta-id="listing-__ID__"')
           .replace(/>\d+ tickets? together</, '>__QTY__ ticket__PLURAL__ together<')
           .replace(/>€\d[\d.,]*<(?=\/div><div class="bway-efCTVw bway-iJhbLW bway-kyQsLF)/, '>__PRICE__<');
  return tpl;
}

function renderTicket(t) {
  return ticketCardTemplate
    .replaceAll('__ID__', t.id)
    .replaceAll('__FEATURE__', t.feature)
    .replaceAll('__PRICE__', t.currency + t.price)
    .replaceAll('__VENUE__', t.venue)
    .replaceAll('__SECTION__', t.section)
    .replaceAll('__ROW__', t.row)
    .replaceAll('__SEAT__', t.seat)
    .replaceAll('__SPRITE__', t.sprite)
    .replaceAll('__QTY__', t.qty)
    .replaceAll('__PLURAL__', t.qty === 1 ? '' : 's');
}

function applyFiltersAndRender() {
  const list = document.getElementById('listings-container');
  if (!list || !ticketCardTemplate) return;
  let filtered = currentTickets;
  if (activeFilters.qty !== 'any') {
    filtered = filtered.filter(t => t.qty === Number(activeFilters.qty));
  }
  if (activeFilters.sprite) {
    filtered = filtered.filter(t => t.sprite === activeFilters.sprite);
  }
  filtered = [...filtered].sort((a, b) => activeFilters.sort === 'price-asc' ? a.price - b.price : b.price - a.price);
  list.innerHTML = filtered.map(renderTicket).join('');
  highlightWireUp();
  updateListingsCountLabel(filtered.length);
}

function updateListingsCountLabel(n) {
  const h2 = Array.from(document.querySelectorAll('h2')).find(h => /listings/.test(h.textContent));
  if (h2) h2.textContent = `${n} listings`;
}

// ---------------------------------------------------------------------------
// 4. INTERACTIVE FILTERS — quantity selector + sort/filter button.
//    Original markup is reused (data-testid="event-detail-quantity-filter",
//    data-testid="event-detail-filters-button"); we just give it behaviour.
// ---------------------------------------------------------------------------
// Build a native-feeling dropdown anchored under an original combobox. We do
// not touch sc-*/bway-* classes or any stylesheet — the menu is a fresh node
// positioned with inline layout styles, and option text reuses viagogo's own
// `sc-bCwfaA` typography class so it reads identically to the trigger.
function attachDropdown(combobox, options, onSelect) {
  if (!combobox) return;
  combobox.style.cursor = 'pointer';

  const menu = document.createElement('div');
  menu.setAttribute('role', 'listbox');
  menu.style.cssText =
    'position:absolute;top:calc(100% + 6px);left:0;min-width:200px;background:#fff;' +
    'border:1px solid #E4E6E8;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.14);' +
    'padding:6px;z-index:50;display:none;';

  options.forEach(opt => {
    const item = document.createElement('div');
    item.setAttribute('role', 'option');
    item.className = 'sc-bCwfaA';
    item.textContent = opt.label;
    item.style.cssText = 'padding:10px 12px;border-radius:8px;cursor:pointer;white-space:nowrap;';
    item.addEventListener('mouseenter', () => { item.style.background = '#F4F6F5'; });
    item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.querySelectorAll('[role="option"]').forEach(o => o.setAttribute('aria-selected', 'false'));
      item.setAttribute('aria-selected', 'true');
      onSelect(opt);
      close();
    });
    menu.appendChild(item);
  });

  const host = combobox.closest('[data-testid]') || combobox.parentElement;
  host.style.position = host.style.position || 'relative';
  host.appendChild(menu);

  function open() {
    document.querySelectorAll('[role="listbox"]').forEach(m => { if (m !== menu) m.style.display = 'none'; });
    menu.style.display = 'block';
    combobox.setAttribute('aria-expanded', 'true');
  }
  function close() {
    menu.style.display = 'none';
    combobox.setAttribute('aria-expanded', 'false');
  }
  combobox.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display === 'block' ? close() : open();
  });
  document.addEventListener('click', close);
}

function wireFilters() {
  // Quantity filter — real listbox of ticket counts.
  const qtyCombo = document.querySelector('[data-testid="event-detail-quantity-filter"] [role="combobox"]');
  const qtyLabel = qtyCombo?.querySelector('.sc-bCwfaA');
  if (qtyCombo && qtyLabel) {
    attachDropdown(qtyCombo, [
      { label: 'Any number of tickets', value: 'any' },
      { label: '1 ticket', value: '1' },
      { label: '2 tickets', value: '2' },
      { label: '3 tickets', value: '3' },
      { label: '4 tickets', value: '4' },
    ], (opt) => {
      qtyLabel.textContent = opt.value === 'any' ? 'Any' : opt.label;
      activeFilters.qty = opt.value;
      applyFiltersAndRender();
    });
  }

  // Sort/price filter — real listbox of sort orders.
  const sortCombo = document.querySelector('[data-testid="event-detail-filters-button"] [role="combobox"]');
  const sortLabel = sortCombo?.querySelector('.sc-bCwfaA');
  if (sortCombo && sortLabel) {
    sortLabel.textContent = 'Price: low to high';
    attachDropdown(sortCombo, [
      { label: 'Price: low to high', value: 'price-asc' },
      { label: 'Price: high to low', value: 'price-desc' },
    ], (opt) => {
      sortLabel.textContent = opt.label;
      activeFilters.sort = opt.value;
      applyFiltersAndRender();
    });
  }
}

// ---------------------------------------------------------------------------
// 5. STADIUM MAP HIGHLIGHT — real section geometry, original colours.
//    viagogo draws the venue map on a Mapbox GL canvas, but the *vector*
//    source for every seating section lives in the hidden
//    `#section-map-base > #map-def` SVG: one <g sprite-identifier="sNNN"> per
//    section, each holding a white "idle" <path> and a coloured "active"
//    <path> in viagogo's own price-tier colour.
//    We clone that geometry into a visible, perfectly-transparent overlay
//    sitting on the map (so the page looks 1:1 untouched at rest), then on
//    hover/click of a listing we reveal the matching section's *original*
//    coloured path — exactly the highlight viagogo shows live. Section IDs,
//    classes and colours are taken verbatim from the source markup.
// ---------------------------------------------------------------------------
const SVG_NS = 'http://www.w3.org/2000/svg';

function buildMapOverlay() {
  const map = document.querySelector('[data-testid="map-container"]');
  const def = document.querySelector('#section-map-base #map-def');
  if (!map || !def || document.getElementById('section-map-overlay')) return;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = 'section-map-overlay';
  svg.setAttribute('viewBox', def.getAttribute('viewBox') || '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;';

  // Only sections that actually have listings should react to clicks.
  const ticketSprites = new Set(currentTickets.map(t => t.sprite));

  const geometry = def.cloneNode(true);
  geometry.removeAttribute('id');
  geometry.querySelectorAll('g[sprite-identifier]').forEach(g => {
    const sprite = g.getAttribute('sprite-identifier').replace(/^s/, '');
    const hasTickets = ticketSprites.has(sprite);
    const paths = Array.from(g.querySelectorAll('path'));
    paths.forEach((p, i) => {
      if (i === 0) {
        // First path becomes an invisible, hit-testable click zone aligned to
        // the real section geometry (Map -> List interaction).
        p.style.display = 'block';
        p.setAttribute('fill-opacity', '0');
        p.style.pointerEvents = hasTickets ? 'auto' : 'none';
        p.style.cursor = hasTickets ? 'pointer' : 'default';
      } else {
        p.style.display = 'none'; // coloured tier path, shown only when active
      }
    });
    if (!hasTickets) return;
    // Map -> List: click a sector to filter the list to that section.
    g.addEventListener('click', () => {
      selectSprite(activeFilters.sprite === sprite ? null : sprite);
    });
  });
  svg.appendChild(geometry);

  map.style.position = map.style.position || 'relative';
  map.appendChild(svg);
}

// Reset every section to idle (transparent), then optionally re-assert the
// currently-selected section so a sticky selection survives hover-out.
function clearHighlight() {
  document.querySelectorAll('#section-map-overlay g[sprite-identifier]').forEach(g => {
    Array.from(g.querySelectorAll('path')).forEach((p, i) => {
      if (i === 0) { p.setAttribute('fill-opacity', '0'); p.style.display = 'block'; }
      else { p.style.display = 'none'; }
    });
  });
  if (activeFilters.sprite) paintSprite(activeFilters.sprite);
}

function paintSprite(sprite) {
  const g = document.querySelector(`#section-map-overlay g[sprite-identifier="s${sprite}"]`);
  if (!g) return;
  const paths = Array.from(g.querySelectorAll('path'));
  // The coloured (non-white) path is viagogo's own active fill for the tier.
  const active = paths.find(p => (p.getAttribute('fill') || '').toLowerCase() !== '#ffffff') || paths[0];
  if (!active) return;
  active.style.display = 'block';
  active.setAttribute('fill-opacity', '0.9');
}

function highlightSprite(sprite) {
  buildMapOverlay();
  clearHighlight();
  if (sprite) paintSprite(sprite);
}

// Sticky selection: filter the list to one section and keep it lit. Passing
// null clears the filter (used by re-clicking the same sector).
function selectSprite(sprite) {
  activeFilters.sprite = sprite;
  applyFiltersAndRender();
  highlightSprite(sprite);
}

function highlightWireUp() {
  buildMapOverlay();
  document.querySelectorAll('#listings-container [data-listing-id]').forEach(card => {
    const sprite = (card.getAttribute('data-feature-id') || '').split('_')[1];
    if (!sprite) return;
    // List -> Map: transient hover highlight (returns to selection on leave).
    card.addEventListener('mouseenter', () => highlightSprite(sprite));
    card.addEventListener('mouseleave', () => highlightSprite(activeFilters.sprite));
  });
}

// ---------------------------------------------------------------------------
// 6. PAGE BOOTSTRAP
// ---------------------------------------------------------------------------
function initEventDetailPage() {
  const list = document.getElementById('listings-container');
  if (!list) return;
  // Prefer a live Ticketmaster event handed over via URL params; otherwise
  // fall back to the deterministic local engine (never 404s).
  const live = (typeof liveEventFromUrl === 'function') ? liveEventFromUrl() : null;
  const ev = live || resolveEvent(getQueryParam('event_id'));
  paintEventHeader(ev);
  ticketCardTemplate = captureTicketTemplate();
  if (!ticketCardTemplate) return;
  currentTickets = buildTicketsForEvent(ev);
  applyFiltersAndRender();
  wireFilters();
}

document.addEventListener('DOMContentLoaded', () => {
  tagEventCards();
  wireUniversalRouter();
  initEventDetailPage();
});
