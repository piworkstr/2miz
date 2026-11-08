import { doc, runTransaction } from 'firebase/firestore';
import { dayKey } from './date';
import { farmOf, MIN, type Farm } from './farm';
import { db } from './firebase';
import type { Couple } from './session';

// Hayalimiz: Mavi Yolculuk ve Sahilde Ev. Altın üç dünyada ortak ve çiftliğin cüzdanında (farm.coins) durur.

// ---------- Mavi Yolculuk ----------

export type BoatId = 'sandal' | 'motor' | 'gulet' | 'yat';
export type FishId = 'cipura' | 'levrek' | 'barbun' | 'ahtapot';
export const BOATS: Record<BoatId, { name: string; cost: number; speed: number; rank: number; w: number }> = {
  sandal: { name: 'Sandal', cost: 0, speed: 1, rank: 1, w: 70 },
  motor: { name: 'Balıkçı teknesi', cost: 300, speed: 1.6, rank: 2, w: 84 },
  gulet: { name: 'Gulet', cost: 900, speed: 2.2, rank: 3, w: 92 },
  yat: { name: 'Motor yat', cost: 2500, speed: 3, rank: 4, w: 104 },
};
export const ISLANDS = [
  {
    id: 'liman',
    name: 'Balıkçı Limanı',
    art: 'ada4',
    x: 0.26,
    y: 0.84,
    w: 124,
    need: 1,
    camp: false,
    fish: ['cipura', 'barbun'] as FishId[],
    line: 'Tekneniz burada bağlı. Yolculuk buradan başlar.',
  },
  {
    id: 'kumlu',
    name: 'Kumlu Koy',
    art: 'ada1',
    x: 0.74,
    y: 0.66,
    w: 112,
    need: 1,
    camp: true,
    fish: ['cipura', 'barbun', 'levrek'] as FishId[],
    line: 'Sığ, berrak su. Gün batımı çok güzel.',
  },
  {
    id: 'gizli',
    name: 'Gizli Koy',
    art: 'ada2',
    x: 0.26,
    y: 0.5,
    w: 128,
    need: 2,
    camp: true,
    fish: ['levrek', 'barbun', 'ahtapot'] as FishId[],
    line: 'Kayaların arkasında saklı bir kumsal.',
  },
  {
    id: 'zeytin',
    name: 'Zeytinli Ada',
    art: 'ada3',
    x: 0.73,
    y: 0.34,
    w: 134,
    need: 3,
    camp: false,
    fish: ['levrek', 'cipura', 'ahtapot'] as FishId[],
    line: 'Zeytin ağaçları arasında küçük beyaz bir ev.',
  },
  {
    id: 'fener',
    name: 'Fener Burnu',
    art: 'fener',
    x: 0.3,
    y: 0.17,
    w: 70,
    need: 4,
    camp: false,
    fish: ['ahtapot', 'levrek'] as FishId[],
    line: 'Açık denizin kıyısı. Yalnızca motor yatla gidilir.',
  },
];
export type IslandId = (typeof ISLANDS)[number]['id'];
export const FISH: Record<FishId, { name: string; sell: number }> = {
  cipura: { name: 'Çipura', sell: 12 },
  levrek: { name: 'Levrek', sell: 15 },
  barbun: { name: 'Barbun', sell: 10 },
  ahtapot: { name: 'Ahtapot', sell: 30 },
};
export const CASTS_PER_DAY = 5;
export const CAMP_COST = 40;

export type Memory = { t: string; at: number; art: string };
export type Sea = {
  boat: BoatId;
  at: string;
  trip: { from: string; to: string; start: number; end: number; by: string } | null;
  visited: Record<string, boolean>;
  camps: Record<string, boolean>;
  casts: Record<string, { day: string; n: number }>; // kişi başına günlük olta hakkı
  catch: Partial<Record<FishId, number>>;
  sunset: { at: string; day: string; by: string; joined?: boolean } | null; // biri davet eder, diğeri katılır
  mem: Memory[];
};

