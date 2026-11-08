import { doc, runTransaction } from 'firebase/firestore';
import { dayKey } from './date';
import { farmOf, MIN, type Farm } from './farm';
import { db } from './firebase';
import type { Couple } from './session';

// Hayalimiz: Mavi Yolculuk ve Sahilde Ev veri modeli ve tek kişilik işlemler.
// İki kişilik sahneler scenes.ts'de. Altın üç dünyada ortak ve çiftliğin cüzdanında (farm.coins) durur.

// ---------- Mavi Yolculuk ----------

export type BoatId = 'sandal' | 'motor' | 'gulet' | 'yat';
export type FishId = 'cipura' | 'levrek' | 'barbun' | 'ahtapot';
// need: tekneyi almak için birlikte yaşanmış sahne sayısı. Tekneyi para değil birliktelik büyütür.
export const BOATS: Record<BoatId, { name: string; cost: number; need: number; speed: number; rank: number; w: number }> = {
  sandal: { name: 'Sandal', cost: 0, need: 0, speed: 1, rank: 1, w: 150 },
  motor: { name: 'Balıkçı teknesi', cost: 200, need: 3, speed: 1.6, rank: 2, w: 170 },
  gulet: { name: 'Gulet', cost: 600, need: 10, speed: 2.2, rank: 3, w: 190 },
  yat: { name: 'Motor yat', cost: 1500, need: 25, speed: 3, rank: 4, w: 210 },
};
// Gerçek koylar. x,y haritada (0-1). rank: gidebilen en küçük tekne.
export const BAYS = [
  {
    id: 'gocek',
    name: 'Göcek',
    x: 0.22,
    y: 0.86,
    rank: 1,
    camp: false,
    fish: ['cipura', 'barbun'] as FishId[],
    note: 'Mavi yolculuğun başladığı liman. Marinadan çıkınca on iki ada sizi bekler.',
  },
  {
    id: 'kleopatra',
    name: 'Kleopatra Hamamı',
    x: 0.7,
    y: 0.74,
    rank: 1,
    camp: false,
    fish: ['cipura', 'levrek'] as FishId[],
    note: 'Suyun içinde antik hamam kalıntıları. Söylenceye göre Kleopatra burada yıkanmış.',
  },
  {
    id: 'bedri',
    name: 'Bedri Rahmi Koyu',
    x: 0.28,
    y: 0.62,
    rank: 1,
    camp: true,
    fish: ['barbun', 'levrek'] as FishId[],
    note: 'Ressam Bedri Rahmi’nin kayaya çizdiği balık hâlâ duruyor. Çam gölgesinde kamp için ideal.',
  },
  {
    id: 'sarisu',
    name: 'Sarı Su',
    x: 0.72,
    y: 0.5,
    rank: 2,
    camp: true,
    fish: ['levrek', 'cipura'] as FishId[],
    note: 'Tatlı suyun denize karıştığı geniş kumsal. Sabahları sessiz.',
  },
  {
    id: 'kelebek',
    name: 'Kelebekler Vadisi',
    x: 0.3,
    y: 0.38,
    rank: 2,
    camp: true,
    fish: ['levrek', 'ahtapot'] as FishId[],
    note: 'İki kaya duvarın arasında saklı vadi. Haziranda kelebekler uçuşur.',
  },
  {
    id: 'kas',
    name: 'Kaş',
    x: 0.7,
    y: 0.27,
    rank: 3,
    camp: false,
    fish: ['ahtapot', 'cipura'] as FishId[],
    note: 'Begonvilli sokaklar, küçük liman. Akşam yemeği için en güzel kasaba.',
  },
  {
    id: 'kekova',
    name: 'Kekova',
    x: 0.28,
    y: 0.16,
    rank: 3,
    camp: false,
    fish: ['ahtapot', 'levrek'] as FishId[],
    note: 'Suyun altında batık şehir görünür. Yüzmek yasak, tekneden izlenir.',
  },
  {
    id: 'kaputas',
    name: 'Kaputaş',
    x: 0.68,
    y: 0.07,
    rank: 4,
    camp: false,
    fish: ['cipura', 'barbun'] as FishId[],
    note: 'Dik kayaların arasında turkuaz bir koy. Denizden girmek karadan inmekten güzel.',
  },
];
export type BayId = (typeof BAYS)[number]['id'];
export const FISH: Record<FishId, { name: string }> = {
  cipura: { name: 'Çipura' },
  levrek: { name: 'Levrek' },
  barbun: { name: 'Barbun' },
  ahtapot: { name: 'Ahtapot' },
};
export const CASTS_PER_DAY = 3;

