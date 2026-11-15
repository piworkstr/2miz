import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Şehir etkinlikleri: çiftin seçtiği ildeki konser, tiyatro, sinema, gösteri…
// Veri iki yerden gelir ve ikisi de config/ altında durur (okuma herkese, yazma yalnızca yöneticiye açık):
//   config/events_<il>     -> yönetim panelinden elle eklenenler (anlaşmalı mekan/organizatör, indirim notu olabilir)
//   config/eventsauto_<il> -> bilet sağlayıcısından otomatik çekilenler (scripts/etkinlik-cek.mjs, günde bir)
//   config/events          -> dizin: hangi ilde kaç etkinlik var (ana ekrandaki kart tek okumayla karar versin diye)
// Bu dosya panelde de kullanılır; expo/react-native içe aktarma.
export type EventCat = 'konser' | 'tiyatro' | 'standup' | 'sinema' | 'gosteri' | 'festival' | 'spor' | 'diger';
// icon: MaterialCommunityIcons adı (uygulamada liste ve takvimde aynı simge); emoji: metin satırlarında.
export const EVENT_CATS: Record<EventCat, { label: string; icon: string; emoji: string }> = {
  konser: { label: 'Konser', icon: 'microphone', emoji: '🎤' },
  tiyatro: { label: 'Tiyatro', icon: 'curtains', emoji: '🎭' },
  sinema: { label: 'Sinema', icon: 'filmstrip', emoji: '🎞️' },
  standup: { label: 'Stand-up', icon: 'microphone-variant', emoji: '🎙️' },
  gosteri: { label: 'Gösteri', icon: 'drama-masks', emoji: '🎪' },
  festival: { label: 'Festival', icon: 'party-popper', emoji: '🎉' },
  spor: { label: 'Spor', icon: 'soccer', emoji: '⚽' },
  diger: { label: 'Diğer', icon: 'star-four-points', emoji: '✨' },
};
// Etkinliksiz, düz date
export const DATE_ICON = { icon: 'glass-wine', emoji: '🍷' };

export type CityEvent = {
  id: string;
  title: string;
  day: string; // YYYY-MM-DD
  time?: string; // HH:MM
  venue?: string;
  cat: EventCat;
  url?: string; // bilet / ayrıntı sayfası
  price?: string; // serbest metin: "450 TL'den başlar"
  deal?: string; // 2miz çiftlerine özel: "İkinci bilet %50", "Kod: 2MIZ10"
  auto?: boolean; // otomatik çekildi (elle eklenenler üstte gösterilir)
};
export type CityDoc = { city: string; items: CityEvent[]; updatedAtMs: number };
export type EventIndex = { cities?: Record<string, { name: string; n?: number; auto?: number }> };

export const CITIES = [
  'Adana',
  'Adıyaman',
  'Afyonkarahisar',
  'Ağrı',
  'Aksaray',
  'Amasya',
  'Ankara',
  'Antalya',
  'Ardahan',
  'Artvin',
  'Aydın',
  'Balıkesir',
  'Bartın',
  'Batman',
  'Bayburt',
  'Bilecik',
  'Bingöl',
  'Bitlis',
  'Bolu',
  'Burdur',
  'Bursa',
  'Çanakkale',
  'Çankırı',
  'Çorum',
  'Denizli',
  'Diyarbakır',
  'Düzce',
  'Edirne',
  'Elazığ',
  'Erzincan',
  'Erzurum',
  'Eskişehir',
  'Gaziantep',
  'Giresun',
  'Gümüşhane',
  'Hakkari',
  'Hatay',
  'Iğdır',
  'Isparta',
  'İstanbul',
  'İzmir',
  'Kahramanmaraş',
  'Karabük',
  'Karaman',
  'Kars',
  'Kastamonu',
  'Kayseri',
  'Kilis',
  'Kırıkkale',
  'Kırklareli',
  'Kırşehir',
  'Kocaeli',
  'Konya',
  'Kütahya',
  'Malatya',
  'Manisa',
  'Mardin',
  'Mersin',
  'Muğla',
  'Muş',
  'Nevşehir',
  'Niğde',
  'Ordu',
  'Osmaniye',
  'Rize',
  'Sakarya',
  'Samsun',
  'Şanlıurfa',
  'Siirt',
  'Sinop',
  'Sivas',
  'Şırnak',
  'Tekirdağ',
  'Tokat',
  'Trabzon',
  'Tunceli',
  'Uşak',
  'Van',
  'Yalova',
  'Yozgat',
  'Zonguldak',
];