export const island = (id: string) => ISLANDS.find((i) => i.id === id) ?? ISLANDS[0];
export function newSea(): Sea {
  return { boat: 'sandal', at: 'liman', trip: null, visited: { liman: true }, camps: {}, casts: {}, catch: {}, sunset: null, mem: [] };
}
// Yolculuk bittiyse varış yerini işler (okurken).
export function seaOf(c: Couple | null | undefined, now = Date.now()): Sea {
  const s: Sea = { ...newSea(), ...((c?.sea as Sea | undefined) ?? {}) };
  if (s.trip && now >= s.trip.end) {
    const to = s.trip.to;
    s.mem = s.visited[to] ? s.mem : [{ t: `${island(to).name}’ya ilk kez vardınız`, at: s.trip.end, art: island(to).art }, ...s.mem];
    s.visited = { ...s.visited, [to]: true };
    s.at = to;
    s.trip = null;
  }
  return s;
}
// Haritada iki ada arası mesafeye göre dakika (0-1 koordinatlarında).
export function tripMins(sea: Sea, from: string, to: string) {
  const a = island(from);
  const b = island(to);
  const d = Math.hypot((a.x - b.x) * 366, (a.y - b.y) * 600);
  return Math.max(10, Math.round((d * 0.45) / BOATS[sea.boat].speed));
}
export function castsLeft(sea: Sea, uid: string) {
  const c = sea.casts[uid];
  return CASTS_PER_DAY - (c && c.day === dayKey() ? c.n : 0);
}

export type SeaAction =
  | { a: 'sail'; to: string }
  | { a: 'fish'; fish: FishId | null } // null: kaçtı (yine de hak düşer)
  | { a: 'camp' }
  | { a: 'sunset' }
  | { a: 'boat'; boat: BoatId };

// ---------- Sahilde Ev ----------

export const HN = 6;
export const HOUSE_LV = [
  { name: 'Küçük beyaz ev', art: 'ev1', cost: 0 },
  { name: 'İki katlı taş ev', art: 'ev2', cost: 400 },
  { name: 'Begonvilli villa', art: 'ev3', cost: 1200 },
];
export type HItemId = 'masa' | 'zeytin' | 'sezlong' | 'semsiye' | 'hamak' | 'pergola' | 'mangal' | 'bisiklet' | 'kedi' | 'havuz';
export const HITEMS: Record<HItemId, { name: string; cost: number; w: number; lvl: number; rit?: string; gain?: number }> = {
  masa: { name: 'Kahve masası', cost: 50, w: 0.85, lvl: 1, rit: 'Sabah kahvesi', gain: 15 },
  zeytin: { name: 'Zeytin ağacı', cost: 40, w: 0.75, lvl: 1 },
  sezlong: { name: 'Şezlong', cost: 45, w: 0.85, lvl: 1, rit: 'Güneşlenmek', gain: 6 },
  semsiye: { name: 'Plaj şemsiyesi', cost: 35, w: 0.85, lvl: 1 },
  hamak: { name: 'Hamak', cost: 60, w: 0.95, lvl: 1, rit: 'Hamakta kitap', gain: 8 },
  pergola: { name: 'Begonvil pergola', cost: 80, w: 1.0, lvl: 1 },
  mangal: { name: 'Mangal', cost: 100, w: 0.7, lvl: 2, rit: 'Mangal akşamı', gain: 20 },
  bisiklet: { name: 'Bisiklet', cost: 90, w: 0.85, lvl: 2, rit: 'Sahilde bisiklet turu', gain: 12 },
  kedi: { name: 'Kedi', cost: 120, w: 0.5, lvl: 2, rit: 'Kediyi sevmek', gain: 4 },
  havuz: { name: 'Havuz', cost: 600, w: 1.25, lvl: 3, rit: 'Havuzda serinlemek', gain: 10 },
};
export type HTile = { k: 'fixed' } | { k: 'terrace' } | { k: 'grass' } | { k: 'item'; item: HItemId };
// rit: anahtar kare; ilk kişi başlatır, ikincisi gelince ödül verilir. done: o gün tamamlandı.
export type Home = {
  lvl: number;
  tiles: HTile[];
  huzur: number;
  rit: Record<string, { day: string; by: string[] }>;
  pos: Record<string, number>;
};