export type Sea = {
  boat: BoatId;
  boatName: string;
  at: string;
  trip: { from: string; to: string; start: number; end: number; by: string } | null;
  visited: Record<string, boolean>;
  camps: Record<string, boolean>; // kamp kurulan koylar (çadır kalır)
  casts: Record<string, { day: string; n: number }>;
  catch: Partial<Record<FishId, number>>; // teknedeki balıklar (akşam yemeğinde yenir)
  realRoute: string[]; // "gerçekte de gidelim" denen koylar
};
export const bay = (id: string) => BAYS.find((b) => b.id === id) ?? BAYS[0];
export function newSea(): Sea {
  return {
    boat: 'sandal',
    boatName: 'Sandalımız',
    at: 'gocek',
    trip: null,
    visited: { gocek: true },
    camps: {},
    casts: {},
    catch: {},
    realRoute: [],
  };
}
export function seaOf(c: Couple | null | undefined, now = Date.now()): Sea {
  const raw = (c?.sea as Partial<Sea> | undefined) ?? {};
  const s: Sea = {
    ...newSea(),
    ...raw,
    realRoute: raw.realRoute ?? [],
    casts: raw.casts ?? {},
    catch: raw.catch ?? {},
    camps: raw.camps ?? {},
  };
  if (!BAYS.some((b) => b.id === s.at)) s.at = 'gocek';
  if (s.trip && now >= s.trip.end) {
    s.visited = { ...s.visited, [s.trip.to]: true };
    s.at = s.trip.to;
    s.trip = null;
  }
  return s;
}
export function tripMins(sea: Sea, from: string, to: string) {
  const a = bay(from);
  const b = bay(to);
  return Math.max(10, Math.round((Math.hypot((a.x - b.x) * 366, (a.y - b.y) * 600) * 0.45) / BOATS[sea.boat].speed));
}
export const castsLeft = (sea: Sea, uid: string) => {
  const c = sea.casts[uid];
  return CASTS_PER_DAY - (c && c.day === dayKey() ? c.n : 0);
};
export const fishOnBoard = (sea: Sea) => Object.values(sea.catch).reduce((a, b) => a + (b ?? 0), 0);

export type SeaAction =
  | { a: 'sail'; to: string }
  | { a: 'fish'; fish: FishId | null }
  | { a: 'eat' } // akşam yemeği sahnesi başlarken tekne balıkları yenir
  | { a: 'camp' } // kamp sahnesi başlarken çadır kurulur
  | { a: 'real'; id: string }
  | { a: 'boat'; boat: BoatId }
  | { a: 'rename'; name: string };

// ---------- Sahilde Ev ----------

