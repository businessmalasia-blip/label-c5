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

async function fetchEvents({ segmentName = 'Music', size = 12 } = {}) {
  const params = new URLSearchParams({
    apikey: TM_API_KEY,
    segmentName,
    sort: 'date,asc',
    size: String(size),
  });
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

// ---------- 2. ADAPTER LAYER ----------
// Raw TM event -> flat object with exactly the fields our card markup needs.
function mapEventToCard(raw) {
  const venue = raw._embedded?.venues?.[0];
  const image = (raw.images || []).find(i => i.width >= 640) || raw.images?.[0];
  const price = raw.priceRanges?.[0]?.min;
  const currency = raw.priceRanges?.[0]?.currency || 'USD';
  return {
    id: raw.id,
    title: raw.name,
    date: raw.dates?.start?.localDate || '',
    time: raw.dates?.start?.localTime || '',
    venue: venue?.name || 'Venue TBA',
    city: venue?.city?.name || '',
    country: venue?.country?.name || '',
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
    price: ev.price ?? '',
    currency: ev.currency,
    img: ev.image,
  }).toString();
}

function setBdi(node, selectorText, value) {
  if (node) node.textContent = value;
}

// Clone the ORIGINAL viagogo grid card and inject live data into it.
function fillGridCard(templateNode, ev) {
  const card = templateNode.cloneNode(true);

  // Route + accessible title
  card.setAttribute('href', `fticket.html?${tmEventParams(ev)}`);
  card.setAttribute('title', ev.title);

  // Calendar block (month / day / weekday)
  const d = ev.date ? new Date(ev.date + 'T00:00:00') : null;
  if (d && !isNaN(d)) {
    setBdi(card.querySelector('.eventGridListItemCalendar__contentSecondary'), '', TM_MONTHS[d.getMonth()]);
    setBdi(card.querySelector('.eventGridListItemCalendar__contentPrimary'), '', String(d.getDate()));
    setBdi(card.querySelector('.eventGridListItemCalendar__chinContent'), '', TM_WEEKDAYS[d.getDay()]);
    const timeEl = card.querySelector('time');
    if (timeEl) timeEl.setAttribute('datetime', ev.date);
  }

  // Body: title, time, location, venue (the original card has several <bdi>s)
  const bdis = card.querySelectorAll('.eventGridListItemBody__container bdi');
  if (bdis[0]) bdis[0].textContent = ev.title;
  if (bdis[1]) bdis[1].textContent = ev.time ? ev.time.slice(0, 5) : 'Time TBA';
  if (bdis[2]) bdis[2].textContent = [ev.city, ev.country].filter(Boolean).join(', ');
  if (bdis[3]) bdis[3].textContent = ev.venue;
  if (bdis[4]) bdis[4].textContent = ev.venue;

  // Real poster from the TM CDN
  const img = card.querySelector('.eventGridListItemBody__container img, img[alt]');
  if (img && ev.image) { img.setAttribute('src', ev.image); img.setAttribute('alt', ev.title); }

  return card;
}

// Replace the static demo grid on artist.html with a live, category-driven one.
async function initLiveGrid() {
  const cards = document.querySelectorAll('a[class*="eventGridListItem__container"]');
  if (!cards.length) return; // not a grid page
  const template = cards[0];
  const container = template.parentElement;

  const category = new URLSearchParams(location.search).get('cat') || 'concert';
  let events;
  try {
    events = (await fetchEvents({ segmentName: TM_SEGMENTS[category] || 'Music', size: 12 }))
      .map(mapEventToCard)
      .filter(e => e.title);
  } catch (err) {
    console.error('[ticketmaster] grid load failed:', err);
    return; // leave original markup untouched on failure
  }
  if (!events.length) return;

  const fragment = document.createDocumentFragment();
  events.forEach(ev => fragment.appendChild(fillGridCard(template, ev)));
  container.replaceChildren(fragment);

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
    date: q.get('date') ? `${q.get('date')}T19:00:00` : new Date().toISOString(),
    time: 'See listings',
    currency: q.get('currency') === 'USD' ? '$' : (q.get('currency') || '$'),
    basePrice: Number.isFinite(price) && price > 0 ? price : 120,
    _live: true,
  };
}

document.addEventListener('DOMContentLoaded', initLiveGrid);
