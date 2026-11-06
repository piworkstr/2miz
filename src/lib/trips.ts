import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';
import { shrink } from './photos';

// Seyahat albümleri: galeriden seçilen fotoğraflar. Anlık selfie kuralı görevlerde ve sohbette kalır.
// Fotoğraflar şimdilik Firestore'da; bu yüzden seyahat başına sınır var (premium'da yükselecek).
export const TRIP_LIMIT = 20;

export type Trip = {
  id: string;
  name: string;
  place: string;
  start: string; // YYYY-MM-DD
  end: string;
  createdBy: string;
  count: number;
  createdAtMs: number;
};

export type TripPhoto = {
  id: string;
  tripId: string;
  uid: string;
  note: string;
  data: string;
  createdAtMs: number;
};

const tripsCol = (coupleId: string) => collection(db, 'couples', coupleId, 'trips');
const tripPhotosCol = (coupleId: string) => collection(db, 'couples', coupleId, 'tripPhotos');

export function useTrips(coupleId: string | undefined) {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      tripsCol(coupleId),
      (snap) =>
        setTrips(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Trip, 'id'>) }))
            .sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : b.createdAtMs - a.createdAtMs)),
        ),
      () => setTrips([]),
    );
  }, [coupleId]);
  return trips;
}

export function useTrip(coupleId: string | undefined, id: string) {
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      doc(tripsCol(coupleId), id),
      (s) => setTrip(s.exists() ? { id: s.id, ...(s.data() as Omit<Trip, 'id'>) } : null),
      () => setTrip(null),
    );
  }, [coupleId, id]);
  return trip;
}

// Bir seyahatin fotoğrafları, eklenme sırasıyla. max verilirse kapak için ilk birkaç tanesi.
export function useTripPhotos(coupleId: string | undefined, tripId: string, max?: number) {
  const [photos, setPhotos] = useState<TripPhoto[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    const base = query(tripPhotosCol(coupleId), where('tripId', '==', tripId));
    return onSnapshot(
      max ? query(base, limit(max)) : base,
      (snap) =>
        setPhotos(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TripPhoto, 'id'>) })).sort((a, b) => a.createdAtMs - b.createdAtMs),
        ),
      () => setPhotos([]),
    );
  }, [coupleId, tripId, max]);
  return photos;
}

export async function createTrip(coupleId: string, uid: string, name: string, place: string, start: string, end: string) {
  const ref = await addDoc(tripsCol(coupleId), {
    name: name.trim().slice(0, 40),
    place: place.trim().slice(0, 40),
    start,
    end,
    createdBy: uid,
    count: 0,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Seçilen fotoğrafları küçültüp tek tek ekler; sınırı aşanlar eklenmez. Eklenen sayıyı döner.
export async function addTripPhotos(
  coupleId: string,
  trip: Trip,
  uid: string,
  uris: string[],
  onProgress?: (done: number) => void,
) {
  const room = Math.max(0, TRIP_LIMIT - trip.count);
  const list = uris.slice(0, room);
  let done = 0;
  for (const uri of list) {
    const data = await shrink(uri);
    await addDoc(tripPhotosCol(coupleId), { tripId: trip.id, uid, note: '', data, createdAtMs: Date.now(), createdAt: serverTimestamp() });
    await updateDoc(doc(tripsCol(coupleId), trip.id), { count: increment(1) });
    done++;
    onProgress?.(done);
  }
  return done;
}

export async function setTripPhotoNote(coupleId: string, id: string, note: string) {
  await updateDoc(doc(tripPhotosCol(coupleId), id), { note: note.trim().slice(0, 80) });
}

export async function deleteTripPhoto(coupleId: string, photo: TripPhoto) {
  await deleteDoc(doc(tripPhotosCol(coupleId), photo.id));
  await updateDoc(doc(tripsCol(coupleId), photo.tripId), { count: increment(-1) }).catch(() => {});
}

export async function deleteTrip(coupleId: string, tripId: string) {
  const snap = await getDocs(query(tripPhotosCol(coupleId), where('tripId', '==', tripId)));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(tripsCol(coupleId), tripId));
  await batch.commit();
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
// "12–18 Ağu 2026", "28 Tem – 3 Ağu 2026"
export function tripDates(t: Pick<Trip, 'start' | 'end'>) {
  const [y1, m1, d1] = t.start.split('-').map(Number);
  const [y2, m2, d2] = t.end.split('-').map(Number);
  if (t.start === t.end) return `${d1} ${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTHS[m1 - 1]} ${y1}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y1}`;
  return `${d1} ${MONTHS[m1 - 1]} ${y1} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}
