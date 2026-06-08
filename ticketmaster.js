// ============================================================================
// ticketmaster.js — live data layer for the Viagogo-style clone.
// Three clean layers, each independently testable:
//   1. DATA    — talks to the Ticketmaster Discovery API, knows nothing of HTML
//   2. ADAPTER — flattens TM's nested JSON into our render-ready shape
//   3. RENDER  — clones the ORIGINAL Viagogo event card and fills it with data
// The markup/CSS is never authored here: we cloneNode() viagogo's real card so
// the design stays pixel-perfect; only text/attributes are substituted.
// ============================================================================

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
async function initLiveGrid() {
  const firstCard = document.querySelector('a[class*="eventGridListItem__container"]');
  if (!firstCard) return; // not a grid page

  // The grid is a <ul data-testid="primaryGrid"> whose first <li> is a heading
  // ("N events near you") and whose remaining <li>s each wrap one card. We clone
  // the WHOLE <li> per event so the grid layout/classes stay intact.
  const cardLi = firstCard.closest('li');
  const ul = cardLi ? cardLi.parentElement : firstCard.parentElement;
  if (!cardLi || !ul) return;

  const q = new URLSearchParams(location.search);
  const attractionId = q.get('attractionId');
  const artistName = q.get('name');
  paintArtistHeader(artistName, q.get('img'));

  let events;
  try {
    const raw = attractionId
      ? await fetchEventsByAttraction(attractionId)
      : await fetchEvents({ segmentName: TM_SEGMENTS[q.get('cat')] || 'Music', size: 12 });
    events = raw.map(mapEventToCard).filter(e => e.title);
  } catch (err) {
    console.error('[ticketmaster] grid load failed:', err);
    return; // leave original markup untouched on failure
  }
  if (!events.length) return;

  // All existing <li>s that actually hold a card (the heading <li> is kept).
  const oldCardLis = Array.from(ul.children).filter(li =>
    li.querySelector('a[class*="eventGridListItem__container"]'));

  const fragment = document.createDocumentFragment();
  events.forEach(ev => {
    const li = cardLi.cloneNode(true);
    const card = li.querySelector('a[class*="eventGridListItem__container"]');
    if (card) fillGridCard(card, ev);
    fragment.appendChild(li);
  });

  // Update the "N events near you" heading if present.
  const heading = ul.querySelector('h2, h3');
  if (heading && /event/i.test(heading.textContent)) {
    heading.textContent = `${events.length} event${events.length === 1 ? '' : 's'} near you`;
  }

  // Insert the live rows where the old ones were, then drop the old rows.
  if (oldCardLis.length) {
    ul.insertBefore(fragment, oldCardLis[0]);
    oldCardLis.forEach(li => li.remove());
  } else {
    ul.appendChild(fragment);
  }

  // Re-tag for the universal router (fticket already gets full data via URL)
  if (typeof tagEventCards === 'function') tagEventCards();
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
  const heading = Array.from(document.querySelectorAll('h2, h3'))
    .find(h => h.textContent.trim() === headingText);
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

function initLiveCarousels() {
  // Only act on the homepage (carousels present); other pages are skipped.
  if (!document.querySelector('[data-carousel-index]')) return;
  hideSkeletonLoaders(); // kill the frozen shimmer blocks under the carousel
  refreshCarousels();
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
  initLiveGrid();      // artist.html category grid
  initLiveCarousels(); // index.html homepage carousels
  wireLocationFilter(); // "Filter by location" combobox -> live city-scoped queries
});
