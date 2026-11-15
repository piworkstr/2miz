// Şehir etkinliklerini bilet sağlayıcısından (Ticketmaster Discovery API, Türkiye = Biletix) çeker ve
// Firestore'da config/eventsauto_<il> belgelerine yazar. GitHub Actions günde bir çalıştırır (.github/workflows/etkinlik.yml).
// Gerekli ortam değişkenleri: TICKETMASTER_KEY (Discovery API anahtarı), FIREBASE_SERVICE_ACCOUNT (hizmet hesabı JSON'u).
// Günlük en çok 5 istek atar (ücretsiz kota: günde 5000, saniyede 2).
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const KEY = process.env.TICKETMASTER_KEY;
const SA = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!KEY || !SA) {
  console.log('TICKETMASTER_KEY ya da FIREBASE_SERVICE_ACCOUNT yok; atlandı.');
  process.exit(0);
}

const CITIES = `Adana,Adıyaman,Afyonkarahisar,Ağrı,Aksaray,Amasya,Ankara,Antalya,Ardahan,Artvin,Aydın,Balıkesir,Bartın,Batman,Bayburt,Bilecik,Bingöl,Bitlis,Bolu,Burdur,Bursa,Çanakkale,Çankırı,Çorum,Denizli,Diyarbakır,Düzce,Edirne,Elazığ,Erzincan,Erzurum,Eskişehir,Gaziantep,Giresun,Gümüşhane,Hakkari,Hatay,Iğdır,Isparta,İstanbul,İzmir,Kahramanmaraş,Karabük,Karaman,Kars,Kastamonu,Kayseri,Kilis,Kırıkkale,Kırklareli,Kırşehir,Kocaeli,Konya,Kütahya,Malatya,Manisa,Mardin,Mersin,Muğla,Muş,Nevşehir,Niğde,Ordu,Osmaniye,Rize,Sakarya,Samsun,Şanlıurfa,Siirt,Sinop,Sivas,Şırnak,Tekirdağ,Tokat,Trabzon,Tunceli,Uşak,Van,Yalova,Yozgat,Zonguldak`.split(',');
const TR = { ç: 'c', ğ: 'g', ı: 'i', i: 'i', ö: 'o', ş: 's', ü: 'u', İ: 'i', I: 'i', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };
// src/lib/events.ts içindeki citySlug ile aynı olmalı.
const slug = (s) =>
  s
    .replace(/[çğıiöşüİIÇĞÖŞÜ]/g, (c) => TR[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const bySlug = Object.fromEntries(CITIES.map((c) => [slug(c), c]));
// Sağlayıcının kullandığı farklı yazımlar
const ALIAS = { izmit: 'kocaeli', adapazari: 'sakarya', antakya: 'hatay', bodrum: 'mugla', marmaris: 'mugla', fethiye: 'mugla', alanya: 'antalya', cesme: 'izmir', urfa: 'sanliurfa', maras: 'kahramanmaras', afyon: 'afyonkarahisar' };

const catOf = (ev) => {
  const c = ev.classifications?.[0] ?? {};
  const seg = (c.segment?.name ?? '').toLowerCase();
  const genre = (c.genre?.name ?? '').toLowerCase();
  if (seg.includes('music')) return genre.includes('festival') ? 'festival' : 'konser';
  if (seg.includes('sport')) return 'spor';
  if (seg.includes('film')) return 'sinema';
  if (seg.includes('arts')) return /comedy|stand/.test(genre) ? 'standup' : /variety|magic|circus|dance/.test(genre) ? 'gosteri' : 'tiyatro';
  return 'diger';
};

const iso = (d) => d.toISOString().slice(0, 19) + 'Z';
const from = new Date();
const to = new Date(Date.now() + 62 * 86400000);
const all = [];
for (let page = 0; page < 5; page++) {
  const q = new URLSearchParams({
    apikey: KEY,
    countryCode: 'TR',
    size: '200',
    page: String(page),
    sort: 'date,asc',
    startDateTime: iso(from),
    endDateTime: iso(to),
  });
  const r = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${q}`);
  if (!r.ok) {
    console.error(`İstek başarısız: ${r.status} ${(await r.text()).slice(0, 200)}`);
    process.exit(page === 0 ? 1 : 0);
  }
  const j = await r.json();
  const evs = j._embedded?.events ?? [];
  all.push(...evs);
  if (page + 1 >= (j.page?.totalPages ?? 1)) break;
  await new Promise((res) => setTimeout(res, 700));
}
console.log(`${all.length} etkinlik geldi.`);

const byCity = {};
const unknown = {};
for (const ev of all) {
  const v = ev._embedded?.venues?.[0];
  const day = ev.dates?.start?.localDate;
  if (!v?.city?.name || !day || !ev.name) continue;
  if (ev.dates?.status?.code && ev.dates.status.code !== 'onsale' && ev.dates.status.code !== 'rescheduled') continue;
  let s = slug(v.city.name);
  s = ALIAS[s] ?? s;
  if (!bySlug[s]) {
    unknown[v.city.name] = (unknown[v.city.name] ?? 0) + 1;
    continue;
  }
  const item = { id: `tm_${ev.id}`, title: String(ev.name).slice(0, 90), day, cat: catOf(ev) };
  const time = ev.dates?.start?.localTime;
  if (time && !ev.dates?.start?.noSpecificTime) item.time = time.slice(0, 5);
  if (v.name) item.venue = String(v.name).slice(0, 80);
  if (typeof ev.url === 'string' && ev.url.startsWith('https://')) item.url = ev.url;
  const p = ev.priceRanges?.[0];
  if (p?.min && p.currency === 'TRY') item.price = `${Math.round(p.min)} TL'den başlar`;
  (byCity[s] ??= []).push(item);
}
if (Object.keys(unknown).length) console.log('Eşleşmeyen şehirler:', JSON.stringify(unknown));

initializeApp({ credential: cert(JSON.parse(SA)) });
const db = getFirestore();
const index = (await db.doc('config/events').get()).data() ?? {};
const batch = db.batch();
const cities = {};
// Artık etkinliği kalmayan illerin otomatik listesini boşalt.
for (const [s, c] of Object.entries(index.cities ?? {})) {
  if ((c.auto ?? 0) > 0 && !byCity[s]) {
    batch.set(db.doc(`config/eventsauto_${s}`), { city: c.name, items: [], updatedAtMs: Date.now() });
    cities[s] = { auto: 0 };
  }
}
for (const [s, items] of Object.entries(byCity)) {
  // Aynı gösterinin aynı gündeki tekrarlarını tekle; il başına en çok 150.
  const seen = new Set();
  const uniq = items.filter((e) => {
    const k = `${e.day}|${e.time ?? ''}|${e.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  batch.set(db.doc(`config/eventsauto_${s}`), { city: bySlug[s], items: uniq.slice(0, 150), updatedAtMs: Date.now() });
  cities[s] = { name: bySlug[s], auto: Math.min(uniq.length, 150) };
  console.log(`${bySlug[s]}: ${uniq.length}`);
}
batch.set(db.doc('config/events'), { cities }, { merge: true });
await batch.commit();
console.log('Yazıldı.');
