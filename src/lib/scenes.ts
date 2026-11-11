import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, runTransaction, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey } from './date';
import { pickQuestion } from './dreamQuestions';
import { db } from './firebase';
import type { Couple } from './session';

// Hayal dünyalarının ortak motoru: iki kişilik sahneler.
// Biri sahneyi başlatır (bildirim gider), partner süresi içinde katılır, sahne iki telefonda oynar,
// sonra tek bir soru çıkar; ikisi de cevaplayınca sahne hayal defterinde bir sayfa olur.

export type World = 'farm' | 'sea' | 'home';
export type SceneStatus = 'waiting' | 'live' | 'done' | 'expired';

export type Scene = {
  id: string;
  world: World;
  kind: string; // swim, dinner, camp, sunset, coffee, beach, bbq, stars, harvest, market...
  place: string; // koy, yuva ya da tarla adı
  by: string;
  startedAt: number;
  expiresAt: number;
  joinedBy?: string;
  joinedAt?: number;
  status: SceneStatus;
  question: string | null;
  answers: Record<string, string>;
  photo?: string; // albümdeki fotoğraf id'si
  reward?: number;
  done?: boolean; // ikisi de cevapladı ya da soru yok
};

export const scenesCol = (coupleId: string) => collection(db, 'couples', coupleId, 'scenes');
const coupleRef = (coupleId: string) => doc(db, 'couples', coupleId);

// Sahne başlatma: dünyada bekleyen başka sahne varsa başlatılamaz.
export async function startScene(
  coupleId: string,
  uid: string,
  s: { world: World; kind: string; place: string; windowMin?: number; qkind?: string },
) {
  const c = (await getDoc(coupleRef(coupleId))).data() as Couple | undefined;
  const asked = (c as { askedQ?: string[] } | undefined)?.askedQ ?? [];
  const question = pickQuestion(s.qkind ?? s.kind, asked);
  const now = Date.now();
  const ref = await addDoc(scenesCol(coupleId), {
    world: s.world,
    kind: s.kind,
    place: s.place,
    by: uid,
    startedAt: now,
    expiresAt: now + (s.windowMin ?? 120) * 60_000,
    status: 'waiting',
    question,
    answers: {},
  });
  if (question)
    await updateDoc(coupleRef(coupleId), { askedQ: [...asked, `${s.qkind ?? s.kind}:${question}`].slice(-400) }).catch(() => {});
  return ref.id;
}

// Partner katılır: sahne canlanır, ödül verilir (altın çiftlik cüzdanına, huzur eve).
export async function joinScene(coupleId: string, sceneId: string, uid: string, reward: { coins?: number; huzur?: number } = {}) {
  const ref = doc(scenesCol(coupleId), sceneId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const c = await tx.get(coupleRef(coupleId));
    if (!s.exists() || !c.exists()) return false;
    const sc = s.data() as Scene;
    if (sc.status !== 'waiting' || sc.by === uid || Date.now() > sc.expiresAt) return false;
    const couple = c.data() as Couple & { sceneCount?: number };
    tx.update(ref, { status: 'live', joinedBy: uid, joinedAt: Date.now(), reward: reward.coins ?? 0 });
    const upd: Record<string, unknown> = { sceneCount: (couple.sceneCount ?? 0) + 1 };
    if (reward.coins && couple.farm) upd['farm.coins'] = (couple.farm.coins ?? 0) + reward.coins;
    if (reward.huzur) upd['home.huzur'] = ((couple.home as { huzur?: number } | undefined)?.huzur ?? 0) + reward.huzur;
    tx.update(coupleRef(coupleId), upd);
    return true;
  });
}

export async function answerScene(coupleId: string, scene: Scene, uid: string, text: string, partnerId: string) {
  const answers = { ...scene.answers, [uid]: text.trim().slice(0, 240) };
  const done = !!answers[uid] && !!answers[partnerId];
  await updateDoc(doc(scenesCol(coupleId), scene.id), {
    [`answers.${uid}`]: answers[uid],
    ...(done ? { status: 'done', done: true } : {}),
  });
}
export async function attachPhoto(coupleId: string, sceneId: string, photoId: string | null) {
  await updateDoc(doc(scenesCol(coupleId), sceneId), { photo: photoId });
}
// Sorusuz sahne (çiftlikte hasat günü, pazar): iş bitince kapanır; defter sayfası olmaz.
export async function finishScene(coupleId: string, sceneId: string) {
  await updateDoc(doc(scenesCol(coupleId), sceneId), { status: 'done', done: true }).catch(() => {});
}
export async function cancelScene(coupleId: string, sceneId: string) {
  await updateDoc(doc(scenesCol(coupleId), sceneId), { status: 'expired' });
}
// Katılım olmadan süresi dolan sahne. İkisi de cevaplamadan kalan canlı sahne 24 saat sonra yine de sayfa olur.
export async function settleScene(coupleId: string, s: Scene) {
  const now = Date.now();
  if (s.status === 'waiting' && now > s.expiresAt) await updateDoc(doc(scenesCol(coupleId), s.id), { status: 'expired' });
  if (s.status === 'live' && s.joinedAt && now > s.joinedAt + 24 * 3_600_000)
    await updateDoc(doc(scenesCol(coupleId), s.id), { status: 'done', done: true });
}

export const isOpen = (s: Scene) => (s.status === 'waiting' && Date.now() <= s.expiresAt) || s.status === 'live';

// Bir dünyanın bekleyen ya da canlı sahnesi (en çok bir tane).
export function useOpenScene(coupleId: string | undefined, world: World) {
  const [scene, setScene] = useState<Scene | null | undefined>(undefined);
  useEffect(() => {
    if (!coupleId) return;
    const q = query(scenesCol(coupleId), where('world', '==', world), where('status', 'in', ['waiting', 'live']), limit(5));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Scene, 'id'>) }));
        list.forEach((s) => settleScene(coupleId, s).catch(() => {}));
        const open = list.filter(isOpen).sort((a, b) => b.startedAt - a.startedAt);
        setScene(open[0] ?? null);
      },
      () => setScene(null),
    );
  }, [coupleId, world]);
  return scene;
}

// Hayal defteri: biten sahneler, yeniden eskiye. (Tek alan sıralaması; bileşik indeks gerekmez.)
export function usePages(coupleId: string | undefined, max = 120) {
  const [pages, setPages] = useState<Scene[] | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    const q = query(scenesCol(coupleId), orderBy('startedAt', 'desc'), limit(max));
    return onSnapshot(
      q,
      (snap) =>
        setPages(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Scene, 'id'>) })).filter((x) => x.status === 'done' && !!x.question),
        ), // sorusuz iş sahneleri (hasat, pazar) deftere girmez
      () => setPages([]),
    );
  }, [coupleId, max]);
  return pages;
}

// Bugün biten sahne sayısı (dünya başına günde bir ödül gibi sınırlar için).
export function todayKey() {
  return dayKey();
}

// Saat dilimi: Sahilde Ev'in sahneleri günün saatine bağlıdır.
export function hourNow() {
  return new Date().getHours();
}
export const inWindow = (h: number, from: number, to: number) => (from < to ? h >= from && h < to : h >= from || h < to);
