// etkinlikler/<il>.json dosyalarındaki elle derlenmiş etkinlikleri Firestore'a yazar (config/events_<il> + dizin).
// Panelden eklenenlere dokunmaz: bu dosyadan gelenlerin kimliği "w_" ile başlar ve her çalıştırmada yenilenir.
// Gerekli ortam değişkeni: FIREBASE_SERVICE_ACCOUNT. Ayrıntı: etkinlikler/README.md
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const SA = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!SA) {
  console.error('FIREBASE_SERVICE_ACCOUNT yok.');
  process.exit(1);
}
const TR = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i', I: 'i', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };
// src/lib/events.ts içindeki citySlug ile aynı olmalı.
const slug = (s) =>
  s
    .replace(/[çğıiöşüİIÇĞÖŞÜ]/g, (c) => TR[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const CATS = ['konser', 'tiyatro', 'standup', 'sinema', 'gosteri', 'festival', 'spor', 'diger'];
const today = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const keyOf = (e) => `${e.day}|${String(e.title).trim().toLocaleLowerCase('tr-TR')}`;
const byWhen = (a, b) => (a.day + (a.time ?? '99')).localeCompare(b.day + (b.time ?? '99'));

initializeApp({ credential: cert(JSON.parse(SA)) });
const db = getFirestore();
const dir = new URL('../etkinlikler/', import.meta.url);
let bad = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const file = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
  if (f === 'filmler.json') {
    // Vizyondaki filmler: bütün iller için tek liste.
    const films = (file.items ?? [])
      .filter((x) => x.title)
      .map((x) => {
        const out = { id: 'f_' + createHash('sha1').update(String(x.title).trim().toLocaleLowerCase('tr-TR')).digest('hex').slice(0, 10), title: String(x.title).trim().slice(0, 90) };
        if (x.genre) out.genre = String(x.genre).trim().slice(0, 50);
        if (/^\d{4}-\d{2}-\d{2}$/.test(x.since ?? '')) out.since = x.since;
        return out;
      })
      .slice(0, 40);
    await db.doc('config/films').set({ items: films, updatedAtMs: Date.now() });
    await db.doc('config/events').set({ films: films.length }, { merge: true });
    console.log(`Filmler: ${films.length}`);
    continue;
  }
  const city = String(file.city ?? '').trim();
  if (!city) {
    console.error(`${f}: "city" yok, atlandı.`);
    bad++;
    continue;
  }
  const ref = db.doc(`config/events_${slug(city)}`);
  const kept = ((await ref.get()).data()?.items ?? []).filter((e) => !String(e.id).startsWith('w_') && e.day >= today);
  const seen = new Set(kept.map(keyOf));
  const fresh = [];
  for (const e of file.items ?? []) {
    const okDay = /^\d{4}-\d{2}-\d{2}$/.test(e.day ?? '');
    if (!e.title || !okDay || !CATS.includes(e.cat)) {
      console.error(`${f}: geçersiz kayıt atlandı: ${JSON.stringify(e).slice(0, 120)}`);
      bad++;
      continue;
    }
    if (e.day < today || seen.has(keyOf(e))) continue;
    seen.add(keyOf(e));
    const out = { id: 'w_' + createHash('sha1').update(keyOf(e)).digest('hex').slice(0, 10), title: String(e.title).trim().slice(0, 90), day: e.day, cat: e.cat };
    if (/^\d{2}:\d{2}$/.test(e.time ?? '')) out.time = e.time;
    if (e.venue) out.venue = String(e.venue).trim().slice(0, 80);
    if (typeof e.url === 'string' && /^https:\/\//i.test(e.url)) out.url = e.url.trim();
    if (e.price) out.price = String(e.price).trim().slice(0, 40);
    if (e.deal) out.deal = String(e.deal).trim().slice(0, 80);
    fresh.push(out);
  }
  const items = [...kept, ...fresh].sort(byWhen);
  await ref.set({ city, items, updatedAtMs: Date.now() });
  await db.doc('config/events').set({ cities: { [slug(city)]: { name: city, n: items.length } } }, { merge: true });
  console.log(`${city}: ${kept.length} panelden + ${fresh.length} dosyadan = ${items.length}`);
}
if (bad) process.exitCode = 1;