const isTerrace = (i: number) => Math.floor(i / HN) === 2 || i % HN === 2;
export function newHome(): Home {
  const tiles: HTile[] = Array.from({ length: HN * HN }, (_, i) => {
    const r = Math.floor(i / HN);
    const c = i % HN;
    if (r < 2 && c < 2) return { k: 'fixed' };
    return isTerrace(i) ? { k: 'terrace' } : { k: 'grass' };
  });
  tiles[2 * HN + 3] = { k: 'item', item: 'masa' };
  tiles[3] = { k: 'item', item: 'zeytin' };
  return { lvl: 1, tiles, huzur: 0, rit: {}, pos: {} };
}
export function homeOf(c: Couple | null | undefined): Home {
  const h = c?.home as Home | undefined;
  return h ? { ...newHome(), ...h, rit: h.rit ?? {}, pos: h.pos ?? {} } : newHome();
}
export const ritualState = (h: Home, i: number) => {
  const r = h.rit[`${i}`];
  return r && r.day === dayKey() ? r.by : [];
};

export type HomeAction =
  { a: 'place'; i: number; item: HItemId } | { a: 'remove'; i: number } | { a: 'ritual'; i: number } | { a: 'upgrade' };

// ---------- işlem ----------

const clean = <T>(x: T): T => JSON.parse(JSON.stringify(x));

type Out = { text: string; gained?: number; joined?: boolean; started?: boolean };

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
      out = seaApply(s, act.x, uid, name, now, farm, pay);
      if (typeof out !== 'string') tx.update(ref, { sea: clean(s), farm: clean(farm) });
    } else {
      const h = homeOf(c);
      out = homeApply(h, act.x, uid, name, farm, pay);
      if (typeof out !== 'string') tx.update(ref, { home: clean(h), farm: clean(farm) });
    }
    return out;
  });
}

function seaApply(s: Sea, x: SeaAction, uid: string, name: string, now: number, farm: Farm, pay: (n: number) => boolean): Out | string {
  const here = island(s.at);
  switch (x.a) {
    case 'sail': {
      if (s.trip) return 'Tekne zaten yolda.';
      const to = island(x.to);
      if (to.id === s.at) return 'Zaten buradasınız.';
      if (BOATS[s.boat].rank < to.need) return 'Bu koy için daha büyük tekne lazım.';
      s.trip = { from: s.at, to: to.id, start: now, end: now + tripMins(s, s.at, to.id) * MIN, by: uid };
      return { text: `${name} ${to.name} yoluna çıktı ⛵` };
    }
    case 'fish': {
      if (s.trip) return 'Yoldayken balık tutulmaz.';
      if (castsLeft(s, uid) <= 0) return 'Bugünkü olta hakkın bitti.';
      const c = s.casts[uid];
      s.casts[uid] = { day: dayKey(), n: (c && c.day === dayKey() ? c.n : 0) + 1 };
      if (!x.fish) return { text: 'Kaçtı' };
      if (!here.fish.includes(x.fish) && x.fish !== 'ahtapot') return 'Bu koyda o balık yok.';
      const f = FISH[x.fish];
      s.catch[x.fish] = (s.catch[x.fish] ?? 0) + 1;
      if (s.catch[x.fish] === 1) s.mem = [{ t: `İlk ${f.name.toLowerCase()} ${here.name}’da tutuldu`, at: now, art: x.fish }, ...s.mem];
      farm.coins += f.sell;
      return { text: `${name} ${f.name.toLowerCase()} tuttu (+${f.sell})`, gained: f.sell };
    }
    case 'camp': {
      if (!here.camp || s.camps[here.id]) return 'Burada kamp kurulamaz.';
      if (!pay(CAMP_COST)) return 'Yeterli altın yok.';
      s.camps[here.id] = true;
      s.mem = [{ t: `${here.name}’da kamp ateşi yaktınız`, at: now, art: 'ates' }, ...s.mem];
      return { text: `${name} ${here.name}’da kamp kurdu 🔥` };
    }
    case 'sunset': {
      const day = dayKey();
      const sn = s.sunset;
      if (sn && sn.day === day && sn.at === here.id) {
        if (sn.joined) return 'Bugün bu gün batımını izlediniz.';
        if (sn.by === uid) return 'Partnerinin gelmesini bekliyorsun.';
        s.sunset = { ...sn, joined: true };
        s.mem = [{ t: `${here.name}’da birlikte gün batımı`, at: now, art: 'gunbatimi' }, ...s.mem];
        farm.xp += 5;
        farm.coins += 20;
        return { text: `${name} gün batımına geldi 🌅`, gained: 20, joined: true };
      }
      s.sunset = { at: here.id, day, by: uid };
      return { text: `${name} seni ${here.name}’da gün batımına çağırıyor 🌅`, started: true };
    }
    case 'boat': {
      const b = BOATS[x.boat];
      if (b.rank !== BOATS[s.boat].rank + 1) return 'Önce bir önceki tekne alınmalı.';
      if (!pay(b.cost)) return 'Yeterli altın yok.';
      s.boat = x.boat;
      s.mem = [{ t: `Yeni tekne: ${b.name}`, at: now, art: x.boat }, ...s.mem];
      return { text: `${name} ${b.name} aldı ⚓` };
    }
  }
}

