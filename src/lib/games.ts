import type { Feature } from './usage';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { dayKey } from './date';
import { db } from './firebase';
import { logActivity } from './bond';
import { applyMove, newBlocks, type BlocksState } from './blocks';
import { KNOW_ME, THIS_THAT } from './gameData';
import { diceOf, flipMove, fromView, legalMoves, newTavla, play, toView, type TavlaState, type View } from './tavla';
import type { Couple } from './session';

export type GameType = 'thisthat' | 'knowme' | 'memory' | 'blocks' | 'tavla';
export type GameStatus = 'invited' | 'declined' | 'playing' | 'done' | 'cancelled';

export const GAMES: Record<GameType, { name: string; blurb: string; icon: string }> = {
  thisthat: { name: 'Bu mu, o mu?', blurb: '10 hızlı seçim · 2 dk', icon: 'git-compare-outline' },
  knowme: { name: 'Beni ne kadar tanıyorsun?', blurb: '5 soru · 3 dk', icon: 'help-circle-outline' },
  memory: { name: 'Anı eşleştirme', blurb: 'Selfielerinizle hafıza oyunu · 3 dk', icon: 'grid-outline' },
  blocks: { name: 'Birlikte Blok', blurb: 'Parçayı sürükle bırak · ortak tahta, 3’lü setle sıra', icon: 'apps-outline' },
  tavla: { name: 'Tavla', blurb: 'Klasik tavla, sırayla zar · kim kazanacak?', icon: 'dice-outline' },
};

export const INVITE_MINUTES = 15;
export const WEEKLY_PASSES = 3;
export const GAME_POINTS = 10;

export type MemoryState = {
  deck: string[]; // her kart: fotoğraf id'si ya da "icon:heart"
  matched: number[];
  flipped: number[];
  turn: string;
  scores: Record<string, number>;
};

export type Game = {
  id: string;
  type: GameType;
  from: string;
  to: string;
  status: GameStatus;
  expiresAt: number;
  // Bu mu o mu: seçilen sorular ve cevaplar (0 ya da 1)
  pairs?: number[];
  answers?: Record<string, number[]>;
  // Tanıma oyunu: sorular, kendi cevapların, partner tahminlerin
  questions?: number[];
  self?: Record<string, number[]>;
  guess?: Record<string, number[]>;
  memory?: MemoryState;
  blocks?: BlocksState;
  tavla?: TavlaState;
  finished?: Record<string, boolean>;
  // Oyun kuran hemen oynar; partner katılınca joined[to] = true. Eski kayıtlarda alan yok: katılmış sayılır.
  joined?: Record<string, boolean>;
  declined?: Record<string, boolean>; // "şimdi olmaz" dedi; oyun yalnız sürer
};

// Partner (davet edilen) oyuna katıldı mı? Yalnız oynarken sıra hep kuranda kalır; Tavla'da bilgisayar oynar.
export const partnerJoined = (g: Game) => (g.joined ? !!g.joined[g.to] : g.status !== 'invited');
// Sıradaki oyuncu: partner katılmadıysa sıra yine kuranda.
export function nextOf(g: Game, uid: string) {
  const other = uid === g.from ? g.to : g.from;
  return other === g.to && !partnerJoined(g) ? uid : other;
}

export type GameProps = {
  game: Game;
  coupleId: string;
  uid: string;
  partnerId: string;
  partnerName: string;
  myName: string;
  onExit?: () => void; // çıkış düğmesi: "oyunu sonlandır / sonra devam et" sorusunu açar
};

function gamesCol(coupleId: string) {
  return collection(db, 'couples', coupleId, 'games');
}

// Aynı oyunda iki telefon da aynı soruları görsün diye tohumlu karıştırma.
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Önce bu çiftin hiç görmediği sorular seçilir; yetmezse en eski görülenlerden tamamlanır.
function pickFresh(count: number, total: number, seen: number[]): number[] {
  const seenSet = new Set(seen);
  const fresh = seededShuffle(
    Array.from({ length: total }, (_, i) => i).filter((i) => !seenSet.has(i)),
    `${Date.now()}-${Math.random()}`,
  );
  const picked = fresh.slice(0, count);
  for (const i of seen) {
    if (picked.length >= count) break;
    if (!picked.includes(i)) picked.push(i);
  }
  return picked;
}

