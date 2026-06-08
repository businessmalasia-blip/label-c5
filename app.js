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
    const params = new URLSearchParams({ listing_id: id, price, section, event_id: getQueryParam('event_id') || '0' });
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

const SECTIONS = ['101','102','110','115','117','120','128','134','142','150','160','170','Fosse','Floor A','Floor B'];
const ROWS = ['1','3','5','6','8','9','12','14','17','20','22','25','31','—'];

function buildTicketsForEvent(ev) {
  const seed = hashSeed(`${ev.id}-${ev.artist}-${ev.venue}`);
  const rand = seededRandom(seed);
  const count = 12 + Math.floor(rand() * 25); // gives the "endless list" feel, scales per event
  const tickets = [];
  for (let i = 0; i < count; i++) {
    const section = SECTIONS[Math.floor(rand() * SECTIONS.length)];
    tickets.push({
      id: String(seed + i * 97),
      feature: `${(seed % 9000) + i}_${(seed % 1700000) + i}`,
      section,
      row: (section.startsWith('Floor') || section === 'Fosse') ? '—' : ROWS[Math.floor(rand() * ROWS.length)],
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
let activeFilters = { qty: 'any', sort: 'price-asc' };

function captureTicketTemplate() {
  const list = document.getElementById('listings-container');
  if (!list) return null;
  const wrapper = list.querySelector('[data-image-container="true"]');
  if (!wrapper) return null;
  let tpl = wrapper.outerHTML;
  tpl = tpl.replace(/data-listing-id="\d+"/, 'data-listing-id="__ID__"')
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
function wireFilters() {
  const qtyBox = document.querySelector('[data-testid="event-detail-quantity-filter"] .sc-bCwfaA');
  if (qtyBox) {
    const options = ['Any', '1 ticket', '2 tickets', '3 tickets', '4 tickets'];
    let i = 0;
    const hitArea = qtyBox.closest('[role="combobox"]');
    hitArea.style.cursor = 'pointer';
    hitArea.addEventListener('click', () => {
      i = (i + 1) % options.length;
      qtyBox.textContent = options[i];
      activeFilters.qty = i === 0 ? 'any' : String(i);
      applyFiltersAndRender();
    });
  }
  const filterBtn = document.querySelector('[data-testid="event-detail-filters-button"] [role="combobox"]');
  if (filterBtn) {
    const label = filterBtn.querySelector('.sc-bCwfaA') || filterBtn;
    const options = [['Price: low to high', 'price-asc'], ['Price: high to low', 'price-desc']];
    let i = 0;
    label.textContent = options[0][0];
    filterBtn.style.cursor = 'pointer';
    filterBtn.addEventListener('click', () => {
      i = (i + 1) % options.length;
      label.textContent = options[i][0];
      activeFilters.sort = options[i][1];
      applyFiltersAndRender();
    });
  }
}

// ---------------------------------------------------------------------------
// 5. STADIUM MAP HIGHLIGHT
//    Note: viagogo renders the venue map as a Mapbox GL *canvas* (WebGL),
//    not as discrete SVG `<path>` sectors — individual sections are pixels,
//    not DOM nodes, so they cannot literally be recoloured via CSS/JS.
//    We reproduce the *behaviour* viagogo shows on hover/select — a
//    highlighted marker over the map that tracks the active listing — using
//    an overlay pin in viagogo's own highlight colour (#00865A), positioned
//    by a deterministic hash of the section name so the same section always
//    lights up the same spot.
// ---------------------------------------------------------------------------
function ensureMapOverlay() {
  const map = document.querySelector('[data-testid="map-container"]');
  if (!map) return null;
  let overlay = map.querySelector('.section-highlight-pin');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'section-highlight-pin';
    overlay.style.cssText = 'position:absolute;width:18px;height:18px;border-radius:50%;background:#00865A;box-shadow:0 0 0 6px rgba(0,134,90,0.25);transform:translate(-50%,-50%) scale(0);transition:transform .15s ease, left .2s ease, top .2s ease;pointer-events:none;z-index:5;';
    map.style.position = map.style.position || 'relative';
    map.appendChild(overlay);
  }
  return overlay;
}

function highlightSection(sectionName) {
  const overlay = ensureMapOverlay();
  if (!overlay) return;
  const seed = hashSeed(String(sectionName));
  overlay.style.left = (15 + (seed % 70)) + '%';
  overlay.style.top = (20 + ((seed >> 4) % 60)) + '%';
  overlay.style.transform = 'translate(-50%,-50%) scale(1)';
}

function clearHighlight() {
  const overlay = document.querySelector('.section-highlight-pin');
  if (overlay) overlay.style.transform = 'translate(-50%,-50%) scale(0)';
}

function highlightWireUp() {
  document.querySelectorAll('#listings-container [data-listing-id]').forEach(card => {
    const section = card.querySelector('h3')?.textContent?.replace('Section ', '').trim();
    if (!section) return;
    card.addEventListener('mouseenter', () => highlightSection(section));
    card.addEventListener('mouseleave', clearHighlight);
    card.addEventListener('click', () => highlightSection(section));
  });
}

// ---------------------------------------------------------------------------
// 6. PAGE BOOTSTRAP
// ---------------------------------------------------------------------------
function initEventDetailPage() {
  const list = document.getElementById('listings-container');
  if (!list) return;
  const ev = resolveEvent(getQueryParam('event_id'));
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
