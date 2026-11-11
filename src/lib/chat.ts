import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import * as FS from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import { dayKey } from './date';
import { db } from './firebase';
import { logActivity } from './bond';
import { notifyPartner } from './push';
import { photosCol as albumCol } from './photos';
import { useSession } from './session';

// Mesajlar sadece eşleşmiş iki kişi arasında. Fotoğrafın kendisi ayrı bir belgede tutulur,
// böylece mesaj listesi (ve okunmamış rozeti) büyük fotoğraf verisi indirmeden hızlı yüklenir.
export type Message = {
  id: string;
  from: string;
  text: string;
  hasPhoto: boolean;
  audioMs?: number; // sesli mesajsa süresi
  createdAtMs: number;
  hiddenFor?: Record<string, boolean>; // şikayet edenin ekranından kalkar
  inAlbum?: boolean;
  reactions?: Record<string, string>; // kişi başı bir emoji
  pending?: boolean; // henüz sunucuya ulaşmadı (sadece gönderenin ekranında)
};

function messagesCol(coupleId: string) {
  return collection(db, 'couples', coupleId, 'messages');
}
function photosCol(coupleId: string) {
  return collection(db, 'couples', coupleId, 'messagePhotos');
}
function audioCol(coupleId: string) {
  return collection(db, 'couples', coupleId, 'messageAudio');
}

export function useMessages(coupleId: string | undefined, max = 150) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    return onSnapshot(
      query(messagesCol(coupleId), orderBy('createdAtMs', 'desc'), limit(max)),
      { includeMetadataChanges: true },
      (snap) =>
        setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Message, 'id'>), pending: d.metadata.hasPendingWrites }))),
      () => setMessages([]),
    );
  }, [coupleId, max]);
  return messages;
}

// notify: partnere bildirim (uygulama kapalıyken de gelir).
export async function sendMessage(
  coupleId: string,
  from: string,
  text: string,
  photo: string | null,
  notify?: { to: string | null; fromName: string },
) {
  // Önce fotoğraf yüklenir, mesaj sonra yazılır: karşı taraf mesajı gördüğünde fotoğraf hazırdır.
  const ref = doc(messagesCol(coupleId));
  if (photo) await setDoc(doc(photosCol(coupleId), ref.id), { from, data: photo });
  await setDoc(ref, {
    from,
    text: text.trim(),
    hasPhoto: !!photo,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
  });
  logActivity(coupleId, from, photo ? 'photo' : 'message');
  if (notify?.to)
    notifyPartner(notify.to, notify.fromName, photo ? '📷 Anlık fotoğraf gönderdi' : text.trim(), { type: 'message', url: '/chat' });
}

export async function deleteMessage(coupleId: string, m: Pick<Message, 'id' | 'hasPhoto' | 'audioMs'>) {
  if (m.hasPhoto) await deleteDoc(doc(photosCol(coupleId), m.id)).catch(() => {});
  if (m.audioMs) await deleteDoc(doc(audioCol(coupleId), m.id)).catch(() => {});
  await deleteDoc(doc(messagesCol(coupleId), m.id));
}

const voiceCache = new Map<string, string>();

// Sesli mesaj: kayıt dosyası base64 olarak ayrı bir belgede (en fazla ~1 dk, düşük bit hızı).
export const VOICE_MAX_MS = 60_000;

export async function sendVoice(
  coupleId: string,
  from: string,
  uri: string,
  durationMs: number,
  notify?: { to: string | null; fromName: string },
) {
  const data = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
  if (data.length > 900_000) throw new Error('too-long');
  // Önce ses yüklenir, mesaj sonra yazılır: karşı taraf mesajı gördüğünde ses hazırdır.
  const ref = doc(messagesCol(coupleId));
  await setDoc(doc(audioCol(coupleId), ref.id), { from, data });
  await setDoc(ref, {
    from,
    text: '',
    hasPhoto: false,
    audioMs: Math.round(durationMs),
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
  });
  // Gönderenin telefonunda ses zaten var: tekrar indirmesin.
  const local = `${FS.cacheDirectory}voice_${ref.id}.m4a`;
  await FS.copyAsync({ from: uri, to: local })
    .then(() => voiceCache.set(ref.id, local))
    .catch(() => {});
  logActivity(coupleId, from, 'voice');
  if (notify?.to) notifyPartner(notify.to, notify.fromName, '🎤 Sesli mesaj gönderdi', { type: 'message', url: '/chat' });
}