// Görülenler listesine ekler; havuzun en az bir oyunluk kısmı her zaman yeni kalır.
function nextSeen(seen: number[], picked: number[], total: number, count: number): number[] {
  const list = [...seen.filter((i) => !picked.includes(i)), ...picked];
  const keep = Math.max(0, total - count);
  return list.length > keep ? list.slice(list.length - keep) : list;
}

// ---------- "Şimdi olmaz" hakları (haftada 3, pazartesi sıfırlanır) ----------

export function weekKey(d = new Date()): string {
  const day = (d.getDay() + 6) % 7; // pazartesi = 0
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return dayKey(monday);
}

export function passesLeft(couple: Couple, uid: string): number {
  const p = couple.passes?.[uid];
  const used = p && p.week === weekKey() ? p.used : 0;
  return Math.max(0, WEEKLY_PASSES - used);
}

// ---------- Davet ----------

// Hafıza oyunu için son fotoğrafların kimlikleri.
async function recentPhotoIds(coupleId: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, 'couples', coupleId, 'photos'), limit(12)));
  return snap.docs.map((d) => d.id);
}

// Oyun hemen başlar: kuran yalnız oynar, partner istediği an katılır (katılma çağrısı JOIN_HOURS boyunca görünür).
export const JOIN_HOURS = 12;
export async function sendInvite(coupleId: string, from: string, to: string, type: GameType) {
  const base = {
    type,
    from,
    to,
    status: 'playing' as GameStatus,
    joined: { [from]: true },
    expiresAt: Date.now() + JOIN_HOURS * 3_600_000,
    createdAt: serverTimestamp(),
    startedAt: serverTimestamp(),
  };
  const coupleRef = doc(db, 'couples', coupleId);
  const coupleSnap = await getDoc(coupleRef);
  const seen = (coupleSnap.data() as Couple | undefined)?.seenGames ?? {};

  let extra: Partial<Game> = {};
  if (type === 'thisthat') {
    const pairs = pickFresh(10, THIS_THAT.length, seen.thisthat ?? []);
    extra = { pairs, answers: {} };
    await updateDoc(coupleRef, { 'seenGames.thisthat': nextSeen(seen.thisthat ?? [], pairs, THIS_THAT.length, 10) });
  }
  if (type === 'knowme') {
    const questions = pickFresh(5, KNOW_ME.length, seen.knowme ?? []);
    extra = { questions, self: {}, guess: {} };
    await updateDoc(coupleRef, { 'seenGames.knowme': nextSeen(seen.knowme ?? [], questions, KNOW_ME.length, 5) });
  }
  if (type === 'memory') extra = { memory: newMemory(await recentPhotoIds(coupleId), from, to) };
  if (type === 'blocks') extra = { blocks: newBlocks(from) };
  if (type === 'tavla') extra = { tavla: newTavla(from) };
  const ref = await addDoc(gamesCol(coupleId), { ...base, ...extra, finished: {} });
  return ref.id;
}

// Partner katılır: oyun zaten sürüyor; bundan sonra sıra ona da geçer.
export async function acceptInvite(coupleId: string, id: string, uid?: string) {
  await updateDoc(doc(gamesCol(coupleId), id), {
    status: 'playing',
    ...(uid ? { [`joined.${uid}`]: true } : {}),
    joinedAt: serverTimestamp(),
  });
}

// Süren oyunu bırak (puan yok); ana ekranda yeni oyun başlatılabilir.
export async function abandonGame(coupleId: string, id: string) {
  await updateDoc(doc(gamesCol(coupleId), id), { status: 'cancelled' });
}

export async function cancelInvite(coupleId: string, id: string) {
  await updateDoc(doc(gamesCol(coupleId), id), { status: 'cancelled' });
}

// "Şimdi olmaz": hakkı düşer, davet kapanır. Hak yoksa reddedilemez.
export async function declineInvite(coupleId: string, id: string, uid: string) {
  const coupleRef = doc(db, 'couples', coupleId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(coupleRef);
    if (!snap.exists()) return;
    const couple = snap.data() as Couple;
    if (passesLeft(couple, uid) <= 0) throw new Error('Bu haftaki "şimdi olmaz" hakların bitti.');
    const week = weekKey();
    const prev = couple.passes?.[uid];
    const used = prev && prev.week === week ? prev.used + 1 : 1;
    tx.update(coupleRef, { [`passes.${uid}`]: { week, used } });
    // Oyun kuran için sürer (yalnız); yalnızca katılma çağrısı kapanır.
    tx.update(doc(gamesCol(coupleId), id), { [`declined.${uid}`]: true });
  });
}

