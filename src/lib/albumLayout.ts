// Albüm sayfa düzeni (saf TypeScript): uygulamadaki önizleme ve Baskı Merkezi aynı kodu kullanır,
// böylece telefonda görülen albüm ile basılan albüm birebir aynıdır.
import type { AvatarData } from './avatarArt';
import { taskById } from './tasks';

export type AlbumSize = '21x21' | 'A4';
export type AlbumTheme = 'polaroid';

export type AlbumPhoto = {
  id: string;
  kind: 'task' | 'date' | 'moment';
  day: string; // YYYY-MM-DD
  uid: string;
  from?: string; // anıda fotoğrafı çeken
  taskId: string | null;
  note: string;
  src: string; // görsel adresi (önizlemede base64, baskıda yüksek çözünürlüklü dosya)
};

export type AlbumTrip = {
  id: string;
  name: string;
  place: string;
  start: string;
  end: string;
  photos: { id: string; uid: string; note: string; src: string }[];
};

export type AlbumPerson = { uid: string; name: string; avatar?: AvatarData; avatarHtml?: string }; // avatarHtml: çizgi avatar için hazır HTML (görseller çağıran tarafta çözülür)

export type AlbumInput = {
  people: [AlbumPerson, AlbumPerson]; // [sipariş veren, partner]
  startDate?: string; // birliktelik başlangıcı
  photos: AlbumPhoto[];
  trips: AlbumTrip[];
};

export type AlbumRange = { kind: 'period'; from: string; to: string } | { kind: 'trip'; tripId: string };

export type AlbumOptions = {
  size: AlbumSize;
  theme: AlbumTheme;
  range: AlbumRange;
  exclude: string[]; // çıkarılan sayfa kimlikleri
};

type Pol = { src: string; note: string; who: string };

export type AlbumPage =
  | { kind: 'opening'; id: 'opening' }
  | { kind: 'stats'; id: 'stats'; stats: AlbumStats }
  | { kind: 'task'; id: string; day: string; title: string; photos: Pol[] }
  | { kind: 'date'; id: string; day: string; photo: Pol }
  | { kind: 'moment'; id: string; day: string; photo: Pol }
  | { kind: 'tripCover'; id: string; name: string; place: string; start: string; end: string }
  | { kind: 'tripPhotos'; id: string; name: string; photos: Pol[] }
  | { kind: 'notes'; id: string }
  | { kind: 'end'; id: 'end' };

export type AlbumStats = { daysTogether: number | null; tasks: number; dates: number; moments: number; trips: number; photos: number };

export const PAGE_STEP = 4; // matbaa sayfaları 4'ün katı olarak basar
export const MIN_PAGES = 20;
export const MAX_PAGES = 100;
const TRIP_PER_PAGE = 4;

export type AlbumPlan = {
  pages: AlbumPage[];
  from: string;
  to: string;
  contentPages: number; // anı sayfaları
  fillers: number; // 4'ün katına tamamlamak için eklenen not sayfaları
  tooFew: boolean; // anı az, albüm çoğunlukla dolgu olur
  tooMany: boolean; // en fazla sayfa aşıldı, dönem kısaltılmalı
};

const daysBetween = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000) + 1;
};