// Sesli mesajı yalnızca gerektiğinde indirir ve telefonda geçici bir dosyaya yazar.
export function useVoiceFile(coupleId: string, id: string, enabled: boolean) {
  const [uri, setUri] = useState<string | null>(voiceCache.get(id) ?? null);
  useEffect(() => {
    if (!enabled || voiceCache.has(id)) return;
    let alive = true;
    (async () => {
      const path = `${FS.cacheDirectory}voice_${id}.m4a`;
      const info = await FS.getInfoAsync(path);
      if (!info.exists) {
        // Ses henüz yüklenmemişse birkaç kez tekrar dener.
        let d: string | undefined;
        for (let i = 0; i < 8 && alive && !d; i++) {
          const s = await getDoc(doc(audioCol(coupleId), id)).catch(() => null);
          d = (s?.data() as { data?: string } | undefined)?.data;
          if (!d) await new Promise((r) => setTimeout(r, 1500 + i * 1000));
        }
        if (!d) return;
        await FS.writeAsStringAsync(path, d, { encoding: FS.EncodingType.Base64 });
      }
      voiceCache.set(id, path);
      if (alive) setUri(path);
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [coupleId, id, enabled]);
  return uri;
}

// Fotoğraf verisini sadece ekranda gösterilecekken indirir ve bellekte tutar.
const cache = new Map<string, string>();
export function useMessagePhoto(coupleId: string, id: string, enabled: boolean) {
  const [data, setData] = useState<string | null>(cache.get(id) ?? null);
  useEffect(() => {
    if (!enabled || cache.has(id)) return;
    let alive = true;
    // Eski sürümlerden gelen mesajlarda fotoğraf biraz geç yüklenebilir: birkaç kez tekrar dener.
    (async () => {
      for (let i = 0; i < 8 && alive; i++) {
        const s = await getDoc(doc(photosCol(coupleId), id)).catch(() => null);
        const d = (s?.data() as { data?: string } | undefined)?.data;
        if (d) {
          cache.set(id, d);
          if (alive) setData(d);
          return;
        }
        await new Promise((r) => setTimeout(r, 1500 + i * 1000));
      }
    })();
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
  logActivity(coupleId, uid, 'album');
}

// Mesajdaki fotoğraf daha önce açılmış bir seyahat albümüne de konabilir (ayrı kopya).
export async function addToTrip(coupleId: string, msg: Message, uid: string, tripId: string, note: string) {
  const data = await photoData(coupleId, msg.id);
  await addDoc(collection(db, 'couples', coupleId, 'tripPhotos'), {
    tripId,
    uid,
    note: note.trim().slice(0, 80),
    data,
    createdAtMs: Date.now(),
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'couples', coupleId, 'trips', tripId), { count: increment(1) }).catch(() => {});
  logActivity(coupleId, uid, 'trip');
}

export async function removeFromAlbum(coupleId: string, messageId: string) {
  await deleteDoc(doc(albumCol(coupleId), momentId(messageId)));
  await updateDoc(doc(messagesCol(coupleId), messageId), { inAlbum: false }).catch(() => {});
}

// "Yazıyor…" / "Ses kaydediyor…": kişi başı tek küçük belge; birkaç saniyede bir tazelenir.
export type Typing = 'text' | 'voice' | null;
const TYPING_FRESH_MS = 6000;

export async function setTyping(coupleId: string, uid: string, kind: Typing) {
  await setDoc(doc(db, 'couples', coupleId, 'presence', uid), { kind, atMs: Date.now() }).catch(() => {});
}

// Partnerin şu an yazıp yazmadığı. Tazelenmeyen durum 6 saniye sonra kendiliğinden kaybolur.
export function usePartnerTyping(coupleId: string | undefined, partnerId: string | null): Typing {
  const [state, setState] = useState<{ kind: Typing; atMs: number } | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!coupleId || !partnerId) return;
    return onSnapshot(
      doc(db, 'couples', coupleId, 'presence', partnerId),
      (s) => setState((s.data() as { kind: Typing; atMs: number } | undefined) ?? null),
      () => setState(null),
    );
  }, [coupleId, partnerId]);
  const active = !!state?.kind && Date.now() - state.atMs < TYPING_FRESH_MS;
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [active]);
  return active ? state!.kind : null;
}

// Mesaja tepki: kişi başı tek emoji; aynısına tekrar basınca kalkar.
export const REACTIONS = ['❤️', '😂', '😍', '😮', '😢', '👍', '🔥'];

export async function reactToMessage(
  coupleId: string,
  msg: Message,
  uid: string,
  emoji: string,
  notify?: { to: string | null; fromName: string },
) {
  const remove = msg.reactions?.[uid] === emoji;
  await updateDoc(doc(messagesCol(coupleId), msg.id), { [`reactions.${uid}`]: remove ? deleteField() : emoji });
  if (!remove && notify?.to && msg.from === notify.to) {
    const what = msg.hasPhoto ? 'fotoğrafına' : msg.audioMs ? 'sesli mesajına' : `"${msg.text.slice(0, 40)}" mesajına`;
    notifyPartner(notify.to, notify.fromName, `${what} ${emoji} bıraktı`, { type: 'message', url: '/chat' });
  }
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
  // Uygulama açıkken (hangi sekmede olursa olsun) partnerden gelen mesajlar "ulaştı" sayılır.
  const newestFromPartner = latest.find((m) => m.from === partnerId)?.createdAtMs ?? 0;
  const delivered = (user && couple?.lastDelivered?.[user.uid]) ?? 0;
  useEffect(() => {
    if (!couple?.id || !user || newestFromPartner <= delivered) return;
    updateDoc(doc(db, 'couples', couple.id), { [`lastDelivered.${user.uid}`]: newestFromPartner }).catch(() => {});
  }, [couple?.id, user?.uid, newestFromPartner, delivered]);

  if (!user || !partnerId) return 0;
  const lastRead = (couple?.lastRead ?? {})[user.uid] ?? 0;
  return latest.filter((m) => m.from === partnerId && m.createdAtMs > lastRead).length;
}