export function isExpired(g: Game) {
  return g.status === 'invited' && Date.now() > g.expiresAt;
}

// ---------- Canlı dinleme ----------

export function useGame(coupleId: string | undefined, id: string | undefined) {
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  useEffect(() => {
    if (!coupleId || !id) return;
    return onSnapshot(
      doc(gamesCol(coupleId), id),
      (s) => setGame(s.exists() ? { id: s.id, ...(s.data() as Omit<Game, 'id'>) } : null),
      () => setGame(null),
    );
  }, [coupleId, id]);
  return game;
}

// Oyun bitti mi (tahta/kartlar/sorular açısından)?
export function gameOver(g: Game) {
  if (g.status === 'done' || g.status === 'cancelled') return true;
  if (g.blocks) return g.blocks.over;
  if (g.tavla) return !!g.tavla.winner;
  if (g.memory) return g.memory.matched.length >= g.memory.deck.length;
  return false;
}

// Bana gelen katılma çağrısı: partnerin başlattığı, benim henüz katılmadığım ve bitmemiş oyun.
export function useIncomingInvite(coupleId: string | undefined, uid: string | undefined) {
  const [invite, setInvite] = useState<Game | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!coupleId || !uid) return;
    const q = query(gamesCol(coupleId), where('to', '==', uid), where('status', 'in', ['invited', 'playing']), limit(10));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Game, 'id'>) }))
          .filter((g) => !partnerJoined(g) && !g.declined?.[uid] && !gameOver(g) && Date.now() < g.expiresAt);
        list.sort((a, b) => b.expiresAt - a.expiresAt);
        setInvite(list[0] ?? null);
      },
      () => setInvite(null),
    );
  }, [coupleId, uid]);
  // Süre dolunca pencere kendiliğinden kapansın.
  useEffect(() => {
    if (!invite) return;
    const t = setTimeout(() => tick((n) => n + 1), Math.max(0, invite.expiresAt - Date.now()) + 500);
    return () => clearTimeout(t);
  }, [invite]);
  return invite && Date.now() < invite.expiresAt ? invite : null;
}

// Benim gönderdiğim, hâlâ kabul bekleyen eski tip davet (yeni oyunlar hemen başlar; bkz. useActiveTurnGame).
export function useMyOpenInvite(coupleId: string | undefined, uid: string | undefined) {
  const [game, setGame] = useState<Game | null>(null);
  useEffect(() => {
    if (!coupleId || !uid) return;
    // İki eşitlik filtresi ek indeks gerektirmez; sıralama telefonda yapılır.
    const q = query(gamesCol(coupleId), where('from', '==', uid), where('status', '==', 'invited'), limit(5));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Game, 'id'>) }));
        list.sort((a, b) => b.expiresAt - a.expiresAt);
        setGame(list[0] ?? null);
      },
      () => setGame(null),
    );
  }, [coupleId, uid]);
  return game && game.status === 'invited' && !isExpired(game) ? game : null;
}

// ---------- Bitirme ve puan ----------

// Herkes kendi bitişini işaretler; ikisi de bitirince oyun kapanır ve günün ilk oyunu puan kazandırır.
export async function finishGame(coupleId: string, id: string, uid: string) {
  const gameRef = doc(gamesCol(coupleId), id);
  const coupleRef = doc(db, 'couples', coupleId);
  let type: GameType | null = null;
  await runTransaction(db, async (tx) => {
    const g = await tx.get(gameRef);
    const c = await tx.get(coupleRef);
    if (!g.exists() || !c.exists()) return;
    const game = g.data() as Game;
    type = game.type;
    const couple = c.data() as Couple;
    const finished = { ...(game.finished ?? {}), [uid]: true };
    const both = [game.from, game.to].every((m) => finished[m]);
    tx.update(gameRef, { [`finished.${uid}`]: true, ...(both ? { status: 'done' } : {}) });
    if (both && game.status !== 'done' && couple.lastGameDay !== dayKey()) {
      tx.update(coupleRef, { points: (couple.points ?? 0) + GAME_POINTS, lastGameDay: dayKey() });
    }
  });
  logActivity(coupleId, uid, 'game', 1, type ? ['oyun', `oyun_${type}` as Feature] : ['oyun']);
}

// ---------- Bu mu, o mu? ----------

