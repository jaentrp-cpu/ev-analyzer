export const DEFAULT_PUBLIC_NEWS = [
  {
    id: 'liiga-season-2026-27',
    tag: 'tapahtuma',
    publishedOn: '2026-09-03',
    when: '1.9.2026',
    title: 'Liigan kausi 2026–27 käynnistyi',
    body: 'Liigan runkosarja käynnistyi 1.9. Sarja kuuluu Vedoxin liigavalikoimaan ja voidaan aktivoida hallinnasta.',
  },
  {
    id: 'khl-season-2026-27',
    tag: 'tapahtuma',
    publishedOn: '2026-09-03',
    when: '5.9.2026',
    title: 'KHL-kausi alkaa 5. syyskuuta',
    body: 'KHL:n runkosarja käynnistyy 5.9. kuudella ottelulla. Sarja kuuluu Vedoxin liigavalikoimaan ja voidaan aktivoida hallinnasta.',
  },
  {
    id: 'champions-league-phase-2026-27',
    tag: 'tapahtuma',
    publishedOn: '2026-09-03',
    when: '8.–10.9.2026',
    title: 'Mestarien liigan liigavaihe käynnistyy',
    body: 'Mestarien liigan liigavaihe alkaa 8.9. ja ensimmäinen ottelukierros pelataan 8.–10.9. Kilpailu kuuluu Vedoxin liigavalikoimaan.',
  },
  {
    id: 'nhl-season-2026-27',
    tag: 'tapahtuma',
    publishedOn: '2026-09-03',
    when: '29.9.2026',
    title: 'NHL:n runkosarja alkaa 29. syyskuuta',
    body: 'NHL:n kausi 2026–27 käynnistyy 29.9. Sarja kuuluu Vedoxin liigavalikoimaan ja voidaan aktivoida hallinnasta.',
  },
];

export const DEFAULT_PUBLIC_EVENTS = [
  {
    id: 'evt-austria-scotland-2026',
    startsOn: '2026-07-31',
    displayUntil: '2026-08-14',
    title: 'Itävallan Bundesliga & Scottish Premiership',
    summary: 'Sarjakaudet alkavat 31.7. Kilpailut ovat Vedoxin liigavalikoimassa ja hallinnasta aktivoitavissa.',
    sources: [
      { label: 'Bundesliga Austria', url: 'https://www.bundesliga.at/de/news/artikel/admiral-bundesliga-spielplan-fuer-den-grunddurchgang-2026-27' },
      { label: 'SPFL', url: 'https://spfl.co.uk/news/spfl-fixtures-for-202627' },
    ],
  },
  {
    id: 'evt-canadian-open-2026',
    startsOn: '2026-08-02',
    displayUntil: '2026-08-13',
    title: 'ATP & WTA Canadian Open',
    summary: 'Turnaukset pelataan 2.–13.8. ja ovat Vedoxin turnausvalikoimassa hallinnasta aktivoitavina.',
    sources: [
      { label: 'ATP', url: 'https://www.atptour.com/en/tournaments/toronto-wct/421/overview' },
      { label: 'WTA', url: 'https://www.wtatennis.com/tournaments/806/montreal/2026' },
    ],
  },
  {
    id: 'evt-nfl-preseason-2026',
    startsOn: '2026-08-06',
    displayUntil: '2026-08-31',
    title: 'NFL preseason',
    summary: 'Harjoituskausi alkaa 6.8. NFL kuuluu Vedoxin lajivalikoimaan ja voidaan aktivoida hallinnasta.',
    sources: [
      { label: 'NFL', url: 'https://www.nfl.com/news/2026-nfl-preseason-complete-team-by-team-opponents' },
    ],
  },
  {
    id: 'evt-carabao-cup-2026',
    startsOn: '2026-08-07',
    displayUntil: '2026-08-09',
    title: 'Carabao Cup · 1. kierros',
    summary: 'Ensimmäinen kierros pelataan 7.–9.8. Kilpailu on Vedoxin valikoimassa tai hallinnasta aktivoitavissa.',
    sources: [
      { label: 'EFL', url: 'https://www.efl.com/news/2026/january/12/efl-kick-off-dates-confirmed-for-2026-27-season/' },
    ],
  },
  {
    id: 'evt-efl-leagues-2026',
    startsOn: '2026-08-14',
    displayUntil: '2026-08-28',
    title: 'EFL Championship, League One & League Two',
    summary: 'Sarjojen avausviikonloppu on 14.–16.8. Liigat ovat Vedoxin valikoimassa tai hallinnasta aktivoitavissa.',
    sources: [
      { label: 'EFL', url: 'https://www.efl.com/news/2026/january/12/efl-kick-off-dates-confirmed-for-2026-27-season/' },
    ],
  },
  {
    id: 'evt-premier-league-2026',
    startsOn: '2026-08-21',
    displayUntil: '2026-09-04',
    title: 'Premier League',
    summary: 'Kauden avauskierros alkaa 21.8. Liiga on Vedoxin valikoimassa tai hallinnasta aktivoitavissa.',
    sources: [
      { label: 'Premier League', url: 'https://www.premierleague.com/en/news/4468487/dates-for-202627-premier-league-season-confirmed' },
    ],
  },
];

