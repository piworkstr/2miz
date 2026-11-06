import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey } from './date';
import { db } from './firebase';
import { photosCol as albumCol } from './photos';
import { useSession } from './session';

// Mesajlar sadece eşleşmiş iki kişi arasında. Fotoğrafın kendisi ayrı bir belgede tutulur,
// böylece mesaj listesi (ve okunmamış rozeti) büyük fotoğraf verisi indirmeden hızlı yüklenir.
export type Message = {
  id: string;
  from: string;
  text: string;
  hasPhoto: boolean;
  createdAtMs: number;
  hiddenFor?: Record<string, boolean>; // şikayet edenin ekranından kalkar
  inAlbum?: boolean;
};

function messagesCol(coupleId: string) {
  return collection(db, 'couples', coupleId, 'messages');
}
function photosCol(coupleId: string) {
  return collection(db, 'couples', coupleId, 'messagePhotos');
}

export function useMessages(coupleId: string | undefined, max = 150) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      query(messagesCol(coupleId), orderBy('createdAtMs', 'desc'), limit(max)),
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }))),
      () => setMessages([]),
    );
  }, [coupleId, max]);
  return messages;
}

export async function sendMessage(coupleId: string, from: string, text: string, photo: string | null) {
  const ref = await addDoc(messagesCol(coupleId), {
    from,
    text: text.trim(),
    hasPhoto: !!photo,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
  });
  if (photo) await setDoc(doc(photosCol(coupleId), ref.id), { from, data: photo });
}

export async function deleteMessage(coupleId: string, id: string, hasPhoto: boolean) {
  if (hasPhoto) await deleteDoc(doc(photosCol(coupleId), id)).catch(() => {});
  await deleteDoc(doc(messagesCol(coupleId), id));
}

// Fotoğraf verisini sadece ekranda gösterilecekken indirir ve bellekte tutar.
const cache = new Map<string, string>();
export function useMessagePhoto(coupleId: string, id: string, enabled: boolean) {
  const [data, setData] = useState<string | null>(cache.get(id) ?? null);
  useEffect(() => {
    if (!enabled || cache.has(id)) return;
    let alive = true;
    getDoc(doc(photosCol(coupleId), id))
      .then((s) => {
        const d = (s.data() as { data?: string } | undefined)?.data;
        if (d) {
          cache.set(id, d);
          if (alive) setData(d);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [coupleId, id, enabled]);
  return data;
}

async function photoData(coupleId: string, id: string) {
  if (cache.has(id)) return cache.get(id)!;
  const d = (await getDoc(doc(photosCol(coupleId), id))).data() as { data?: string } | undefined;
  if (!d?.data) throw new Error('Fotoğraf bulunamadı.');
  return d.data;
}

// Mesajdaki fotoğraf albüme ayrı bir kopya olarak eklenir; mesaj silinse de albümde kalır.
export const momentId = (messageId: string) => `moment_${messageId}`;

export async function addToAlbum(coupleId: string, msg: Message, uid: string, note: string) {
  const data = await photoData(coupleId, msg.id);
  await setDoc(doc(albumCol(coupleId), momentId(msg.id)), {
    kind: 'moment',
    day: dayKey(new Date(msg.createdAtMs)),
    uid,
    from: msg.from,
    messageId: msg.id,
    taskId: null,
    note: note.trim().slice(0, 80),
    data,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(messagesCol(coupleId), msg.id), { inAlbum: true }).catch(() => {});
}

export async function removeFromAlbum(coupleId: string, messageId: string) {
  await deleteDoc(doc(albumCol(coupleId), momentId(messageId)));
  await updateDoc(doc(messagesCol(coupleId), messageId), { inAlbum: false }).catch(() => {});
}

// Şikayet: mesaj şikayet edenin ekranından kalkar ve inceleme için ayrı bir kayda yazılır.
export async function reportMessage(coupleId: string, msg: Message, reporter: string, reason: string) {
  await addDoc(collection(db, 'reports'), {
    coupleId,
    messageId: msg.id,
    reportedUser: msg.from,
    reporter,
    reason,
    text: msg.text.slice(0, 500),
    hasPhoto: msg.hasPhoto,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(messagesCol(coupleId), msg.id), { [`hiddenFor.${reporter}`]: true });
}

export async function markRead(coupleId: string, uid: string) {
  await updateDoc(doc(db, 'couples', coupleId), { [`lastRead.${uid}`]: Date.now() }).catch(() => {});
}

// Sekmedeki rozet: partnerden gelen, en son okumadan sonraki mesajlar.
export function useUnreadCount() {
  const { user, couple, partnerId } = useSession();
  const [latest, setLatest] = useState<Message[]>([]);
  useEffect(() => {
    if (!couple?.id) return;
    return onSnapshot(
      query(messagesCol(couple.id), orderBy('createdAtMs', 'desc'), limit(20)),
      (snap) => setLatest(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>) }))),
      () => setLatest([]),
    );
  }, [couple?.id]);
  if (!user || !partnerId) return 0;
  const lastRead = (couple?.lastRead ?? {})[user.uid] ?? 0;
  return latest.filter((m) => m.from === partnerId && m.createdAtMs > lastRead).length;
}