export async function answerThisThat(coupleId: string, game: Game, uid: string, choice: number) {
  const mine = [...(game.answers?.[uid] ?? []), choice];
  await updateDoc(doc(gamesCol(coupleId), game.id), { [`answers.${uid}`]: mine });
}

// ---------- Beni ne kadar tanıyorsun? ----------

export async function answerKnowMe(coupleId: string, game: Game, uid: string, self: number, guess: number) {
  await updateDoc(doc(gamesCol(coupleId), game.id), {
    [`self.${uid}`]: [...(game.self?.[uid] ?? []), self],
    [`guess.${uid}`]: [...(game.guess?.[uid] ?? []), guess],
  });
}

// ---------- Anı eşleştirme ----------

function newMemory(photoIds: string[], from: string, to: string): MemoryState {
  const faces = seededShuffle(photoIds, `${Date.now()}`).slice(0, 6);
  const icons = ['heart', 'star', 'cafe', 'musical-notes', 'airplane', 'pizza', 'moon', 'flower'];
  while (faces.length < 6) faces.push(`icon:${icons[faces.length]}`);
  const deck = seededShuffle([...faces, ...faces], `${Math.random()}`);
  return { deck, matched: [], flipped: [], turn: from, scores: { [from]: 0, [to]: 0 } };
}

export async function flipCard(coupleId: string, id: string, uid: string, index: number) {
  const ref = doc(gamesCol(coupleId), id);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return 'none' as const;
    const m = (s.data() as Game).memory!;
    if (m.turn !== uid || m.flipped.length >= 2 || m.flipped.includes(index) || m.matched.includes(index)) {
      return 'none' as const;
    }
    const flipped = [...m.flipped, index];
    if (flipped.length < 2) {
      tx.update(ref, { 'memory.flipped': flipped });
      return 'first' as const;
    }
    const [a, b] = flipped;
    if (m.deck[a] === m.deck[b]) {
      // Eşleşti: kartlar açık kalır, puan alır, sıra yine onda.
      tx.update(ref, {
        'memory.flipped': [],
        'memory.matched': [...m.matched, a, b],
        [`memory.scores.${uid}`]: (m.scores[uid] ?? 0) + 1,
      });
      return 'match' as const;
    }
    tx.update(ref, { 'memory.flipped': flipped });
    return 'miss' as const;
  });
}

// Eşleşmeyen iki kart bir süre açık kalır, sonra kapanır ve sıra diğerine geçer.
export async function endTurn(coupleId: string, id: string, uid: string) {
  const ref = doc(gamesCol(coupleId), id);
  await runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const g = { id, ...(s.data() as Omit<Game, 'id'>) };
    tx.update(ref, { 'memory.flipped': [], 'memory.turn': nextOf(g, uid) });
  });
}

// ---------- Birlikte Blok ----------

// Ortak tahtaya parça koyar. Set bitince sıra partnere geçer. Oyun bitince çiftin rekoru güncellenir.
export async function placeBlock(coupleId: string, id: string, uid: string, slot: number, r: number, c: number) {
  const ref = doc(gamesCol(coupleId), id);
  const coupleRef = doc(db, 'couples', coupleId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const cs = await tx.get(coupleRef);
    if (!s.exists()) return null;
    const game = s.data() as Game;
    const b = game.blocks;
    if (!b || b.turn !== uid) return null;
    const next = nextOf(game, uid);
    const res = applyMove(b, slot, r, c, uid, next);
    if (!res) return null;
    tx.update(ref, { blocks: res.state });
    const best = (cs.data() as Couple | undefined)?.blocksBest ?? 0;
    if (res.state.over && res.state.score > best) tx.update(coupleRef, { blocksBest: res.state.score });
    return res;
  });
}

// Devam eden sıralı oyun (Birlikte Blok, Tavla): bildirim kaçarsa ana ekrandan geri dönülsün.
export function turnOf(g: Game) {
  return g.blocks?.turn ?? g.tavla?.turn ?? g.memory?.turn ?? '';
}

export function useActiveTurnGame(coupleId: string | undefined) {
  const [game, setGame] = useState<Game | null>(null);
  useEffect(() => {
    if (!coupleId) return;
    const q = query(gamesCol(coupleId), where('status', '==', 'playing'), limit(10));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Game, 'id'>) }))
          .filter((g) => (g.blocks || g.tavla || g.memory) && !gameOver(g));
        list.sort((a, b) => b.expiresAt - a.expiresAt);
        setGame(list[0] ?? null);
      },
      () => setGame(null),
    );
  }, [coupleId]);
  return game;
}