export type HItemId = 'masa' | 'hamak' | 'mangal' | 'bisiklet' | 'sezlong' | 'havuz' | 'kedi' | 'zeytin';
export type SlotId = 'teras' | 'agaclar' | 'kose' | 'kapi' | 'kumsal' | 'bahce' | 'merdiven' | 'pencere';
// Sahnede sabit yuvalar (yüzde). Her yuvaya belli eşyalar gelir.
export const SLOTS: Record<SlotId, { x: number; y: number; w: number; name: string; items: HItemId[]; lvl?: number }> = {
  teras: { x: 0.5, y: 0.735, w: 0.2, name: 'Teras', items: ['masa'] },
  agaclar: { x: 0.2, y: 0.37, w: 0.2, name: 'Ağaçların arası', items: ['hamak'] },
  kose: { x: 0.82, y: 0.46, w: 0.14, name: 'Bahçe köşesi', items: ['mangal'] },
  kapi: { x: 0.74, y: 0.72, w: 0.14, name: 'Kapı önü', items: ['bisiklet'] },
  kumsal: { x: 0.8, y: 0.1, w: 0.16, name: 'Kumsal', items: ['sezlong'] },
  bahce: { x: 0.56, y: 0.47, w: 0.22, name: 'Bahçe', items: ['havuz'], lvl: 3 },
  merdiven: { x: 0.36, y: 0.69, w: 0.08, name: 'Merdiven', items: ['kedi'] },
  pencere: { x: 0.27, y: 0.72, w: 0.1, name: 'Pencere kenarı', items: ['zeytin'] },
};
export const HITEMS: Record<HItemId, { name: string; cost: number; lvl: number; art: string }> = {
  masa: { name: 'Kahve masası', cost: 50, lvl: 1, art: 'masa' },
  hamak: { name: 'Hamak', cost: 60, lvl: 1, art: 'hamak' },
  mangal: { name: 'Mangal', cost: 100, lvl: 1, art: 'mangal' },
  bisiklet: { name: 'İki bisiklet', cost: 90, lvl: 1, art: 'bisiklet' },
  sezlong: { name: 'Şezlong ve şemsiye', cost: 45, lvl: 1, art: 'sezlong' },
  havuz: { name: 'Havuz', cost: 600, lvl: 3, art: 'havuz' },
  kedi: { name: 'Kedi', cost: 0, lvl: 2, art: 'kedi' },
  zeytin: { name: 'Zeytin saksısı', cost: 40, lvl: 1, art: 'zeytin' },
};
export const HOUSE_LV = [
  { name: 'Küçük beyaz ev', art: 'evsahne1', huzur: 0 },
  { name: 'İki katlı taş ev', art: 'evsahne2', huzur: 30 },
  { name: 'Begonvilli villa', art: 'evsahne3', huzur: 100 },
];
// Günün sahneleri: saat aralığı ve gereken eşya (yuva).
export const DAY_SCENES: { kind: string; from: number; to: number; needs: HItemId | null; where: SlotId }[] = [
  { kind: 'coffee', from: 7, to: 11, needs: 'masa', where: 'teras' },
  { kind: 'beach', from: 11, to: 17, needs: 'sezlong', where: 'kumsal' },
  { kind: 'bike', from: 11, to: 17, needs: 'bisiklet', where: 'kapi' },
  { kind: 'bbq', from: 17, to: 21, needs: 'mangal', where: 'kose' },
  { kind: 'stars', from: 21, to: 1, needs: null, where: 'teras' },
];

export type Home = {
  slots: Partial<Record<SlotId, HItemId>>;
  huzur: number;
  town: string;
  wishes: { by: string; text: string; at: number }[];
};
export function newHome(): Home {
  return { slots: { teras: 'masa', pencere: 'zeytin' }, huzur: 0, town: 'Sahildeki Evimiz', wishes: [] };
}
export function homeOf(c: Couple | null | undefined): Home {
  const raw = (c?.home as Partial<Home> | undefined) ?? {};
  const h = { ...newHome(), ...raw, slots: raw.slots ?? newHome().slots, wishes: raw.wishes ?? [] };
  return h;
}
export const houseLevel = (h: Home) => (h.huzur >= HOUSE_LV[2].huzur ? 3 : h.huzur >= HOUSE_LV[1].huzur ? 2 : 1);

export type HomeAction =
  { a: 'place'; slot: SlotId; item: HItemId } | { a: 'remove'; slot: SlotId } | { a: 'town'; name: string } | { a: 'wish'; text: string };

// ---------- işlem ----------

const clean = <T>(x: T): T => JSON.parse(JSON.stringify(x));
type Out = { text: string };

export async function dreamAction(
  coupleId: string,
  uid: string,
  name: string,
  act: { w: 'sea'; x: SeaAction } | { w: 'home'; x: HomeAction },
) {
  const ref = doc(db, 'couples', coupleId);
  return runTransaction(db, async (tx): Promise<Out | string> => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 'Çift bulunamadı.';
    const c = snap.data() as Couple;
    const farm: Farm = { ...farmOf(c) };
    const now = Date.now();
    const pay = (n: number) => {
      if (farm.coins < n) return false;
      farm.coins -= n;
      return true;
    };
    let out: Out | string;
    if (act.w === 'sea') {
      const s = seaOf(c, now);
      out = seaApply(s, act.x, uid, name, now, c.sceneCount ?? 0, pay);
      if (typeof out !== 'string') tx.update(ref, { sea: clean(s), farm: clean(farm) });
    } else {
      const h = homeOf(c);
      out = homeApply(h, act.x, uid, name, pay);
      if (typeof out !== 'string') tx.update(ref, { home: clean(h), farm: clean(farm) });
    }
    return out;
  });
}

