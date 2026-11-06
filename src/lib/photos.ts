import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from './firebase';

// Fotoğraflar şimdilik küçültülüp sıkıştırılarak Firestore'da saklanır (~40-60 KB).
// Böylece Firebase'in ücretsiz planında kalırız. Kullanıcı sayısı artınca
// Firebase Storage'a taşınacak (bkz. YOL_HARITASI.md).
export type Photo = {
  id: string;
  kind: 'task' | 'date' | 'moment'; // moment: mesajlardan albüme eklenen anı
  day: string; // YYYY-MM-DD
  uid: string; // albüme ekleyen (görevde fotoğrafı çeken)
  from?: string; // anıda fotoğrafı çeken
  messageId?: string;
  taskId: string | null;
  note: string;
  data: string; // base64 JPEG
};

export const PHOTO_WIDTH = 720;

export async function shrink(uri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: PHOTO_WIDTH }).renderAsync();
  const result = await rendered.saveAsync({ compress: 0.55, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) throw new Error('Fotoğraf işlenemedi.');
  return result.base64;
}

export function photoUri(p: Pick<Photo, 'data'>) {
  return `data:image/jpeg;base64,${p.data}`;
}

export function photosCol(coupleId: string) {
  return collection(db, 'couples', coupleId, 'photos');
}

export async function saveTaskPhoto(
  coupleId: string,
  day: string,
  uid: string,
  taskId: string,
  note: string,
  data: string,
) {
  await setDoc(doc(photosCol(coupleId), `${day}_${uid}`), {
    kind: 'task',
    day,
    uid,
    taskId,
    note: note.trim(),
    data,
    createdAt: serverTimestamp(),
  });
}

export async function saveDatePhoto(coupleId: string, day: string, uid: string, note: string, data: string) {
  await setDoc(doc(photosCol(coupleId), `${day}_date`), {
    kind: 'date',
    day,
    uid,
    taskId: null,
    note: note.trim(),
    data,
    createdAt: serverTimestamp(),
  });
}

// Albüm için son fotoğraflar, en yeni gün en üstte.
export function usePhotos(coupleId: string | undefined, max = 90) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    const q = query(photosCol(coupleId), orderBy('day', 'desc'), limit(max));
    return onSnapshot(
      q,
      (snap) => setPhotos(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Photo, 'id'>) }))),
      () => setPhotos([]),
    );
  }, [coupleId, max]);
  return photos;
}