// ---------- Tavla ----------

export const sideOf = (game: Game, uid: string) => (uid === game.from ? 'a' : 'b') as 'a' | 'b';

// Zar atılır. Oynanacak hamle yoksa sıra hemen geçer.
export async function rollTavla(coupleId: string, id: string, uid: string) {
  const ref = doc(gamesCol(coupleId), id);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return null;
    const game = s.data() as Game;
    const tv = game.tavla;
    if (!tv || tv.turn !== uid || tv.rolled.length || tv.winner) return null;
    const rolled = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    const blocked = legalMoves(toView(tv, sideOf(game, uid)), diceOf(rolled)).length === 0;
    const next = uid === game.from ? game.to : game.from; // partner yoksa karşı tarafı bilgisayar oynar
    tx.update(
      ref,
      blocked ? { 'tavla.rolled': [], 'tavla.turn': next, 'tavla.last': { by: uid, dice: rolled, moves: 0 } } : { 'tavla.rolled': rolled },
    );
    return { rolled, blocked };
  });
}

// Turun hamleleri telefonda yapılır (geri alınabilir), "Hamleyi bitir" ile tek seferde kaydedilir.
export async function commitTavla(coupleId: string, id: string, uid: string, view: View, path: { from: number; to: number }[]) {
  const ref = doc(gamesCol(coupleId), id);
  const coupleRef = doc(db, 'couples', coupleId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    const cs = await tx.get(coupleRef);
    if (!s.exists()) return null;
    const game = s.data() as Game;
    const tv = game.tavla;
    if (!tv || tv.turn !== uid || !tv.rolled.length || tv.winner) return null;
    const next = uid === game.from ? game.to : game.from; // partner yoksa karşı tarafı bilgisayar oynar
    const won = view.offMe === 15;
    const mars = won && view.offOpp === 0;
    const state: TavlaState = {
      ...tv,
      ...fromView(view, sideOf(game, uid)),
      turn: next,
      rolled: [],
      last: { by: uid, dice: tv.rolled, moves: path.length, path: path.map((m) => flipMove(sideOf(game, uid), m)) },
      ...(won ? { winner: uid, mars } : {}),
    };
    tx.update(ref, { tavla: state });
    if (won) {
      const wins = (cs.data() as Couple | undefined)?.tavlaWins ?? {};
      tx.update(coupleRef, { [`tavlaWins.${uid}`]: (wins[uid] ?? 0) + (mars ? 2 : 1) });
    }
    return state;
  });
}

// ---------- Tavla: partner gelene kadar bilgisayar ----------

// Partner katılmadıysa "to" tarafını basit bir rakip oynar: kuranın telefonu sırası gelince çağırır.
// Hamle seçimi: kırma > toplama > kapı yapma > rastgele. Partner katılınca devreye girmez.
export async function botTavla(coupleId: string, id: string) {
  const ref = doc(gamesCol(coupleId), id);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return null;
    const game = { id, ...(s.data() as Omit<Game, 'id'>) };
    const tv = game.tavla;
    if (!tv || tv.winner || tv.turn !== game.to || partnerJoined(game) || tv.rolled.length) return null;
    const rolled = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
    let view = toView(tv, 'b');
    let dice = diceOf(rolled);
    const path: { from: number; to: number }[] = [];
    for (let guard = 0; guard < 4; guard++) {
      const moves = legalMoves(view, dice);
      if (!moves.length) break;
      const score = (m: { from: number; to: number }) => {
        if (m.to === -1) return 3; // toplama
        const dst = view.pts[m.to] ?? 0;
        if (dst === -1) return 4; // rakibi kırar
        if (dst >= 1) return 2; // kapı
        return 1 + Math.random();
      };
      const m = [...moves].sort((a, b) => score(b) - score(a))[0];
      const r = play(view, dice, m);
      view = r.view;
      dice = r.dice;
      path.push({ from: m.from, to: m.to });
    }
    const won = view.offMe === 15;
    const state: TavlaState = {
      ...tv,
      ...fromView(view, 'b'),
      turn: game.from,
      rolled: [],
      last: { by: game.to, dice: rolled, moves: path.length, path: path.map((m) => flipMove('b', m)) },
      ...(won ? { winner: game.to, mars: view.offOpp === 0 } : {}),
    };
    tx.update(ref, { tavla: state });
    return state;
  });
}