function seaApply(s: Sea, x: SeaAction, uid: string, name: string, now: number, scenes: number, pay: (n: number) => boolean): Out | string {
  const here = bay(s.at);
  switch (x.a) {
    case 'sail': {
      if (s.trip) return 'Tekne zaten yolda.';
      const to = bay(x.to);
      if (to.id === s.at) return 'Zaten buradasınız.';
      if (BOATS[s.boat].rank < to.rank) return `${to.name} için ${Object.values(BOATS).find((b) => b.rank === to.rank)!.name} gerekir.`;
      s.trip = { from: s.at, to: to.id, start: now, end: now + tripMins(s, s.at, to.id) * MIN, by: uid };
      return { text: `${name} ${to.name} yoluna çıktı ⛵` };
    }
    case 'fish': {
      if (s.trip) return 'Yoldayken balık tutulmaz.';
      if (castsLeft(s, uid) <= 0) return 'Bugün yeterince balık tuttunuz.';
      const c = s.casts[uid];
      s.casts[uid] = { day: dayKey(), n: (c && c.day === dayKey() ? c.n : 0) + 1 };
      if (!x.fish) return { text: 'Kaçtı' };
      s.catch[x.fish] = (s.catch[x.fish] ?? 0) + 1;
      return { text: `${name} ${FISH[x.fish].name.toLowerCase()} tuttu` };
    }
    case 'eat': {
      if (fishOnBoard(s) <= 0) return 'Teknede balık yok.';
      s.catch = {};
      return { text: 'Balıklar ızgarada' };
    }
    case 'camp': {
      if (!here.camp) return 'Bu koyda kamp kurulmaz.';
      s.camps[here.id] = true;
      return { text: `${here.name}’da çadır kuruldu` };
    }
    case 'real': {
      s.realRoute = s.realRoute.includes(x.id) ? s.realRoute.filter((i) => i !== x.id) : [...s.realRoute, x.id];
      return { text: s.realRoute.includes(x.id) ? `${bay(x.id).name} gerçek rotanıza eklendi ❤` : 'Rotadan çıkarıldı' };
    }
    case 'boat': {
      const b = BOATS[x.boat];
      if (b.rank !== BOATS[s.boat].rank + 1) return 'Önce bir önceki tekne alınmalı.';
      if (scenes < b.need) return `${b.name} için ${b.need} ortak sahne gerek; ${scenes} yaşadınız.`;
      if (!pay(b.cost)) return 'Yeterli altın yok.';
      s.boat = x.boat;
      return { text: `${name} ${b.name} aldı ⚓` };
    }
    case 'rename': {
      s.boatName = x.name.trim().slice(0, 24) || s.boatName;
      return { text: `Teknenin adı: ${s.boatName}` };
    }
  }
}

function homeApply(h: Home, x: HomeAction, uid: string, name: string, pay: (n: number) => boolean): Out | string {
  const lv = houseLevel(h);
  switch (x.a) {
    case 'place': {
      const slot = SLOTS[x.slot];
      const it = HITEMS[x.item];
      if (!slot.items.includes(x.item)) return 'Bu eşya buraya gelmez.';
      if (h.slots[x.slot]) return 'Burası dolu.';
      if ((slot.lvl && lv < slot.lvl) || lv < it.lvl) return `Bunun için ${HOUSE_LV[Math.max(slot.lvl ?? 1, it.lvl) - 1].name} gerekir.`;
      if (!pay(it.cost)) return 'Yeterli altın yok.';
      h.slots[x.slot] = x.item;
      return { text: x.item === 'kedi' ? 'Bir kedi geldi, merdivene oturdu 🐈' : `${name} eve ${it.name.toLowerCase()} aldı` };
    }
    case 'remove': {
      const it = h.slots[x.slot];
      if (!it) return 'Burası zaten boş.';
      pay(-Math.floor(HITEMS[it].cost / 2));
      delete h.slots[x.slot];
      return { text: `${HITEMS[it].name} kaldırıldı` };
    }
    case 'town': {
      h.town = x.name.trim().slice(0, 30) || h.town;
      return { text: `Kasabanızın adı: ${h.town}` };
    }
    case 'wish': {
      h.wishes = [...h.wishes, { by: uid, text: x.text.trim().slice(0, 200), at: Date.now() }].slice(-40);
      return { text: 'Dilek saklandı. Yıl dönümünde açılacak.' };
    }
  }
}