export const PUBLIC_NEWS = DEFAULT_PUBLIC_NEWS;
export const PUBLIC_EVENTS = DEFAULT_PUBLIC_EVENTS;

const PUBLIC_CONTENT_ENDPOINT = import.meta.env?.VITE_PUBLIC_CONTENT_URL || '/public/content';

function parseLocalCalendarDate(value, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  if (
    Number.isNaN(date.getTime())
    || date.getFullYear() !== Number(year)
    || date.getMonth() !== Number(month) - 1
    || date.getDate() !== Number(day)
  ) return null;
  return date;
}

function normalizeNews(items) {
  if (!Array.isArray(items)) return DEFAULT_PUBLIC_NEWS;
  const valid = items.filter(item =>
    item
    && item.active !== false
    && parseLocalCalendarDate(item.publishedOn)
    && item.title
    && item.body
  );
  return valid.length ? valid : DEFAULT_PUBLIC_NEWS;
}

function normalizeEvents(items) {
  if (!Array.isArray(items)) return DEFAULT_PUBLIC_EVENTS;
  const valid = items.filter(item => {
    if (!item || item.active === false || !item.title) return false;
    const startsAt = parseLocalCalendarDate(item.startsOn);
    const displayUntilAt = parseLocalCalendarDate(item.displayUntil, true);
    return startsAt && displayUntilAt && displayUntilAt >= startsAt;
  });
  return valid.length ? valid : DEFAULT_PUBLIC_EVENTS;
}

export function preparePublicEvents(items, now = new Date()) {
  const current = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return normalizeEvents(items)
    .map(item => ({
      ...item,
      startsAt: parseLocalCalendarDate(item.startsOn),
      displayUntilAt: parseLocalCalendarDate(item.displayUntil, true),
    }))
    .filter(item => item.startsAt && item.displayUntilAt && item.displayUntilAt >= current)
    .sort((a, b) => a.startsAt - b.startsAt)
    .map(item => ({
      ...item,
      status: current < item.startsAt ? 'Tulossa' : 'Käynnissä',
    }));
}

export async function fetchPublicContent() {
  try {
    const res = await fetch(`${PUBLIC_CONTENT_ENDPOINT}?t=${Date.now()}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      news: normalizeNews(data.news || data.items),
      events: normalizeEvents(data.events),
      source: data.source || 'runtime',
    };
  } catch (error) {
    console.warn('[Vedox] public content fallback:', error.message);
    return { news: DEFAULT_PUBLIC_NEWS, events: DEFAULT_PUBLIC_EVENTS, source: 'fallback' };
  }
}
