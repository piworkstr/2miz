import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
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

// Firestore belgesi 1 MB; kural 900.000 karakter ister. Uzun kenar da sınırlanır (panorama), sığmazsa daha çok sıkıştırılır.
const MAX_B64 = 820_000;
// meta: kameradan/galeriden gelen piksel boyutu ve EXIF yönü. Bazı telefonlarda EXIF yönü işlenmeden kaydediliyor ve
// fotoğraf çerçevede yan duruyordu; yön uygulanmamışsa burada döndürülür (uygulanmışsa boyut oranı değişmiş olur, dokunulmaz).
export type PhotoMeta = { width?: number; height?: number; orientation?: number };
export async function shrink(uri: string, meta: PhotoMeta = {}): Promise<string> {
  const first = await ImageManipulator.manipulate(uri).resize({ width: PHOTO_WIDTH }).renderAsync();
  let rotate = 0;
  if (meta.width && meta.height && meta.orientation) {
    const applied = first.width > first.height !== meta.width > meta.height; // oran değiştiyse yön uygulanmış
    if (!applied) rotate = meta.orientation === 6 ? 90 : meta.orientation === 8 ? -90 : meta.orientation === 3 ? 180 : 0;
  }
  let ctx = ImageManipulator.manipulate(uri);
  if (rotate) ctx = ctx.rotate(rotate);
  // döndürme sonrası genişlik 720; uzun kenar 1,8 katı geçmesin
  const r1 = await ctx.resize({ width: PHOTO_WIDTH }).renderAsync();
  let rendered = r1;
  if (r1.height > PHOTO_WIDTH * 1.8) {
    let c2 = ImageManipulator.manipulate(uri);
    if (rotate) c2 = c2.rotate(rotate);
    rendered = await c2.resize({ height: PHOTO_WIDTH * 1.8 }).renderAsync();
  }
  let result = await rendered.saveAsync({ compress: 0.55, format: SaveFormat.JPEG, base64: true });
  if (result.base64 && result.base64.length > MAX_B64)
    result = await rendered.saveAsync({ compress: 0.3, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) throw new Error('Fotoğraf işlenemedi.');
  return result.base64;
}

// Profil fotoğrafı gibi küçük görseller için.
export async function shrinkTo(uri: string, width: number, compress = 0.6): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri).resize({ width }).renderAsync();
  const result = await rendered.saveAsync({ compress, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) throw new Error('Fotoğraf işlenemedi.');
  return result.base64;
}

export function photoUri(p: Pick<Photo, 'data'>) {
  return `data:image/jpeg;base64,${p.data}`;
}

export function photosCol(coupleId: string) {
  return collection(db, 'couples', coupleId, 'photos');
}

export async function saveTaskPhoto(coupleId: string, day: string, uid: string, taskId: string, note: string, data: string) {
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