export function buildAlbum(input: AlbumInput, opts: AlbumOptions): AlbumPlan {
  const [a, b] = input.people;
  const nameOf = (uid?: string) => (uid === a.uid ? a.name : uid === b.uid ? b.name : '');
  const trip = opts.range.kind === 'trip' ? input.trips.find((t) => t.id === (opts.range as { tripId: string }).tripId) : undefined;
  const from = opts.range.kind === 'trip' ? (trip?.start ?? '0000') : opts.range.from;
  const to = opts.range.kind === 'trip' ? (trip?.end ?? '9999') : opts.range.to;
  const inRange = (d: string) => d >= from && d <= to;

  // İçerik: tarih sırasına göre gün sayfaları, seyahatler başladıkları güne yerleşir.
  type Item = { day: string; order: number; pages: AlbumPage[] };
  const items: Item[] = [];

  if (opts.range.kind === 'period') {
    const byDay = new Map<string, AlbumPhoto[]>();
    for (const p of input.photos.filter((p) => inRange(p.day))) {
      if (p.kind === 'date') {
        items.push({
          day: p.day,
          order: 0,
          pages: [{ kind: 'date', id: `date-${p.day}`, day: p.day, photo: { src: p.src, note: p.note, who: '' } }],
        });
      } else if (p.kind === 'moment') {
        items.push({
          day: p.day,
          order: 2,
          pages: [{ kind: 'moment', id: `moment-${p.id}`, day: p.day, photo: { src: p.src, note: p.note, who: nameOf(p.from ?? p.uid) } }],
        });
      } else {
        byDay.set(p.day, [...(byDay.get(p.day) ?? []), p]);
      }
    }
    byDay.forEach((list, day) => {
      // Sipariş veren solda, partneri sağda; iki farklı görev varsa ikisi de yazılır.
      const sorted = [...list].sort((x, y) => (x.uid === a.uid ? -1 : y.uid === a.uid ? 1 : 0));
      const ids = [...new Set(sorted.map((p) => p.taskId).filter(Boolean))] as string[];
      const title = ids.map((id) => taskById(id).title).join(' · ');
      items.push({
        day,
        order: 1,
        pages: [
          { kind: 'task', id: `task-${day}`, day, title, photos: sorted.map((p) => ({ src: p.src, note: p.note, who: nameOf(p.uid) })) },
        ],
      });
    });
  }

  const trips = opts.range.kind === 'trip' ? (trip ? [trip] : []) : input.trips.filter((t) => t.start >= from && t.start <= to);
  for (const t of trips) {
    const pages: AlbumPage[] = [{ kind: 'tripCover', id: `trip-${t.id}`, name: t.name, place: t.place, start: t.start, end: t.end }];
    for (let i = 0; i < t.photos.length; i += TRIP_PER_PAGE) {
      pages.push({
        kind: 'tripPhotos',
        id: `tripph-${t.id}-${i / TRIP_PER_PAGE}`,
        name: t.name,
        photos: t.photos.slice(i, i + TRIP_PER_PAGE).map((p) => ({ src: p.src, note: p.note, who: nameOf(p.uid) })),
      });
    }
    items.push({ day: t.start, order: -1, pages });
  }

  items.sort((x, y) => (x.day === y.day ? x.order - y.order : x.day < y.day ? -1 : 1));
  const excluded = new Set(opts.exclude);
  const content = items.flatMap((i) => i.pages).filter((p) => !excluded.has(p.id));

  const stats: AlbumStats = {
    daysTogether: input.startDate ? daysBetween(input.startDate, to > '9000' ? from : to) : null,
    tasks: content.filter((p) => p.kind === 'task').length,
    dates: content.filter((p) => p.kind === 'date').length,
    moments: content.filter((p) => p.kind === 'moment').length,
    trips: content.filter((p) => p.kind === 'tripCover').length,
    photos: content.reduce(
      (n, p) => n + (p.kind === 'task' || p.kind === 'tripPhotos' ? p.photos.length : p.kind === 'date' || p.kind === 'moment' ? 1 : 0),
      0,
    ),
  };

  // Açılış + rakamlar + içerik + not sayfaları + kapanış; toplam 4'ün katı ve en az MIN_PAGES.
  const fixed = 3;
  let total = Math.max(MIN_PAGES, Math.ceil((content.length + fixed) / PAGE_STEP) * PAGE_STEP);
  const tooMany = total > MAX_PAGES;
  const body = tooMany ? content.slice(0, MAX_PAGES - fixed) : content;
  if (tooMany) total = MAX_PAGES;
  const fillers = total - fixed - body.length;
  const notes: AlbumPage[] = Array.from({ length: fillers }, (_, i) => ({ kind: 'notes', id: `notes-${i}` }));

  return {
    pages: [{ kind: 'opening', id: 'opening' }, { kind: 'stats', id: 'stats', stats }, ...body, ...notes, { kind: 'end', id: 'end' }],
    from,
    to,
    contentPages: body.length,
    fillers,
    tooFew: body.length < 8,
    tooMany,
  };
}
