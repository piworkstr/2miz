import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import type { AlbumInput, AlbumOptions, AlbumPerson, AlbumPhoto, AlbumTrip } from './albumLayout';
import type { Photo } from './photos';
import type { Trip, TripPhoto } from './trips';

// Uygulamada albüm önizlemesi için verileri toplar (fotoğraflar telefondaki küçük kopyalar).
// Baskı Merkezi aynı yapıyı kendi tarafında, yönetici yetkisiyle toplar.
export async function loadAlbumInput(
  coupleId: string,
  people: [AlbumPerson, AlbumPerson],
  startDate: string | undefined,
  from: string,
  to: string,
  onlyTripId?: string,
): Promise<AlbumInput> {
  const col = (name: string) => collection(db, 'couples', coupleId, name);
  const src = (data: string) => `data:image/jpeg;base64,${data}`;

  const photos: AlbumPhoto[] = onlyTripId
    ? []
    : (await getDocs(query(col('photos'), where('day', '>=', from), where('day', '<=', to)))).docs.map((d) => {
        const p = d.data() as Omit<Photo, 'id'>;
        return { id: d.id, kind: p.kind, day: p.day, uid: p.uid, from: p.from, taskId: p.taskId, note: p.note ?? '', src: src(p.data) };
      });

  const tripDocs = (await getDocs(col('trips'))).docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Trip, 'id'>) }))
    .filter((t) => (onlyTripId ? t.id === onlyTripId : t.start >= from && t.start <= to));

  const trips: AlbumTrip[] = [];
  for (const t of tripDocs) {
    const snap = await getDocs(query(col('tripPhotos'), where('tripId', '==', t.id)));
    const list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<TripPhoto, 'id'>) }))
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map((p) => ({ id: p.id, uid: p.uid, note: p.note ?? '', src: src(p.data) }));
    trips.push({ id: t.id, name: t.name, place: t.place, start: t.start, end: t.end, photos: list });
  }
  return { people, startDate, photos, trips };
}

// Baskı talebi: sadece seçimler kaydedilir; baskı dosyası bizim Baskı Merkezi'mizde üretilir.
export async function saveAlbumRequest(coupleId: string, uid: string, opts: AlbumOptions, pageCount: number) {
  await addDoc(collection(db, 'couples', coupleId, 'albumOrders'), {
    by: uid,
    size: opts.size,
    theme: opts.theme,
    range: opts.range,
    exclude: opts.exclude,
    pageCount,
    status: 'talep',
    createdAtMs: Date.now(),
  });
}