function homeApply(h: Home, x: HomeAction, uid: string, name: string, farm: Farm, pay: (n: number) => boolean): Out | string {
  switch (x.a) {
    case 'place': {
      const t = h.tiles[x.i];
      const it = HITEMS[x.item];
      if (!t || (t.k !== 'grass' && t.k !== 'terrace')) return 'Önce boş bir yer seç.';
      if (h.lvl < it.lvl) return `${it.name} için ${HOUSE_LV[it.lvl - 1].name} lazım.`;
      if (!pay(it.cost)) return 'Yeterli altın yok.';
      h.tiles[x.i] = { k: 'item', item: x.item };
      h.pos[uid] = x.i;
      return { text: `${name} eve ${it.name.toLowerCase()} aldı` };
    }
    case 'remove': {
      const t = h.tiles[x.i];
      if (t?.k !== 'item') return 'Kaldırılacak bir şey yok.';
      farm.coins += Math.floor(HITEMS[t.item].cost / 2);
      h.tiles[x.i] = isTerrace(x.i) ? { k: 'terrace' } : { k: 'grass' };
      return { text: `${name} bir eşyayı kaldırdı` };
    }
    case 'upgrade': {
      const next = HOUSE_LV[h.lvl];
      if (!next) return 'Eviniz zaten villa.';
      if (!pay(next.cost)) return 'Yeterli altın yok.';
      h.lvl += 1;
      return { text: `Yeni eviniz: ${next.name} 🏡` };
    }
    case 'ritual': {
      const t = h.tiles[x.i];
      if (t?.k !== 'item' || !HITEMS[t.item].rit) return 'Bu eşyayla bir şey yapılmaz.';
      const it = HITEMS[t.item];
      const by = ritualState(h, x.i);
      if (by.includes(uid)) return by.length >= 2 ? `Bugün “${it.rit!.toLowerCase()}” yaptınız.` : 'Partnerinin gelmesini bekliyorsun.';
      h.rit[`${x.i}`] = { day: dayKey(), by: [...by, uid] };
      h.pos[uid] = x.i;
      if (by.length === 1) {
        farm.coins += it.gain!;
        h.huzur += 1;
        return { text: `${it.rit}: ikiniz de geldiniz 💛 +${it.gain} altın`, gained: it.gain, joined: true };
      }
      return { text: `${name} seni ${it.rit!.toLowerCase()} için çağırıyor 💛`, started: true };
    }
  }
}