const TR: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  i: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  İ: 'i',
  I: 'i',
  Ç: 'c',
  Ğ: 'g',
  Ö: 'o',
  Ş: 's',
  Ü: 'u',
};
export const citySlug = (name: string) =>
  name
    .replace(/[çğıiöşüİIÇĞÖŞÜ]/g, (c) => TR[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const istToday = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const byWhen = (a: CityEvent, b: CityEvent) => (a.day + (a.time ?? '99')).localeCompare(b.day + (b.time ?? '99'));
export const upcoming = (items: CityEvent[], today = istToday()) => items.filter((e) => e.day >= today).sort(byWhen);

const manualRef = (city: string) => doc(db, 'config', `events_${citySlug(city)}`);
const autoRef = (city: string) => doc(db, 'config', `eventsauto_${citySlug(city)}`);
const indexRef = () => doc(db, 'config', 'events');

export async function loadIndex(): Promise<EventIndex> {
  const s = await getDoc(indexRef());
  return (s.data() as EventIndex | undefined) ?? {};
}

// Uygulama: seçili ilin yaklaşan etkinlikleri. Canlı dinleme yok; ekran açılınca iki okuma.
// Aynı etkinlik iki kaynakta da varsa (aynı gün, aynı başlık) elle eklenen kalır.
export async function loadCityEvents(city: string): Promise<CityEvent[]> {
  const [m, a] = await Promise.all([getDoc(manualRef(city)), getDoc(autoRef(city))]);
  const manual = ((m.data() as CityDoc | undefined)?.items ?? []).map((e) => ({ ...e, auto: false }));
  const key = (e: CityEvent) => `${e.day}|${e.title.trim().toLocaleLowerCase('tr-TR')}`;
  const seen = new Set(manual.map(key));
  const auto = ((a.data() as CityDoc | undefined)?.items ?? []).filter((e) => !seen.has(key(e))).map((e) => ({ ...e, auto: true }));
  return upcoming([...manual, ...auto]);
}

// ---------- Yönetim paneli ----------
export async function loadManual(city: string): Promise<CityEvent[]> {
  const s = await getDoc(manualRef(city));
  return ((s.data() as CityDoc | undefined)?.items ?? []).slice().sort(byWhen);
}

// Elle eklenen listeyi kaydeder; geçmiş etkinlikler (30 günden eski) temizlenir ve dizin güncellenir.
export async function saveManual(city: string, items: CityEvent[]) {
  const cut = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const clean = items
    .filter((e) => e.day >= cut && e.title.trim())
    .map((e) => {
      const out: CityEvent = { id: e.id, title: e.title.trim().slice(0, 90), day: e.day, cat: e.cat };
      if (e.time) out.time = e.time;
      if (e.venue?.trim()) out.venue = e.venue.trim().slice(0, 80);
      if (e.url?.trim()) out.url = e.url.trim();
      if (e.price?.trim()) out.price = e.price.trim().slice(0, 40);
      if (e.deal?.trim()) out.deal = e.deal.trim().slice(0, 80);
      return out;
    })
    .sort(byWhen);
  await setDoc(manualRef(city), { city, items: clean, updatedAtMs: Date.now() } satisfies CityDoc);
  await setDoc(indexRef(), { cities: { [citySlug(city)]: { name: city, n: upcoming(clean).length } } }, { merge: true });
  return clean;
}

export const newEventId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const safeUrl = (u?: string) => (u && /^https:\/\//i.test(u.trim()) ? u.trim() : null);
