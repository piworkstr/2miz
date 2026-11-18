import { Wall } from '../components/world/Wall';
import { WALL_BOX, type WallKind } from '../lib/wallArt';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import {
  Animated,
  AppState,
  Dimensions,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useKeyboardTop } from '../components/KeyboardSpace';
import { TourOnce } from '../components/Tour';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, LinearGradient, Path, Pattern, Polygon, Rect, Stop } from 'react-native-svg';
import { Avatar } from '../components/Avatar';
import { ScenePanel, type SceneMeta } from '../components/world/ScenePanel';
import { WorldChar } from '../components/world/WorldChar';
import {
  ANIMALS,
  animalReady,
  bigReady,
  BUILDINGS,
  buildingFor,
  canGive,
  CROPS,
  cropReady,
  DECOR,
  collectDreamBank,
  farmAction,
  farmFlush,
  farmOf,
  barnTile,
  FIXED_ANCHOR,
  pileTile,
  isWeekend,
  levelOf,
  MARKET_BONUS,
  MIN,
  N,
  OFF,
  INNER,
  isOuter,
  outerPrice,
  NOTE_MAX,
  NOTE_TREE,
  NOTES_PER_DAY,
  notesToday,
  orderLeft,
  parcelNeed,
  parcelOf,
  parcelTiles,
  PRODUCT_NAME,
  BASKETS,
  giftWait,
  hasAll,
  needsText,
  RECIPES,
  STOCK_EMOJI,
  type BasketId,
  type RecipeId,
  productNames,
  PRODUCTS,
  productValue,
  residentReady,
  residentReadyAt,
  needsFeed,
  rc,
  restNear,
  type FarmLog,
  readyTiles,
  SEASON_NAME,
  seasonOf,
  stockCount,
  stockValue,
  TILL,
  PAVE,
  STATIONS,
  stationJobs,
  stationOf,
  stationSlots,
  type Station,
  BLOOM,
  timeLeft,
  treeReady,
  treeReadyAt,
  TREES,
  type Action,
  type AnimalId,
  type BuildingId,
  type CropId,
  type DecorId,
  type Farm,
  type Order,
  type Season,
  type Tile,
  type TreeId,
  applyAction,
  orderWho,
  sourceOf,
} from '../lib/farm';
import { randomArt } from '../lib/avatarArt';
import { liveFresh, overlayFarm, publishLive, usePartnerLive } from '../lib/farmLive';
import type { Profile } from '../lib/session';
import { logActivityCapped } from '../lib/bond';
import { FarmBonusGift } from '../components/world/FarmBonusGift';
import { FarmMarket } from '../components/world/FarmMarket';
import { settleMine } from '../lib/market';
import { useFarmBonuses } from '../lib/farm';
import type { FarmBonus } from '../lib/farmBonus';
import { ART } from '../lib/farmArt';
import { finishScene, startScene, useOpenScene, type Scene } from '../lib/scenes';
import { useSession } from '../lib/session';

// Bizim Çiftlik: 2.5D ortak çiftlik. Bütün arazi tek ekranda; avatarın dokunduğun kareye yürüyüp işi yapar.
// Partnerinin avatarı en son çalıştığı yerde durur, o bir şey yapınca oraya yürür.
// İki kişilik sahneler: Hasat günü (büyük ürünler) ve hafta sonu Pazar. Depo ahırın önünde yığın olarak görünür.

export const FARM_SCENES: Record<string, SceneMeta> = {
  harvest: { title: 'Hasat günü', verb: 'hasadı birlikte kaldırmak', reward: { coins: 15 } },
  market: { title: 'Pazar', verb: 'pazarda tezgâh kurmak', reward: { coins: 10 } },
};
// Ahırın önündeki kare: depo işlerinde (satış, teslim) avatar buraya yürür.

const TW = 64;
const TH = TW / 2;
const OX = (N * TW) / 2 + TW * 2;
const OY = TW * 2.6;
const WW = N * TW + TW * 4;
const WH = OY + N * TH + TW * 5;
const center = (r: number, c: number) => ({ x: OX + ((c - r) * TW) / 2, y: OY + ((c + r) * TH) / 2 });
const zOf = (r: number, c: number) => (r + c) * 10;
const stand = (i: number, side: number) => {
  const [r, c] = rc(i);
  const { x, y } = center(r, c);
  return { x: x + side * TW * 0.32, y: y + TH * 0.36, z: zOf(r, c) + 8 };
};
function tileAt(px: number, py: number) {
  const dx = (px - OX) / (TW / 2);
  const dy = (py - OY) / (TH / 2);
  const c = Math.round((dy + dx) / 2);
  const r = Math.round((dy - dx) / 2);
  return r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1;
}
// Bütün arazi (satılıklar dahil) ve evin çatısı ekrana sığsın.
// Manzara: tabaka resmin ortasındaki açıklığa oturur. Resimde açıklık 1280×720'de x 429–957, y 200–514 (merkez 693,357).
// Açıklık tabakadan %10 geniş olsun diye ölçek: 640·1.1 / 528.
const BG_K = (N * TW * 1.1) / 528;
const BG = (() => {
  const c = center((N - 1) / 2, (N - 1) / 2);
  return { x: c.x - 693 * BG_K, y: c.y - 357 * BG_K, w: 1280 * BG_K, h: 720 * BG_K };
})();
const SKY = '#99BDDA';
const FAR = '#7E8F46';

// Varsayılan görünüm iç çiftliğe (10x10) sığar; dış araziler sürükleyerek gezilir.
const BOUNDS = {
  x0: center(OFF + INNER - 1, OFF).x - TW / 2 - 4,
  x1: center(OFF, OFF + INNER - 1).x + TW / 2 + 4,
  y0: center(OFF, OFF).y - TH / 2 - TW * 1.7,
  y1: center(OFF + INNER - 1, OFF + INNER - 1).y + TH / 2 + TW * 0.4,
};
// Bütün arazi (22x22): sürükleme buraya kadar
const FULL = {
  x0: center(N - 1, 0).x - TW / 2,
  x1: center(0, N - 1).x + TW / 2,
  y0: OY - TH / 2 - TW * 1.2,
  y1: center(N - 1, N - 1).y + TH / 2 + TW * 0.4,
};

const GRASS = '#A9D46C';
const GREEN = '#5FA83A';
const INK = '#2B1D22';
const MUTED = '#8A7479';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Shop = 'crop' | 'animal' | 'building' | 'workshop' | 'tree' | 'decor';
// Dükkandan seçilen, yere konacak şey: sonraki dokunuş o kareye yerleştirir.
type Placing =
  | { a: 'plant'; crop: CropId }
  | { a: 'build'; item: BuildingId }
  | { a: 'tree'; item: TreeId }
  | { a: 'decor'; item: DecorId }
  | { a: 'move'; from: number } // yerleştirilmiş bir şeyi taşı
  | { a: 'pave' } // patika döşe: kapatılana kadar her dokunuş bir kare döşer
  | { a: 'moveBarn' }; // depoyu (2x2) taşı
type Spr = {
  key: string;
  art: string;
  x: number;
  y: number;
  w: number;
  z: number;
  o?: number;
  wall?: { kind: WallKind; mask: number; flowers?: boolean };
};

// Binaların içi: hayvanların ayak noktaları (kaynak çizimin pikselinde, arkadan öne sıralı) ve çizimdeki genişlikleri.
const PENS: Partial<Record<string, { sw: number; sh: number; slots: [number, number][]; px: Record<string, number> }>> = {
  agil: {
    sw: 431,
    sh: 426,
    slots: [
      [92, 302],
      [222, 314],
      [160, 330],
    ],
    px: { koyun: 76, inek: 92 },
  },
  kumes: {
    sw: 412,
    sh: 407,
    slots: [
      [318, 300],
      [346, 332],
      [226, 352],
    ],
    px: { tavuk: 46 },
  },
};

function sprites(f: Farm, now: number): Spr[] {
  const barnAt = barnTile(f);
  const out: Spr[] = [];
  f.tiles.forEach((t, i) => {
    const [r, c] = rc(i);
    const { x, y } = center(r, c);
    const base = { x, y: y + TH / 2 + TW * 0.11, z: zOf(r, c) + 5, w: TW * 1.02 };
    const up = { x, y: y + TH * 0.32, z: zOf(r, c) + 6 };
    // Sürülmüş toprak yere yapışık bir çizim: hiçbir şeyi örtmemeli, bu yüzden zeminin hemen üstünde (en altta) çizilir;
    // kendi aralarında arkadan öne sıralı kalsınlar diye küçük bir kesir eklenir.
    if (t.k === 'soil') out.push({ key: `s${i}`, art: 'soil', ...base, z: 3 + (r + c) / 1000 });
    if (t.k === 'crop') {
      const p = Math.min(1, (now - t.at) / Math.max(1, t.ready - t.at));
      out.push({ key: `s${i}`, art: cropReady(t, now) ? t.crop : p < 0.35 ? 'sprout' : 'young', ...base });
    }
    if (t.k === 'animal') out.push({ key: `s${i}`, art: t.item, ...up, w: TW * ANIMALS[t.item].w });
    if (t.k === 'tree') out.push({ key: `s${i}`, art: ART[t.item] ? t.item : 'tree', ...up, w: TW * TREES[t.item].w });
    if (t.k === 'building') {
      const bw = TW * BUILDINGS[t.item].w;
      const by = up.y + TH * 0.25;
      out.push({ key: `s${i}`, art: t.item, ...up, y: by, w: bw });
      const pen = PENS[t.item];
      if (pen) {
        // Hayvanlar binanın içinde durur: çizimdeki yerlerine konur, ön çit üstlerine yeniden çizilir.
        const bh = bw * ART[t.item].h;
        t.res.forEach((r, k) => {
          const [sx, sy] = pen.slots[k % pen.slots.length];
          out.push({
            key: `s${i}r${k}`,
            art: r.id,
            x: up.x - bw / 2 + (sx / pen.sw) * bw,
            y: by - bh + (sy / pen.sh) * bh,
            z: up.z + 1 + sy / 1000,
            w: ((pen.px[r.id] ?? 60) / pen.sw) * bw,
          });
        });
        out.push({ key: `s${i}on`, art: `${t.item}_on`, ...up, y: by, z: up.z + 2, w: bw });
      }
    }
    if (t.k === 'decor') {
      const wall = DECOR[t.item].wall;
      if (wall) {
        // Aynı türden komşularla birleşir: 1 arka sağ, 2 ön sağ, 4 ön sol, 8 arka sol.
        const same = (rr: number, cc: number) => {
          if (rr < 0 || cc < 0 || rr >= N || cc >= N) return false;
          const q = f.tiles[rr * N + cc];
          return q?.k === 'decor' && DECOR[q.item].wall === wall; // çiçekli ve düz olan da birleşir
        };
        const mask = (same(r - 1, c) ? 1 : 0) | (same(r, c + 1) ? 2 : 0) | (same(r + 1, c) ? 4 : 0) | (same(r, c - 1) ? 8 : 0);
        out.push({ key: `s${i}`, art: 'fence', x, y, z: zOf(r, c) + 6, w: TW, wall: { kind: wall, mask, flowers: DECOR[t.item].flowers } });
      } else out.push({ key: `s${i}`, art: DECOR[t.item].sp, ...up, w: TW * DECOR[t.item].w });
    }
    if (i === GIFT_TILE && ART.sepet) out.push({ key: 'sepet', art: 'sepet', ...up, y: up.y + TH * 0.2, w: TW * 0.95 });
    if (t.k === 'fixed') {
      const [ar, ac] = t.item === 'barn' ? rc(barnAt) : FIXED_ANCHOR.house;
      if (r === ar && c === ac) {
        const a = center(ar, ac);
        const back = center(ar - 1, ac - 1);
        out.push({ key: `s${i}`, art: t.item, x: (a.x + back.x) / 2, y: a.y + TH * 0.55, z: zOf(ar, ac) + 6, w: TW * 2.05 });
      }
    }
  });
  return out;
}

// Çiftliğin çevresi: yalnızca süs.
// Sipariş posta kutusu: çiftliğin ön (sol alt) kenarının hemen dışında, toprak yolun başında sabit durur.
// Dokununca sipariş defteri açılır; teslim edilen siparişin sahibi çift yoldan yürüyerek buraya gelir.
const MAIL = (() => {
  const B = center(N - 1, N - 1);
  return { x: B.x - TW * 1.25, y: B.y + TH / 2 - TW * 0.15, z: zOf(N, N) + 40, w: TW * 0.72 };
})();
const MAIL_FROM = { x: MAIL.x - TW * 0.25, y: MAIL.y + TW * 4 }; // yolun aşağısı: müşteriler buradan gelir, buraya döner
const mailHit = (wx: number, wy: number) => Math.abs(wx - MAIL.x) < TW * 0.45 && wy < MAIL.y + TW * 0.15 && wy > MAIL.y - TW * 1.75;
// Bekleyen çiftlerin yeri: posta kutusunun solunda, kenar boyunca yan yana (en çok 3 sipariş).
const visitSlot = (k: number) => {
  const dx = -(1.2 + 1.45 * k) * TW;
  return { x: MAIL.x + dx, y: MAIL.y + dx * 0.5 + TW * 0.18 };
};
const visitHit = (k: number, wx: number, wy: number) => {
  const p = visitSlot(k);
  return Math.abs(wx - p.x) < TW * 0.78 && wy < p.y + TW * 0.25 && wy > p.y - TW * 1.9;
};
// Teslim sırasında avatarın yürüdüğü kare: girişe en yakın köşe.
const VISIT_TILE = (N - 1) * N + (N - 3);
type Leaving = { id: string; who: string; slot: number };
// Her siparişin çifti aynı görünsün diye yüzler sipariş kimliğiyle saklanır.
const visitFaces = new Map<string, { f: Profile; m: Profile }>();
const facesOf = (id: string) => {
  let v = visitFaces.get(id);
  if (!v) {
    const mk = (g: 'f' | 'm') => ({ gender: g, avatar: { kind: 'art', opts: randomArt(g) } }) as unknown as Profile;
    v = { f: mk('f'), m: mk('m') };
    visitFaces.set(id, v);
  }
  return v;
};

const SCENERY: Spr[] = (() => {
  const L = center(N - 1, 0);
  const R = center(0, N - 1);
  const T = center(0, 0);
  const B = center(N - 1, N - 1);
  const btm = B.y + TH / 2;
  const s = (art: string, x: number, y: number, w: number, z: number, k: number): Spr => ({ key: `sc${k}`, art, x, y, w, z });
  return [
    { key: 'mail', art: 'posta', x: MAIL.x, y: MAIL.y, w: MAIL.w, z: MAIL.z },
    s('tree', T.x - TW * 1.4, T.y + TW * 0.1, TW * 1.3, 1, 1),
    s('tree', T.x + TW * 1.6, T.y - TW * 0.3, TW * 1.1, 1, 2),
    s('tree', L.x - TW * 0.9, L.y - TW * 0.2, TW * 1.4, 1, 3),
    s('tree', R.x + TW * 0.9, R.y - TW * 0.1, TW * 1.5, 1, 4),
    s('tree', L.x - TW * 0.2, L.y + TW * 1.0, TW * 1.2, 2000, 5),
    s('tree', R.x + TW * 0.3, R.y + TW * 1.1, TW * 1.2, 2000, 6),
    s('fence', L.x + TW * 2.6, btm - TW * 0.6, TW * 0.9, 2000, 7),
    s('fence', L.x + TW * 3.4, btm - TW * 0.2, TW * 0.9, 2000, 8),
  ];
})();

function SpriteImg({ s }: { s: Spr }) {
  const a = ART[s.art];
  if (s.wall)
    return (
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: s.x - WALL_BOX.cx, top: s.y - WALL_BOX.cy, zIndex: Math.floor(s.z), opacity: s.o ?? 1 }}
      >
        <Wall kind={s.wall.kind} mask={s.wall.mask} flowers={s.wall.flowers} />
      </View>
    );
  if (!a) return null;
  const h = s.w * a.h;
  return (
    <Image
      source={a.src}
      style={{ position: 'absolute', left: s.x - s.w / 2, top: s.y - h, width: s.w, height: h, zIndex: Math.floor(s.z), opacity: s.o ?? 1 }}
    />
  );
}

// Siparişi almaya gelen çift. 'wait': yoldan yürüyüp girişte bekler, üstlerinde sepet balonu zıplar (dokununca teslim).
// 'thanks': sepeti alır, sevinçle zıplayıp teşekkür eder, sonra yoldan geri döner.
function Visitors({
  id,
  who,
  slot,
  mode,
  walkIn,
  onGone,
}: {
  id: string;
  who: string;
  slot: number;
  mode: 'wait' | 'thanks';
  walkIn: boolean;
  onGone?: () => void;
}) {
  const faces = facesOf(id);
  // Yeni hazırlanan siparişte ilk karede yolun aşağısında belirirler; hedef sonraki karede verilir ki yürüyerek gelsinler.
  const [started, setStarted] = useState(!walkIn);
  const [here, setHere] = useState(!walkIn);
  const [going, setGoing] = useState(false);
  useEffect(() => {
    if (started) return;
    const t = setTimeout(() => setStarted(true), 60);
    return () => clearTimeout(t);
  }, [started]);
  useEffect(() => {
    if (mode !== 'thanks') return;
    const t = setTimeout(() => setGoing(true), 2400);
    return () => clearTimeout(t);
  }, [mode]);
  // Bekleme balonu: hafifçe zıplar.
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -6, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const p = visitSlot(slot);
  const at = started && !going;
  const fx = at ? p.x - TW * 0.3 : MAIL_FROM.x - TW * 0.25;
  const mx = at ? p.x + TW * 0.32 : MAIL_FROM.x + TW * 0.3;
  const y = at ? p.y : MAIL_FROM.y;
  const z = MAIL.z + 20 - slot * 2;
  const thanks = mode === 'thanks' && !going;
  const basket =
    mode === 'thanks' ? (
      <Image source={ART.sepet_dolu.src} style={{ position: 'absolute', left: 40, top: 34, width: 24, height: 23 }} resizeMode="contain" />
    ) : null;
  return (
    <>
      <WorldChar profile={faces.f} name={who} x={fx} y={y} z={z} hop={thanks} say={thanks ? 'Teşekkürler!' : undefined} />
      <WorldChar
        profile={faces.m}
        name={who}
        x={mx}
        y={y + 3}
        z={z + 1}
        hop={thanks}
        tag={going ? undefined : who}
        tool={basket}
        onArrive={() => {
          if (!started) return;
          if (going) onGone?.();
          else setHere(true);
        }}
      />
      {mode === 'wait' && here && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: p.x - 19,
            top: p.y - 128,
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: '#fff',
            borderWidth: 2,
            borderColor: GREEN,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9000,
            transform: [{ translateY: bob }],
          }}
        >
          <Image source={ART.sepet_dolu.src} style={{ width: 24, height: 23 }} resizeMode="contain" />
        </Animated.View>
      )}
      {thanks && (
        <View pointerEvents="none" style={{ position: 'absolute', left: p.x - 12, top: p.y - 112, zIndex: 9000 }}>
          <Ionicons name="heart" size={24} color="#E8516A" />
        </View>
      )}
    </>
  );
}

function Ground({ f, sel, season }: { f: Farm; sel: number | null; season: Season }) {
  const pts = (r: number, c: number) => {
    const { x, y } = center(r, c);
    return `${x},${y - TH / 2} ${x + TW / 2},${y} ${x},${y + TH / 2} ${x - TW / 2},${y}`;
  };
  const L = center(N - 1, 0);
  const B = center(N - 1, N - 1);
  const R = center(0, N - 1);
  const btm = B.y + TH / 2;
  const D = 18;
  const lx = L.x - TW / 2;
  const rx = R.x + TW / 2;
  // sel arazinin dışına düşebilir (ör. sürüklenen binanın çatısından tutulduğunda): o zaman vurgu yok.
  const hiTiles = sel === null || !f.tiles[sel] ? [] : f.tiles[sel].k === 'locked' ? parcelTiles(f, sel) : [sel];
  return (
    <Svg width={WW} height={WH} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <Pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <Rect width="3" height="7" fill="#5D8A36" />
        </Pattern>
      </Defs>
      {/* Tabakanın altına yumuşak gölge: manzaraya oturur */}
      <Ellipse cx={B.x} cy={btm + D - 2} rx={TW * N * 0.4} ry={TW * N * 0.08} fill="rgba(40,60,20,0.18)" />
      <Polygon points={`${lx},${L.y} ${B.x},${btm} ${B.x},${btm + D} ${lx},${L.y + D}`} fill="#8B5E34" />
      <Polygon points={`${B.x},${btm} ${rx},${R.y} ${rx},${R.y + D} ${B.x},${btm + D}`} fill="#6E4625" />
      {f.tiles.map((t, i) => {
        const [r, c] = rc(i);
        const g =
          season === 'kis'
            ? ['#EEF4EC', '#E4ECE2', '#C9D6C6', '#BFCDBC']
            : season === 'guz'
              ? ['#B3C65B', '#A9BC52', '#8E9F45', '#869841']
              : ['#93CB57', '#8BC34F', '#74A146', '#6E9A42'];
        const fill = t.k === 'path' ? '#D9CDB4' : t.k === 'locked' ? g[(r + c) % 2 ? 2 : 3] : g[(r + c) % 2 ? 0 : 1];
        return (
          <Polygon key={i} points={pts(r, c)} fill={fill} stroke={t.k === 'path' ? '#C9BC9F' : 'rgba(255,255,255,0.08)'} strokeWidth={1} />
        );
      })}
      {f.tiles.map((t, i) => {
        const [r, c] = rc(i);
        if (t.k === 'locked') return <Polygon key={`h${i}`} points={pts(r, c)} fill="url(#hatch)" opacity={0.45} />;
        if (t.k === 'grass' && season === 'bahar' && i % 3 === 0) {
          const { x, y } = center(r, c);
          return (
            <Path
              key={`h${i}`}
              d={`M${x - 12},${y + 2} a2.2,2.2 0 1,0 4.4,0 a2.2,2.2 0 1,0 -4.4,0 M${x + 8},${y - 4} a2.2,2.2 0 1,0 4.4,0 a2.2,2.2 0 1,0 -4.4,0 M${x + 1},${y + 7} a1.8,1.8 0 1,0 3.6,0 a1.8,1.8 0 1,0 -3.6,0`}
              fill={i % 2 ? '#FFD6E7' : '#FFF6B3'}
            />
          );
        }
        if (t.k === 'path') {
          const { x, y } = center(r, c);
          return (
            <Path
              key={`h${i}`}
              d={`M${x - 18},${y - 2} a9,4.5 0 1,0 18,0 a9,4.5 0 1,0 -18,0 M${x + 2},${y + 4} a8,4 0 1,0 16,0 a8,4 0 1,0 -16,0`}
              fill="#E8DEC8"
            />
          );
        }
        return null;
      })}
      {hiTiles.map((j) => (
        <Polygon
          key={`sel${j}`}
          points={pts(...rc(j))}
          fill="rgba(255,255,255,0.28)"
          stroke="#fff"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

// Kapalı her parselin ortasında küçük tabela: ortak hasatla açılır.
function Signs({ f }: { f: Farm }) {
  const groups = new Map<string, number[]>();
  f.tiles.forEach((t, i) => {
    if (t.k !== 'locked') return;
    const p = parcelOf(i);
    groups.set(p, [...(groups.get(p) ?? []), i]);
  });
  return (
    <>
      {[...groups.entries()].map(([p, ids]) => {
        const rs = ids.map((i) => rc(i)[0]);
        const cs = ids.map((i) => rc(i)[1]);
        const r = (Math.min(...rs) + Math.max(...rs)) / 2;
        const c = (Math.min(...cs) + Math.max(...cs)) / 2;
        const { x, y } = center(r, c);
        return (
          <Svg
            key={p}
            width={32}
            height={36}
            viewBox="0 0 32 36"
            style={{ position: 'absolute', left: x - 16, top: y + 4 - 36, zIndex: Math.round((r + c) * 10) + 6 }}
          >
            <Rect x={14.5} y={14} width={3} height={22} fill="#7A4E2A" />
            <Rect x={2} y={2} width={28} height={16} rx={3} fill="#C88A4E" stroke="#7A4E2A" strokeWidth={1.5} />
            <Ellipse cx={10} cy={10} rx={4.5} ry={4.5} fill="#8BC34F" stroke="#4F7F2A" />
            <Path d="M17 10h9 M21.5 5.5v9" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
          </Svg>
        );
      })}
    </>
  );
}

function Badge({ x, y, art, z, n, label }: { x: number; y: number; art: string; z: number; n?: number; label?: string }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -5, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    l.start();
    return () => l.stop();
  }, [bob]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 15,
        top: y - 15,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: z,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
        transform: [{ translateY: bob }],
      }}
    >
      <Image source={ART[art].src} style={{ width: 22, height: 22 }} resizeMode="contain" />
      {!!label && (
        <View style={{ position: 'absolute', top: 31, left: -25, width: 80, alignItems: 'center' }}>
          <Text
            maxFontSizeMultiplier={1.0}
            style={{
              backgroundColor: label === 'Yemle' ? '#B4521E' : label === 'Aç' ? '#E8516A' : '#2E7D4F',
              color: '#fff',
              fontWeight: '800',
              fontSize: 10,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            {label}
          </Text>
        </View>
      )}
      {!!n && (
        <View
          style={{
            position: 'absolute',
            right: -8,
            top: -6,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 4,
            backgroundColor: '#FFD23F',
            borderWidth: 1.5,
            borderColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 10, fontWeight: '900', color: '#5A3E00' }}>
            {n}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

function FloatText({ x, y, text, art }: { x: number; y: number; text: string; art?: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: art ? 1700 : 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [v, art]);
  const label = {
    color: '#fff',
    fontWeight: '900' as const,
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 3,
  };
  const move = {
    opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) }],
  };
  // Toplanan ürün: resmi ve adediyle birlikte yukarı süzülür (ne toplandığı belli olsun).
  if (art && ART[art])
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: x - 90,
            top: y,
            width: 180,
            zIndex: 4000,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          },
          move,
        ]}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#fff',
            borderWidth: 2,
            borderColor: GREEN,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image source={ART[art].src} style={{ width: 28, height: 28 }} resizeMode="contain" />
        </View>
        <Text maxFontSizeMultiplier={1.0} style={label}>
          {text}
        </Text>
      </Animated.View>
    );
  return (
    <Animated.Text
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - 40, top: y, width: 80, textAlign: 'center', zIndex: 4000 }, label, move]}
    >
      {text}
    </Animated.Text>
  );
}

const DOG_SPOTS = [22, 21, 12, 23, 34, 26, 2, 46].map((i) => center(...rc(i)));
function Dog() {
  const pos = useRef(new Animated.ValueXY(DOG_SPOTS[0])).current;
  const [flip, setFlip] = useState(false);
  const [z, setZ] = useState(50);
  useEffect(() => {
    let k = 0;
    let last = DOG_SPOTS[0];
    const id = setInterval(() => {
      k = (k + 1 + Math.floor(Math.random() * 3)) % DOG_SPOTS.length;
      const to = DOG_SPOTS[k];
      setFlip(to.x < last.x);
      setZ(Math.round(((to.y - OY) / (TH / 2)) * 10) + 7);
      Animated.timing(pos, { toValue: to, duration: 1600, easing: Easing.linear, useNativeDriver: true }).start();
      last = to;
    }, 5000);
    return () => clearInterval(id);
  }, [pos]);
  const w = TW * 0.55;
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, zIndex: z, transform: pos.getTranslateTransform() }}
    >
      <Image
        source={ART.dog.src}
        style={{
          position: 'absolute',
          left: -w / 2,
          top: -w * 1.2,
          width: w,
          height: w * ART.dog.h,
          transform: [{ scaleX: flip ? -1 : 1 }],
        }}
      />
    </Animated.View>
  );
}

export default function GardenScreen() {
  const insets = useSafeAreaInsets();
  // Klavye açılınca alt tabela klavyenin üstüne çıkar (Not Ağacı yazı alanı klavyenin altında kalıyordu).
  const kbTop = useKeyboardTop();
  const kbLift = Platform.OS === 'ios' && kbTop !== null ? Math.max(0, Dimensions.get('window').height - kbTop) : 0;
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  // Yönetimden gelen, açılmayı bekleyen hediye paketleri.
  const bonuses = useFarmBonuses(couple?.id);
  // Gösterilen paket açılınca listeden düşer; kutlama ekranı kapanana kadar elde tutulur. Kapatılan paket bu girişte yeniden çıkmaz.
  const [gift, setGift] = useState<FarmBonus | null>(null);
  const seenGifts = useRef(new Set<string>());
  useEffect(() => {
    if (gift) return;
    const next = bonuses.find((b) => !seenGifts.current.has(b.id));
    if (next) setGift(next);
  }, [bonuses, gift]);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [now, setNow] = useState(Date.now());
  const [sel, setSel] = useState<number | null>(null);
  const [shop, setShop] = useState<Shop>('crop');
  const [plantAll, setPlantAll] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  // true: sipariş defteri · 'ws': atölye listesi (ikisi de aynı alt tabelada açılır)
  const [showOrders, setShowOrders] = useState<boolean | 'ws'>(false);
  const [showShop, setShowShop] = useState(false);
  const [placing, setPlacing] = useState<Placing | null>(null);
  const placingRef = useRef<Placing | null>(null);
  placingRef.current = placing;
  // Basılı tutup sürükleme: ağaç/bina/süs/hayvan parmağın altında taşınır, bırakınca boş çimene konur.
  const [lift, setLift] = useState<{ from: number; wx: number; wy: number } | null>(null);
  const liftRef = useRef(lift);
  liftRef.current = lift;
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liftableRef = useRef<(i: number) => boolean>(() => false);
  // Dokunulan noktadaki nesne (çizim kutusuna göre): ağaç/bina gövdesine basınca arkadaki kare değil, nesnenin karesi gelir.
  const objectAtRef = useRef<(wx: number, wy: number) => number>(() => -1);
  const liftDropRef = useRef<(from: number, to: number) => void>(() => {});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [toast, setToast] = useState('');
  // Sürüklenen tohum: ekran konumu (pencereye göre) ve bu sürüklemede ekilen kareler.
  const [seed, setSeed] = useState<{ it: DragItem; x: number; y: number } | null>(null);
  const seedApi = useRef<SeedDragApi | null>(null);
  const seedDone = useRef(new Set<number>());
  const seedCoins = useRef(0);
  // Sürükleme boyunca tabela ve dükkân, başlangıçtaki çiftliği gösterir: ekilen kare yüzünden liste değişip parmağı bırakmasın.
  const seedFarm = useRef<Farm | null>(null);
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const rootOff = useRef({ x: 0, y: 0 });
  const [say, setSay] = useState('');
  const [tool, setTool] = useState<string | null>(null);
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string; art?: string }[]>([]);
  // Teslim alan çift: sipariş tamamlanınca yoldan posta kutusuna yürür, sepeti alır, döner.
  const [leaving, setLeaving] = useState<Leaving[]>([]);
  const seenPacked = useRef<Set<string> | null>(null);
  const visitTapRef = useRef<(wx: number, wy: number) => boolean>(() => false);
  const scene = useOpenScene(couple?.id, 'farm');

  // Canlı eşleşme: partnerin (ve benim) henüz kaydedilmemiş işleri çiftliğin üstüne uygulanır; iki ekran aynı anda aynı şeyi gösterir.
  const partnerLive = usePartnerLive(couple?.id, partnerId);
  const partnerHere = liveFresh(partnerLive);
  const partnerHereRef = useRef(partnerHere);
  partnerHereRef.current = partnerHere;
  const [mine, setMine] = useState<{ a: Action; sent: boolean }[]>([]);
  const savedFarm = farmOf(couple);
  const farm = useMemo(
    () =>
      overlayFarm(
        overlayFarm(
          savedFarm,
          mine.map((x) => x.a),
          user?.uid ?? '',
        ),
        partnerHere ? (partnerLive?.acts ?? []) : [],
        partnerId ?? '',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [couple, mine, partnerLive, partnerHere],
  );
  // Kayıt geldi: gönderilmiş işler artık kayıtta, üst katmandan düşer.
  useEffect(() => {
    setMine((m) => (m.some((x) => x.sent) ? m.filter((x) => !x.sent) : m));
  }, [couple]);
  const BARN_TILE = barnTile(farm); // depo taşınabilir: yeri kayıttan gelir
  const PILE_TILE = pileTile(farm); // deponun önü
  const uid = user?.uid ?? '';
  const myName = profile?.name ?? 'Ben';
  const [myTile, setMyTile] = useState<number>(() => farm.pos[uid] ?? (2 + OFF) * N + 2 + OFF);
  const myTileRef = useRef(myTile);
  const liveTile = partnerHere && partnerLive && partnerLive.tile >= 0 && partnerLive.tile < N * N ? partnerLive.tile : undefined;
  const partnerTile = liveTile ?? (partnerId ? farm.pos[partnerId] : undefined) ?? (2 + OFF) * N + 5 + OFF;
  // Partnerin elindeki alet (sulama kabı, tohum): iş geldiğinde kısa süre görünür.
  const [pTool, setPTool] = useState<string | null>(null);
  useEffect(() => {
    if (!partnerLive?.tool || !liveFresh(partnerLive)) return;
    setPTool(partnerLive.tool);
    const t = setTimeout(() => setPTool(null), 1600);
    return () => clearTimeout(t);
  }, [partnerLive]);
  // Kalp atışı: çiftlikte olduğumu partner bilsin (45 sn'de bir; çıkınca silinir). İş yazmaları yalnız ikimiz de buradayken yapılır.
  const liveCoupleId = couple?.id;
  useEffect(() => {
    if (!liveCoupleId || !uid) return;
    const beat = () => {
      if (!busy.current) publishLive(liveCoupleId, uid, { tile: myTileRef.current, tool: null, acts: [] });
    };
    beat();
    const iv = setInterval(beat, 45_000);
    return () => {
      clearInterval(iv);
      publishLive(liveCoupleId, uid, { tile: myTileRef.current, tool: null, acts: [], atMs: 0 });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCoupleId, uid]);
  const partnerTileRef = useRef(partnerTile);
  partnerTileRef.current = partnerTile;
  // Partner öptüyse: kalpler benim üstümde uçar (yalnızca yeni öpücükte, bir kez).
  const kissSeen = useRef(farm.kiss?.at ?? 0);
  const kissAt = farm.kiss?.at ?? 0;
  const kissBy = farm.kiss?.by;
  useEffect(() => {
    if (!kissAt || kissAt <= kissSeen.current) return;
    kissSeen.current = kissAt;
    if (kissBy && kissBy !== uid && Date.now() - kissAt < 15000) {
      heartsRef.current(myTileRef.current);
      setSay('🥰');
      setTimeout(() => setSay(''), 2200);
    }
  }, [kissAt, kissBy, uid]);
  const heartsRef = useRef<(tile: number) => void>(() => {});

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Partner bir şey yapınca üstte kısa bildirim.
  const mountedAt = useRef(Date.now());
  const last = farm.log[0];
  useEffect(() => {
    if (last && last.by === partnerId && last.at > mountedAt.current) {
      setToast(last.text);
      const id = setTimeout(() => setToast(''), 2800);
      return () => clearTimeout(id);
    }
  }, [last?.at, last?.by, last?.text, partnerId, last]);

  // "Sen yokken": çiftlik bildirim göndermez; partnerin son ziyaretten beri yaptıkları açılışta kartta listelenir.
  const [away, setAway] = useState<FarmLog[] | null>(null);
  useEffect(() => {
    if (!couple?.id) return;
    const key = `farm.seen.${couple.id}`;
    AsyncStorage.getItem(key)
      .then((v) => {
        const since = Number(v ?? 0);
        const items = farmOf(couple)
          .log.filter((l) => l.by === partnerId && l.at > since)
          .slice(0, 4);
        if (items.length) setAway(items);
      })
      .catch(() => {});
    return () => {
      AsyncStorage.setItem(key, String(Date.now())).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id]);
  useEffect(() => {
    if (!away) return;
    const id = setTimeout(() => setAway(null), 12_000);
    return () => clearTimeout(id);
  }, [away]);

  // Kamera: bütün araziyi ekrana sığdır; + ile yaklaşılır, sürükleyerek gezilir.
  const top = insets.top + 54;
  const bottom = 170 + insets.bottom; // sabit Sula/Topla satırı + alt menü
  const fit = box.w ? Math.min(1.1, box.w / (BOUNDS.x1 - BOUNDS.x0), (box.h - top - bottom) / (BOUNDS.y1 - BOUNDS.y0)) : 0.5;
  const s = fit * zoom;
  const tx = box.w / 2 - ((BOUNDS.x0 + BOUNDS.x1) / 2) * s + pan.x;
  const ty = top + (box.h - top - bottom) / 2 - ((BOUNDS.y0 + BOUNDS.y1) / 2) * s + pan.y;
  const ox = box.w / 2;
  const oy = top + (box.h - top - bottom) / 2;
  const cx = (BOUNDS.x0 + BOUNDS.x1) / 2;
  const cy = (BOUNDS.y0 + BOUNDS.y1) / 2;
  const cam = useRef({ s, tx, ty, zoom, pan, fit, ox, oy, cx, cy });
  cam.current = { s, tx, ty, zoom, pan, fit, ox, oy, cx, cy };
  const drag = useRef({ x: 0, y: 0, moved: false });
  // İki parmakla yakınlaştırma (fotoğraf gibi): parmakların ortasındaki nokta yerinde kalır.
  const pinch = useRef<{ d0: number; z0: number; wx: number; wy: number } | null>(null);
  const MAX_ZOOM = 4;
  // 1 = iç çiftlik ekrana sığar; daha küçüğü uzaklaşır ve bütün araziyi (22x22) gösterir.
  const MIN_ZOOM = INNER / N;
  // Tek dokunuşla iş: rozete ya da tek işi belli olan kareye dokununca sormadan yapılır (her render'da yenilenir).
  const quickRef = useRef<(wx: number, wy: number) => boolean>(() => false);
  const kissRef = useRef<(wx: number, wy: number) => boolean>(() => false);
  const placeRef = useRef<(i: number) => void>(() => {});

  const pr = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => {
          if (liftTimer.current) clearTimeout(liftTimer.current);
          liftTimer.current = null;
          setLift(null);
        },
        onPanResponderGrant: (e) => {
          drag.current = { ...cam.current.pan, moved: false };
          pinch.current = null;
          // Basılı tutma: 0,4 sn kıpırdamadan durulursa altındaki eşya kaldırılır
          if (liftTimer.current) clearTimeout(liftTimer.current);
          const c = cam.current;
          const wx = (e.nativeEvent.locationX - c.tx) / c.s;
          const wy = (e.nativeEvent.locationY - c.ty) / c.s;
          const obj = objectAtRef.current(wx, wy);
          const i = obj >= 0 ? obj : tileAt(wx, wy);
          if (i >= 0 && !placingRef.current && liftableRef.current(i)) {
            liftTimer.current = setTimeout(() => {
              liftTimer.current = null;
              if (drag.current.moved || pinch.current) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setLift({ from: i, wx, wy });
            }, 400);
          }
        },
        onPanResponderMove: (e, g) => {
          if (liftRef.current) {
            const c = cam.current;
            setLift({ ...liftRef.current, wx: (e.nativeEvent.locationX - c.tx) / c.s, wy: (e.nativeEvent.locationY - c.ty) / c.s });
            return;
          }
          const t = e.nativeEvent.touches;
          if (Math.hypot(g.dx, g.dy) > 14 && liftTimer.current) {
            clearTimeout(liftTimer.current);
            liftTimer.current = null;
          }
          if (t.length >= 2) {
            drag.current.moved = true;
            const c = cam.current;
            const d = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
            const mx = (t[0].locationX + t[1].locationX) / 2;
            const my = (t[0].locationY + t[1].locationY) / 2;
            if (!pinch.current) {
              // Parmakların ortasındaki dünya noktası
              pinch.current = { d0: d, z0: c.zoom, wx: (mx - c.tx) / c.s, wy: (my - c.ty) / c.s };
              return;
            }
            const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (pinch.current.z0 * d) / pinch.current.d0));
            const s2 = c.fit * z;
            setZoom(z);
            if (z === 1 && Math.abs(c.pan.x) + Math.abs(c.pan.y) < 1) setPan({ x: 0, y: 0 });
            else setPan({ x: mx - c.ox - (pinch.current.wx - c.cx) * s2, y: my - c.oy - (pinch.current.wy - c.cy) * s2 });
            return;
          }
          if (pinch.current) return; // iki parmaktan tek parmağa düşünce sürükleme başlamasın
          if (Math.hypot(g.dx, g.dy) > 6) drag.current.moved = true;
          if (drag.current.moved) {
            // ekran merkezindeki dünya noktası arazinin dışına çıkmasın
            const c = cam.current;
            const x = Math.min((c.cx - FULL.x0) * c.s, Math.max((c.cx - FULL.x1) * c.s, drag.current.x + g.dx));
            const y = Math.min((c.cy - FULL.y0) * c.s, Math.max((c.cy - FULL.y1) * c.s, drag.current.y + g.dy));
            setPan({ x, y });
          }
        },
        onPanResponderRelease: (e) => {
          if (liftTimer.current) {
            clearTimeout(liftTimer.current);
            liftTimer.current = null;
          }
          if (liftRef.current) {
            const c = cam.current;
            const to = tileAt((e.nativeEvent.locationX - c.tx) / c.s, (e.nativeEvent.locationY - c.ty) / c.s);
            liftDropRef.current(liftRef.current.from, to);
            setLift(null);
            return;
          }
          if (drag.current.moved || pinch.current) return;
          const c = cam.current;
          const wx = (e.nativeEvent.locationX - c.tx) / c.s;
          const wy = (e.nativeEvent.locationY - c.ty) / c.s;
          // Yerleştirme modu: dükkandan seçilen şey dokunulan kareye konur.
          if (placingRef.current) {
            const i = tileAt(wx, wy);
            if (i >= 0) placeRef.current(i);
            return;
          }
          // Girişte bekleyen çift: dokununca hazırlanan ürünler teslim edilir.
          if (visitTapRef.current(wx, wy)) return;
          // Posta kutusu (ve üstündeki rozet): sipariş defteri açılır.
          if (mailHit(wx, wy)) {
            setSel(null);
            setShowLog(false);
            setShowShop(false);
            setShowOrders(true);
            return;
          }
          // Aradaki öpücük balonu: dokununca avatar partnerin yanına yürür.
          if (kissRef.current(wx, wy)) return;
          if (quickRef.current(wx, wy)) {
            setSel(null);
            setShowLog(false);
            setShowOrders(false);
            setShowShop(false);
            return;
          }
          const obj = objectAtRef.current(wx, wy);
          const i = obj >= 0 ? obj : tileAt(wx, wy);
          setSel((old) => (i < 0 || old === i ? null : i));
          setShowLog(false);
          setShowOrders(false);
          setShowShop(false);
          setPlantAll(false);
        },
      }),
    [],
  );

  // Avatarın yürüyüşü bitince sıradaki iş yapılır.
  const arrived = useRef<(() => void) | null>(null);
  // İki kişilik sahnede avatar sahne karesinde durur; ekrandaki yeri değişmeyecekse yürüyüş beklenmez.
  const sceneTileRef = useRef<number | null>(null);
  const walkTo = (i: number) =>
    new Promise<void>((res) => {
      // Yarıda kalan önceki yürüyüşü bekleyen varsa serbest bırak (asılı kalmasın).
      arrived.current?.();
      arrived.current = null;
      if (i === myTileRef.current) return res();
      myTileRef.current = i;
      setMyTile(i);
      if (sceneTileRef.current !== null) return res();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (arrived.current === finish) arrived.current = null;
        res();
      };
      // Güvenlik: "vardım" haberi herhangi bir nedenle gelmezse iş sırası kilitlenmesin.
      const timer = setTimeout(finish, 7000);
      arrived.current = finish;
    });
  const queue = useRef<Action[]>([]);
  const busy = useRef(false);
  // Yürünüp henüz kaydedilmemiş iş (ekran kapanırsa sıradakilerle birlikte topluca kaydedilir).
  const current = useRef<Action | null>(null);
  // Yürünüp bitirilmiş, topluca kaydedilmeyi bekleyen işler. Art arda verilen işler (hepsini sula, topla, çit diz…)
  // tek tek değil 10'arlı tek yazmayla kaydedilir: hem hızlı, hem veritabanı kotasını yemez.
  const batch = useRef<Action[]>([]);
  // Ekran kapanınca ya da uygulama arka plana geçince telefon uygulamayı durdurur; avatar yürüyemez.
  // Bekleyen işler o anda animasyonsuz, tek yazmayla kaydedilir. Geri dönünce yarıda kalmış yürüyüş serbest bırakılır.
  const flushCtx = useRef({ coupleId: couple?.id, uid, myName, partnerName });
  flushCtx.current = { coupleId: couple?.id, uid, myName, partnerName };
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        arrived.current?.();
        arrived.current = null;
        return;
      }
      // iOS'ta bildirim paneli, izin penceresi gibi geçici durumlar 'inactive' gelir; işler yalnız gerçekten arka plana geçince kaydedilir.
      if (state !== 'background') return;
      const pending = [...batch.current, ...(current.current ? [current.current] : []), ...queue.current];
      batch.current = [];
      current.current = null;
      queue.current = [];
      const c = flushCtx.current;
      if (pending.length && c.coupleId) farmFlush(c.coupleId, c.uid, c.myName, c.partnerName, pending).catch(() => {});
      setMine([]);
      // Arka plana geçtim: partner beni çiftlikte saymasın.
      if (c.coupleId && c.uid) publishLive(c.coupleId, c.uid, { tile: myTileRef.current, tool: null, acts: [], atMs: 0 });
    });
    return () => sub.remove();
  }, []);
  const flash = (text: string) => {
    setSay(text);
    setTimeout(() => setSay(''), 1800);
  };

  // Çiftçi pazarı: çiftlik açılınca satılan ilanların bedeli tahsil edilir, süresi dolanlar depoya döner (tek sorgu).
  const coupleId = couple?.id;
  useEffect(() => {
    if (!coupleId || !uid) return;
    settleMine({ coupleId, uid, name: myName, partnerName })
      .then((r) => {
        if (r.sold) {
          setSay(`Pazarda ${r.sold} ilanın satıldı: +${r.coins} altın 🧺`);
          setTimeout(() => setSay(''), 3500);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupleId, uid]);

  // Öpücük efekti: verilen karenin üstünde kalpler uçar.
  const hearts = (tile: number) => {
    const { x, y } = center(...rc(tile));
    ['💋', '❤️', '💕'].forEach((text, k) => {
      const id = Date.now() + Math.random();
      setTimeout(() => {
        setFloats((f) => [...f, { id, x: x + (k - 1) * 18, y: y - TW * (0.7 + k * 0.15), text }]);
        setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1300);
      }, k * 220);
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  heartsRef.current = hearts;

  async function work(a: Action) {
    queue.current.push(a);
    if (busy.current || !couple || !partnerId) return;
    busy.current = true;
    // Kalp için: bu partide tek başına mı iş yapıldı, yoksa birlikte bir şey mi?
    let solo = false;
    let together = false;
    try {
      while (queue.current.length) {
        const job = queue.current.shift()!;
        current.current = job;
        const tl = job.a === 'water' ? 'can' : job.a === 'plant' || job.a === 'till' ? 'seed' : null;
        // Toplu kayıt: sahnesiz, sıradan işler birikir; sıra bitince ya da 10 olunca tek yazmayla gider.
        const plain =
          !('scene' in job && job.scene) &&
          !['kiss', 'deliver', 'handover', 'note', 'sell', 'harvestDay', 'unlock', 'gift', 'openGift', 'cook'].includes(job.a);
        // Partner de çiftlikteyse nereye gittiğimi ve henüz kaydedilmemiş işlerimi anında görür.
        if (partnerHereRef.current)
          publishLive(couple.id, uid, { tile: job.i, tool: tl, acts: plain ? [...batch.current, job] : batch.current });
        await walkTo(job.i);
        setTool(tl);
        await sleep(tl ? (queue.current.length ? 400 : 800) : 250);
        setTool(null);
        // Bu iş ekran kapanırken topluca kaydedildiyse yeniden gönderme.
        if (current.current !== job) continue;
        current.current = null;
        const before = farmOf(couple).tiles[job.i];
        const farmBefore = farmOf(couple);
        const ordBefore = job.a === 'deliver' ? farmBefore.orders.find((o) => o.id === job.order) : undefined;
        // Toplama işleri: depoya ne girdiği hemen gösterilir (iş topluca kaydedilse bile). Aynı kural yerelde denenir,
        // depo farkı alınır; kural reddederse (hazır değil vb.) bir şey gösterilmez.
        if (['collect', 'gather', 'harvest', 'pick', 'collectProd'].includes(job.a)) {
          const sim = applyAction(farmBefore, job, uid, () => '', myName, Date.now(), null);
          if (typeof sim !== 'string') {
            const got = Object.entries(sim.farm.stock)
              .map(([k, n]) => [k, n - (farmBefore.stock[k] ?? 0)] as const)
              .filter(([, n]) => n > 0);
            const at = center(...rc(job.i));
            got.forEach(([k, n], idx) => {
              const fid = Date.now() + Math.random();
              setTimeout(() => {
                setFloats((f) => [...f, { id: fid, x: at.x, y: at.y - TW * 1.1, text: `+${n} ${PRODUCT_NAME[k] ?? ''}`.trim(), art: k }]);
                setTimeout(() => setFloats((f) => f.filter((q) => q.id !== fid)), 1750);
              }, idx * 350);
            });
          }
        }
        const packedBefore = farmBefore.orders.filter((o) => o.packed);
        const handBefore = job.a === 'handover' ? farmBefore.orders.find((o) => o.id === job.order) : undefined;
        if (plain && (queue.current.length > 0 || batch.current.length > 0)) {
          if (job.a === 'water' && before?.k === 'crop' && before.by !== uid) together = true;
          else solo = true;
          batch.current.push(job);
          setMine((m) => [...m, { a: job, sent: false }]);
          if (queue.current.length > 0 && batch.current.length < 10) continue;
        }
        if (batch.current.length) {
          const acts = batch.current;
          batch.current = [];
          // Gönderilen işler kayıt gelince üst katmandan düşer (bkz. mine).
          setMine((m) => m.map((x) => (acts.includes(x.a) ? { ...x, sent: true } : x)));
          try {
            const n = await Promise.race([farmFlush(couple.id, uid, myName, partnerName, acts), sleep(12000).then(() => -1)]);
            if (n === -1) flash('Bağlantı yavaş, tekrar dene');
            else if (n < acts.length) flash(n ? `${n} iş yapıldı, ${acts.length - n} olmadı` : 'Olmadı');
          } catch {
            flash('Olmadı, tekrar dene');
          }
          if (acts.includes(job)) continue;
        }
        try {
          // Bağlantı takılırsa sıra sonsuza dek beklemesin.
          const r = await Promise.race([
            farmAction(couple.id, uid, myName, partnerName, job),
            sleep(12000).then(() => 'Bağlantı yavaş, tekrar dene' as const),
          ]);
          if (typeof r === 'string') flash(r);
          else {
            const helped = job.a === 'water' && before.k === 'crop' && before.by !== uid;
            if (job.a === 'kiss') hearts(partnerTileRef.current);
            // Sipariş hazırlandı: defter kapanır, çift girişe gelir.
            if (
              job.a === 'deliver' &&
              ordBefore &&
              canGive(farmBefore, ordBefore) >= Object.values(orderLeft(ordBefore)).reduce((a, b) => a + b, 0)
            ) {
              flash(`${orderWho(ordBefore)} almaya geliyor`);
              setShowOrders(false);
            }
            // Elden teslim: çift teşekkür eder, ödül girişte belirir.
            if (job.a === 'handover' && r.gained && handBefore) {
              const slot = Math.max(
                0,
                packedBefore.findIndex((o) => o.id === handBefore.id),
              );
              setLeaving((l) => [...l, { id: handBefore.id, who: orderWho(handBefore), slot }]);
              const sp = visitSlot(slot);
              const fid = Date.now() + Math.random();
              setFloats((f) => [
                ...f,
                { id: fid, x: sp.x, y: sp.y - TW * 2.1, text: `+${handBefore.coins} altın · +${handBefore.xp} tecrübe` },
              ]);
              setTimeout(() => setFloats((f) => f.filter((q) => q.id !== fid)), 1600);
            }
            if (
              helped ||
              ('scene' in job && job.scene) ||
              job.a === 'harvestDay' ||
              job.a === 'handover' ||
              job.a === 'note' ||
              job.a === 'kiss'
            )
              together = true;
            else solo = true;
            if (r.gained && !['handover', 'collect', 'gather', 'harvest', 'pick', 'collectProd'].includes(job.a)) {
              const { x, y } = center(...rc(job.a === 'sell' ? PILE_TILE : job.i));
              const id = Date.now() + Math.random();
              setFloats((f) => [
                ...f,
                {
                  id,
                  x,
                  y: y - TW * 0.6,
                  text: job.a === 'sell' ? `+${r.gained} altın` : job.a === 'harvestDay' ? `${r.gained} ürün 🌾` : `+${r.gained}`,
                },
              ]);
              setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1300);
            }
            if (job.a === 'plant') {
            }
            if (job.a === 'note') void 0; // Not Ağacı: bildirim yok, çiftlik açılınca kartta görünür
            if (job.a === 'water' && before.k === 'crop' && before.by !== uid) {
              // Bildirim döngü sonunda tek seferde gider (10 tarla → 10 bildirim olmasın)
            }
          }
        } catch {
          flash('Olmadı, tekrar dene');
        }
      }
      // İş bitti: tarlanın içinde dikilme, yanındaki yola çekil.
      const rest = restNear(farmOf(couple), myTileRef.current);
      if (partnerHereRef.current) publishLive(couple.id, uid, { tile: rest, tool: null, acts: [] });
      if (rest !== myTileRef.current) void walkTo(rest);
      if (together) logActivityCapped(couple.id, uid, 'farmTogether');
      else if (solo) logActivityCapped(couple.id, uid, 'farm');
      // Çiftlik işleri için bildirim gitmez; partner çiftliği açınca "sen yokken" kartında görür.
    } finally {
      // Ne olursa olsun sıra yeniden açılır; aksi hâlde sonraki hiçbir komut çalışmaz.
      current.current = null;
      busy.current = false;
    }
  }

  if (!user || !couple || !partnerId) return null;

  const lv = levelOf(farm.xp);
  const season = seasonOf(now);
  const ready = readyTiles(farm, now);
  const bigIds = bigReady(farm, now);
  const live = scene && scene.status === 'live' ? scene : null;
  // Hasat günü canlıyken ikisi tarlada yan yana; pazar canlıyken yığının başında.
  const sceneTile = live ? (live.kind === 'harvest' && bigIds.length ? bigIds[0] : PILE_TILE) : null;
  async function begin(kind: 'harvest' | 'market') {
    if (scene) return flash('Önce açık sahneyi bitirin.');
    try {
      // Çiftlik sahnelerinde soru yok: hasat ve pazar iş günüdür, sohbet sorusu hayal dünyalarında kalır.
      await startScene(couple!.id, uid, { world: 'farm', kind, place: 'Bizim Çiftlik', windowMin: 120, qkind: 'none' });
    } catch {
      flash('Sahne başlatılamadı');
    }
  }
  // Sahneye katılan kişi işi yapar: hasadı kaldırır ya da tezgâhı açıp satar.
  const doScene = async (sc: Scene) => {
    await (sc.kind === 'harvest'
      ? work({ a: 'harvestDay', i: bigIds[0] ?? PILE_TILE, scene: sc.id })
      : work({ a: 'sell', i: PILE_TILE, scene: sc.id }));
    // soru yoksa sahne işle biter; açık kalıp yenisini engellemesin
    if (!sc.question && couple) setTimeout(() => finishScene(couple.id, sc.id), 8000);
  };
  const thirsty = farm.tiles.filter((x) => x.k === 'crop' && x.by === partnerId && !x.watered && !cropReady(x, now)).length;
  const fields = farm.tiles.filter((x) => x.k === 'soil' || x.k === 'crop').length;
  // Tohum parmağın biraz üstünde gezer; hedef kare tohumun altındaki karedir (parmak tarlayı kapatmasın).
  const SEED_UP = 46;
  const seedTileAt = (px: number, py: number) => {
    const c = cam.current;
    return tileAt((px - rootOff.current.x - c.tx) / c.s, (py - SEED_UP - rootOff.current.y - c.ty) / c.s);
  };
  // Sürüklenen şeyin konabileceği kare mi?
  const dragFits = (it: DragItem, i: number) => {
    const tl = farm.tiles[i];
    if (!tl) return false;
    if (it.a.a === 'plant') return tl.k === 'soil';
    if (it.a.a === 'adopt') {
      const need = buildingFor(it.a.item);
      return tl.k === 'building' && tl.item === need && tl.res.length < BUILDINGS[need].cap;
    }
    return tl.k === 'grass';
  };
  // Tohum ve çit "boyanır": parmak üstünden geçtikçe konur. Diğerleri bırakınca bir kez konur.
  const dragPaints = (it: DragItem) => it.a.a === 'plant' || (it.a.a === 'decor' && !!DECOR[it.a.item].wall);
  seedApi.current = {
    start: (it, px, py) => {
      rootRef.current?.measureInWindow((x: number, y: number) => (rootOff.current = { x, y }));
      seedDone.current = new Set();
      seedCoins.current = farm.coins;
      seedFarm.current = farm;
      Haptics.selectionAsync().catch(() => {});
      setSeed({ it, x: px, y: py });
    },
    move: (px, py) => {
      if (!seed) return;
      setSeed({ ...seed, x: px, y: py });
      if (!dragPaints(seed.it)) return;
      const i = seedTileAt(px, py);
      if (i < 0 || seedDone.current.has(i) || !dragFits(seed.it, i)) return;
      if (seedCoins.current < seed.it.cost) {
        if (!seedDone.current.has(-1)) flash('Altın yetmiyor');
        seedDone.current.add(-1);
        return;
      }
      seedDone.current.add(i);
      seedCoins.current -= seed.it.cost;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      work({ ...seed.it.a, i } as Action);
    },
    end: () => {
      const cur = seed;
      let done = [...seedDone.current].some((i) => i >= 0);
      setSeed(null);
      if (cur && !dragPaints(cur.it)) {
        const i = seedTileAt(cur.x, cur.y);
        if (i >= 0 && dragFits(cur.it, i)) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          work({ ...cur.it.a, i } as Action);
          done = true;
        } else if (i >= 0) {
          flash(cur.it.a.a === 'adopt' ? 'Hayvanı boş yeri olan binasına bırak' : 'Boş bir çimene bırak');
        }
      }
      if (done) {
        setSel(null);
        setShowShop(false);
        setPlantAll(false);
      }
    },
  };
  const seedHit = seed ? seedTileAt(seed.x, seed.y) : -1;
  const seedTarget = seed && seedHit >= 0 && dragFits(seed.it, seedHit) ? seedHit : null;
  // Kaldırılan eşya yerinde görünmez; parmağın altında yarı saydam kopyası gezer
  const liftBarn = !!lift && farm.tiles[lift.from]?.k === 'fixed';
  const farmView = lift
    ? {
        ...farm,
        tiles: farm.tiles.map((t, j) =>
          j === lift.from || (liftBarn && t.k === 'fixed' && t.item === 'barn') ? ({ k: 'grass' } as Tile) : t,
        ),
      }
    : farm;
  const sprs = [...SCENERY, ...sprites(farmView, now)].sort((a, b) => a.z - b.z);
  objectAtRef.current = (wx, wy) => {
    let best = -1;
    let bz = -1;
    for (const sp of sprs) {
      const m = /^s(\d+)$/.exec(sp.key);
      if (!m) continue;
      const i = Number(m[1]);
      if (sp.wall) continue; // çit/duvar kendi karesinden seçilir
      const k = farm.tiles[i]?.k;
      const tl = farm.tiles[i];
      const barn = tl?.k === 'fixed' && tl.item === 'barn';
      if (k !== 'tree' && k !== 'building' && k !== 'decor' && k !== 'animal' && !barn) continue;
      const a = ART[sp.art];
      if (!a) continue;
      const h = sp.w * a.h;
      if (wx >= sp.x - sp.w / 2 && wx <= sp.x + sp.w / 2 && wy >= sp.y - h && wy <= sp.y && sp.z > bz) {
        best = i;
        bz = sp.z;
      }
    }
    return best;
  };
  let ghost: Spr[] = [];
  let liftTarget: number | null = null;
  if (lift) {
    const one = { ...farm, tiles: farm.tiles.map((t, j) => (j === lift.from ? t : ({ k: 'grass' } as Tile))) };
    const o = center(...rc(lift.from));
    // Yalnızca kaldırılan eşyanın (ve binaysa içindekilerin) kopyası; sabit tezgâh gibi başka çizimler karışmasın.
    ghost = sprites(one, now)
      .filter((sp) => sp.key === `s${lift.from}` || sp.key.startsWith(`s${lift.from}r`))
      .map((sp) => ({ ...sp, x: sp.x + lift.wx - o.x, y: sp.y + lift.wy - o.y - TH * 0.6, z: 9000, o: 0.8 }));
    const target = tileAt(lift.wx, lift.wy);
    liftTarget = target >= 0 ? target : null; // parmak arazinin dışındaysa hedef yok
  }
  const badges: { key: string; i: number; x: number; y: number; art: string; z: number; n?: number; label?: string }[] = [];
  // Depo rozeti: ahırın üstünde en çok olan ürün ve toplam adet; dokununca depo açılır.
  {
    const n = stockCount(farm);
    const top = Object.entries(farm.stock).sort((a, b) => b[1] - a[1])[0];
    if (n > 0 && top) {
      const [ar, ac] = rc(BARN_TILE);
      const a = center(ar, ac);
      const back = center(ar - 1, ac - 1);
      const barnTile = ar * N + ac;
      badges.push({
        key: 'depo',
        i: barnTile,
        x: (a.x + back.x) / 2,
        y: a.y - TW * 1.35,
        art: ART[top[0]] ? top[0] : 'coin',
        z: zOf(ar, ac) + 420,
        n,
      });
    }
  }
  {
    // Ev: mutfak. Yapılabilecek bir tarif varsa rozet çıkar.
    const lvNow = levelOf(farm.xp).level;
    const can = (Object.keys(RECIPES) as RecipeId[]).filter(
      (id) => stationOf(id, farm) === 'mutfak' && RECIPES[id].lvl <= lvNow && hasAll(farm, RECIPES[id].needs),
    );
    const [hr, hc] = FIXED_ANCHOR.house;
    const h = center(hr, hc);
    const hb = center(hr - 1, hc - 1);
    // Mutfak rozeti: hazır ürün varsa "Hazır", üretim sürüyorsa kalan süre, boş ocak ve malzeme varsa "Mutfak".
    const jobs = stationJobs(farm, 'mutfak');
    const doneJob = jobs.find((j) => j.ready <= now);
    const nextJob = jobs.slice().sort((a, b) => a.ready - b.ready)[0];
    const free = jobs.length < stationSlots('mutfak', lvNow);
    void can;
    void free;
    if (doneJob || nextJob)
      badges.push({
        key: 'mutfak',
        i: hr * N + hc,
        x: (h.x + hb.x) / 2,
        y: h.y - TW * 1.45,
        art: doneJob ? doneJob.recipe : nextJob ? nextJob.recipe : ART[can[0]] ? can[0] : 'bugday',
        z: zOf(hr, hc) + 420,
        label: doneJob ? 'Hazır' : timeLeft((nextJob as { ready: number }).ready - now),
      });
    // Sepet tezgâhı: gelen sepet varsa "Aç", yoksa hazırlanabilecek sepet varsa "Sepet".
    const [gr, gc] = rc(GIFT_TILE);
    const gp = center(gr, gc);
    const incoming = (farm.gifts ?? []).some((x) => x.from !== uid);
    const canGift = !giftWait(farm, uid, now) && (Object.keys(BASKETS) as BasketId[]).some((id) => hasAll(farm, BASKETS[id].needs));
    if (incoming || canGift)
      badges.push({
        key: 'sepetb',
        i: GIFT_TILE,
        x: gp.x,
        y: gp.y - TW * 0.95,
        art: ART.sepet ? 'sepet' : 'coin',
        z: zOf(gr, gc) + 420,
        label: incoming ? 'Aç' : 'Sepet',
      });
  }
  // Hazırlanmış siparişlerin çiftleri girişte bekler. Bu oturumda yeni hazırlananlar yoldan yürüyerek gelir;
  // çiftlik açıldığında zaten hazır olanlar yerlerinde durur.
  const packed = farm.orders.filter((o) => o.packed && !leaving.some((l) => l.id === o.id)).slice(0, 3);
  if (!seenPacked.current) seenPacked.current = new Set(packed.map((o) => o.id));
  const walkIns = new Set(packed.filter((o) => !seenPacked.current!.has(o.id)).map((o) => o.id));
  visitTapRef.current = (wx, wy) => {
    const k = packed.findIndex((_, n) => visitHit(n, wx, wy));
    if (k < 0) return false;
    work({ a: 'handover', i: VISIT_TILE, order: packed[k].id });
    return true;
  };
  {
    // Posta kutusu: verilebilecek sipariş varsa rozet çıkar.
    const giv = farm.orders.filter((o) => o.openAt <= now && canGive(farm, o) > 0).length;
    if (giv)
      badges.push({ key: 'siparis', i: -1, x: MAIL.x, y: MAIL.y - TW * 1.5, art: 'sepet_dolu', z: MAIL.z + 400, n: giv, label: 'Sipariş' });
  }
  farm.tiles.forEach((tl, i) => {
    const [r, c] = rc(i);
    const { x, y } = center(r, c);
    const z = zOf(r, c) + 409;
    // Susuz ürün çoksa tek tek bidon yerine alttaki "Hepsini sula" düğmesi kullanılır; rozetler tarlayı kapatmasın.
    if (tl.k === 'crop' && !cropReady(tl, now) && tl.by !== uid && !tl.watered && thirsty <= 3)
      badges.push({ key: `b${i}`, i, x, y: y - TW * 0.75, art: 'can', z });
    if (tl.k === 'crop' && cropReady(tl, now))
      badges.push({ key: `b${i}`, i, x, y: y - TW * 0.95, art: CROPS[tl.crop].big ? 'gul' : 'coin', z });
    if (tl.k === 'animal' && animalReady(tl, now))
      badges.push({ key: `b${i}`, i, x, y: y - TW * 0.85, art: PRODUCTS[ANIMALS[tl.item].products[0]].art, z });
    if (tl.k === 'tree' && treeReady(tl, now)) badges.push({ key: `b${i}`, i, x, y: y - TW * 1.15, art: 'coin', z });
    if (tl.k === 'decor' && DECOR[tl.item].station) {
      // Atölye rozeti: hazır ürün varsa "Hazır", üretim sürüyorsa kalan süre, boşsa ve malzeme varsa atölyenin adı.
      const st = tl.item as Station;
      const lvNow = levelOf(farm.xp).level;
      const js = stationJobs(farm, st);
      const dj = js.find((j) => j.ready <= now);
      const nj = js.slice().sort((a, b) => a.ready - b.ready)[0];
      const can = (Object.keys(RECIPES) as RecipeId[]).filter(
        (id) => stationOf(id, farm) === st && RECIPES[id].lvl <= lvNow && hasAll(farm, RECIPES[id].needs),
      );
      if (dj || nj || (can.length && js.length < stationSlots(st, lvNow)))
        badges.push({
          key: `b${i}`,
          i,
          x,
          y: y - TW * 1.45,
          art: dj ? dj.recipe : nj ? nj.recipe : can[0],
          z,
          label: dj ? 'Hazır' : nj ? timeLeft(nj.ready - now) : STATIONS[st].name,
        });
    }
    if (tl.k === 'building') {
      const ready = tl.res.filter((r) => residentReady(r, now));
      const hungry = tl.res.filter((r) => needsFeed(r.id) && r.fed === null);
      if (ready.length)
        badges.push({
          key: `b${i}`,
          i,
          x,
          y: y - TW * 1.25,
          art: PRODUCTS[ANIMALS[ready[0].id].products[0]].art,
          z,
          n: ready.length,
          label: 'Topla',
        });
      else if (hungry.length) badges.push({ key: `b${i}`, i, x, y: y - TW * 1.25, art: 'bugday', z, n: hungry.length, label: 'Yemle' });
    }
  });
  // Karenin tek ve belli bir işi varsa onu döndür: sula, topla, meyve topla; büyük ürün hazırsa hasat gününü başlat.
  const quickFor = (i: number): (() => void) | null => {
    const tl = farm.tiles[i];
    if (!tl) return null;
    if (tl.k === 'crop') {
      if (cropReady(tl, now)) return CROPS[tl.crop].big ? (scene ? null : () => begin('harvest')) : () => work({ a: 'harvest', i });
      if (tl.by !== uid && !tl.watered) return () => work({ a: 'water', i });
      return null;
    }
    if (tl.k === 'animal' && animalReady(tl, now)) return () => work({ a: 'collect', i });
    if (tl.k === 'tree' && treeReady(tl, now)) return () => work({ a: 'pick', i });
    // Binalar (kümes, ağıl, kovan): dokununca içindeki hayvanlar görünür; yemleme ve toplama oradan yapılır.
    return null;
  };
  liftableRef.current = (i) => {
    const tl = farm.tiles[i];
    // Tarla (boş ya da ekili) ve depo da basılı tutup sürüklenerek taşınır.
    return (
      !!tl &&
      i !== NOTE_TREE &&
      (tl.k === 'tree' ||
        tl.k === 'building' ||
        tl.k === 'decor' ||
        tl.k === 'animal' ||
        tl.k === 'soil' ||
        tl.k === 'crop' ||
        tl.k === 'path' ||
        (tl.k === 'fixed' && tl.item === 'barn'))
    );
  };
  liftDropRef.current = (from, to) => {
    if (to < 0 || to === from) return;
    if (farm.tiles[to]?.k !== 'grass') {
      flash('Boş bir çimene bırak');
      return;
    }
    setSel(null);
    const src = farm.tiles[from];
    work(src?.k === 'fixed' && src.item === 'barn' ? { a: 'moveBarn', i: to } : { a: 'move', i: to, from });
  };
  placeRef.current = (i: number) => {
    const pl = placingRef.current;
    if (!pl) return;
    if (pl.a === 'move' && farm.tiles[i]?.k !== 'grass' && i !== pl.from) {
      flash('Boş bir çimene dokun'); // taşıma sürsün, yanlış dokunuş iptal etmesin
      return;
    }
    if (pl.a === 'pave') {
      // Patika kare kare döşenir; mod üstteki etikete basılana kadar açık kalır.
      if (farm.tiles[i]?.k !== 'grass') flash('Patika boş çimene döşenir');
      else work({ a: 'pave', i });
      return;
    }
    if (pl.a === 'decor' && DECOR[pl.item].wall) {
      // Çit ve duvar art arda dizilir; mod üstteki etikete basılana kadar açık kalır.
      if (farm.tiles[i]?.k !== 'grass') flash('Boş bir çimene dokun');
      else work({ ...pl, i });
      return;
    }
    work({ ...pl, i } as Action);
    setPlacing(null);
  };
  quickRef.current = (wx, wy) => {
    // Önce rozetler: rozet karenin üstünde durduğu için aksi hâlde arkadaki kare seçilirdi.
    const hit = badges.find((b) => Math.hypot(b.x - wx, b.y - wy) < TW * 0.45);
    // Depo, mutfak, sepet ve atölye rozetleri: o yerin panelini açar. Seçim bir sonraki turda yapılır; çünkü bu
    // işlev true dönünce çağıran yer seçimi temizler.
    const hitTile = hit ? farm.tiles[hit.i] : undefined;
    if (
      hit &&
      (hit.key === 'depo' || hit.key === 'mutfak' || hit.key === 'sepetb' || (hitTile?.k === 'decor' && DECOR[hitTile.item].station))
    ) {
      const to = hit.i;
      setTimeout(() => setSel(to), 0);
      return true;
    }
    const obj = objectAtRef.current(wx, wy);
    const i = hit ? hit.i : obj >= 0 ? obj : tileAt(wx, wy);
    if (i < 0) return false;
    if (i === GIFT_TILE) {
      setSel(GIFT_TILE);
      return true;
    }
    const q = quickFor(i);
    if (!q) return false;
    q();
    return true;
  };
  sceneTileRef.current = sceneTile;
  const meAt = stand(sceneTile ?? myTile, -1);
  const pAt = stand(sceneTile ?? partnerTile, 1);
  // Öpücük balonu: ikiniz ayrı yerlerdeyken aranızda çıkar. Dokunan, partnerin yanındaki boş kareye yürür ve öper.
  const [mr, mc] = rc(myTile);
  const [qr, qc] = rc(partnerTile);
  const apart = sceneTile === null && !placing && Math.abs(mr - qr) + Math.abs(mc - qc) >= 2;
  const kissAtPos = apart ? { x: (meAt.x + pAt.x) / 2, y: (meAt.y + pAt.y) / 2 - TW * 0.9 } : null;
  kissRef.current = (wx, wy) => {
    if (!kissAtPos || Math.hypot(wx - kissAtPos.x, wy - kissAtPos.y) > 30) return false;
    const walkable = (j: number) => j >= 0 && j < N * N && (farm.tiles[j]?.k === 'path' || farm.tiles[j]?.k === 'grass');
    const near = [qc > 0 ? partnerTile - 1 : -1, qc < N - 1 ? partnerTile + 1 : -1, partnerTile - N, partnerTile + N]
      .filter(walkable)
      .sort((a, b) => {
        const d = (j: number) => Math.abs(rc(j)[0] - mr) + Math.abs(rc(j)[1] - mc);
        return d(a) - d(b);
      });
    setSel(null);
    void work({ a: 'kiss', i: near[0] ?? partnerTile });
    return true;
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const pill = {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  } as const;

  return (
    <View
      ref={rootRef}
      style={{ flex: 1, backgroundColor: SKY }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <TourOnce id="farm" when={lv.level <= 5} />
      {/* Ekran zemini: üstte gök, altta uzak çayır; manzara resmi bunların üstünde dünyayla birlikte ölçeklenir */}
      <Svg style={{ position: 'absolute', left: 0, top: 0 }} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id="skyfar" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#B7D6EC" />
            <Stop offset="0.42" stopColor={SKY} />
            <Stop offset="0.5" stopColor={FAR} />
            <Stop offset="1" stopColor="#6B7C3C" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#skyfar)" />
      </Svg>
      {box.w > 0 && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: WW,
            height: WH,
            transformOrigin: 'left top',
            transform: [{ translateX: tx }, { translateY: ty }, { scale: s }],
          }}
        >
          <Image source={ART.manzara.src} style={{ position: 'absolute', left: BG.x, top: BG.y, width: BG.w, height: BG.h }} />
          {season !== 'yaz' && season !== 'bahar' && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: BG.x,
                top: BG.y,
                width: BG.w,
                height: BG.h,
                backgroundColor: season === 'kis' ? 'rgba(225,236,246,0.45)' : 'rgba(235,170,70,0.16)',
              }}
            />
          )}
          <Ground f={farmView} sel={lift ? liftTarget : seed ? seedTarget : sel} season={season} />
          {sprs.map((sp) => (
            <SpriteImg key={sp.key} s={sp} />
          ))}
          {ghost.map((sp) => (
            <SpriteImg key={`g${sp.key}`} s={sp} />
          ))}
          <Signs f={farm} />
          {badges.map((b) => (
            <Badge key={b.key} x={b.x} y={b.y} art={b.art} z={b.z} n={b.n} label={b.label} />
          ))}
          <Dog />
          <WorldChar
            profile={partnerProfile}
            name={partnerName}
            x={pAt.x}
            y={pAt.y}
            z={pAt.z}
            tag={partnerName}
            tool={
              pTool && ART[pTool] ? (
                <Image
                  source={ART[pTool].src}
                  style={{ position: 'absolute', left: 42, top: 30, width: 26, height: 26, transform: [{ rotate: '-25deg' }] }}
                  resizeMode="contain"
                />
              ) : null
            }
          />
          {packed.map((o, k) => (
            <Visitors key={o.id} id={o.id} who={orderWho(o)} slot={k} mode="wait" walkIn={walkIns.has(o.id)} />
          ))}
          {leaving.map((l) => (
            <Visitors
              key={`go${l.id}`}
              id={l.id}
              who={l.who}
              slot={l.slot}
              mode="thanks"
              walkIn={false}
              onGone={() => setLeaving((q) => q.filter((x) => x.id !== l.id))}
            />
          ))}
          <WorldChar
            profile={profile}
            name={myName}
            x={meAt.x}
            y={meAt.y}
            z={meAt.z + 1}
            say={say}
            onArrive={() => {
              arrived.current?.();
              arrived.current = null;
            }}
            tool={
              tool ? (
                <Image
                  source={ART[tool].src}
                  style={{ position: 'absolute', left: 42, top: 30, width: 26, height: 26, transform: [{ rotate: '-25deg' }] }}
                  resizeMode="contain"
                />
              ) : null
            }
          />
          {kissAtPos && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: kissAtPos.x - 23,
                top: kissAtPos.y - 23,
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: '#FFE3EA',
                borderWidth: 2,
                borderColor: '#E8516A',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9000,
              }}
            >
              <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 24 }}>
                💋
              </Text>
            </View>
          )}
          {floats.map((f) => (
            <FloatText key={f.id} x={f.x} y={f.y} text={f.text} art={f.art} />
          ))}
        </View>
      )}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} {...pr.panHandlers} />

      {/* üst bilgi */}
      <View style={{ position: 'absolute', left: 10, right: 10, top: insets.top + 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          onPress={close}
          hitSlop={10}
          accessibilityLabel="Geri"
          style={[pill, { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }]}
        >
          <Ionicons name="chevron-back" size={22} color={INK} />
        </Pressable>
        <View style={[pill, { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 3, paddingRight: 10 }]}>
          <Avatar p={profile} name={myName} size={30} showMood={false} />
          <View>
            <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 13, color: INK }}>
              Seviye {lv.level}
            </Text>
            <View style={{ width: 70, height: 6, borderRadius: 3, backgroundColor: '#EADFD8', overflow: 'hidden' }}>
              <View
                style={{ width: `${Math.round(((farm.xp - lv.from) / (lv.to - lv.from)) * 100)}%`, height: 6, backgroundColor: '#6DB33F' }}
              />
            </View>
          </View>
        </View>
        <View style={{ flex: 1 }} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#FFF3C4',
            borderRadius: 999,
            paddingVertical: 4,
            paddingLeft: 4,
            paddingRight: 10,
          }}
        >
          <Image source={ART.coin.src} style={{ width: 24, height: 21 }} />
          <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '900', color: '#7A5A00', fontSize: 15 }}>
            {farm.coins}
          </Text>
        </View>
      </View>
      {placing && (
        <View style={{ position: 'absolute', left: 0, right: 0, top: insets.top + 96, alignItems: 'center', zIndex: 30 }}>
          <Pressable
            onPress={() => setPlacing(null)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: 'rgba(43,29,34,0.86)',
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text maxFontSizeMultiplier={1.0} style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
              {placing.a === 'plant'
                ? `${CROPS[placing.crop].name}: boş bir tarlaya dokun`
                : placing.a === 'decor' && DECOR[placing.item].wall
                  ? `${DECOR[placing.item].name}: çimenlere art arda dokun, yan yana gelenler birleşir · bitince buraya bas`
                  : placing.a === 'pave'
                    ? `Patika: çimenlere dokun (kare ${PAVE} altın) · bitince buraya bas`
                    : placing.a === 'move'
                      ? 'Taşı: boş bir çimene dokun'
                      : placing.a === 'moveBarn'
                        ? 'Depo: 2×2 boş çimenin ön köşesine dokun'
                        : 'Boş bir çimene dokun'}
            </Text>
            <Ionicons name="close-circle" size={18} color="#fff" />
          </Pressable>
        </View>
      )}
      {away && !placing && (
        <View style={{ position: 'absolute', left: 14, right: 14, top: insets.top + 96, alignItems: 'center', zIndex: 30 }}>
          <Pressable
            onPress={() => setAway(null)}
            style={{
              maxWidth: 420,
              alignSelf: 'stretch',
              backgroundColor: 'rgba(43,29,34,0.88)',
              borderRadius: 18,
              paddingHorizontal: 14,
              paddingVertical: 10,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Avatar p={partnerProfile} name={partnerName} size={26} showMood={false} />
              <Text maxFontSizeMultiplier={1.0} style={{ flex: 1, color: '#FFE08A', fontWeight: '800', fontSize: 13 }}>
                Sen yokken {partnerName} 🌾
              </Text>
              <Ionicons name="close-circle" size={18} color="#fff" />
            </View>
            {away.map((l, i) => (
              <Text key={i} maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                · {l.text.replace(`${partnerName} `, '')}
              </Text>
            ))}
          </Pressable>
        </View>
      )}
      <View pointerEvents="none" style={{ position: 'absolute', left: 10, top: insets.top + 52 }}>
        <Text
          maxFontSizeMultiplier={1.0}
          style={[pill, { fontWeight: '800', fontSize: 11, color: INK, paddingHorizontal: 10, paddingVertical: 5, overflow: 'hidden' }]}
        >
          {SEASON_NAME[season]}
          {season === 'kis' ? ' · ürünler yavaş' : ''} · {farm.harvests} ortak hasat
        </Text>
      </View>
      {zoom !== 1 && (
        <Pressable
          accessibilityLabel="Çiftliğe dön"
          onPress={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          style={[
            pill,
            {
              position: 'absolute',
              right: 10,
              top: insets.top + 52,
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Ionicons name="contract-outline" size={20} color={INK} />
        </Pressable>
      )}
      {!!toast && (
        <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 52, left: 56, right: 56, alignItems: 'center' }}>
          <Text
            maxFontSizeMultiplier={1.0}
            numberOfLines={2}
            style={{
              backgroundColor: 'rgba(43,29,34,0.86)',
              color: '#fff',
              fontWeight: '700',
              fontSize: 12,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 14,
              overflow: 'hidden',
              textAlign: 'center',
            }}
          >
            {toast}
          </Text>
        </View>
      )}

      {/* alt bölüm: zemin yok. Bir şey seçiliyse ahşap tabela, yoksa oyun düğmeleri. */}
      {seed &&
        (ART[seed.it.art] ? (
          <Image
            pointerEvents="none"
            source={ART[seed.it.art].src}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: seed.x - rootOff.current.x - 34,
              top: seed.y - rootOff.current.y - SEED_UP - 48,
              width: 68,
              height: 68,
              zIndex: 50,
            }}
          />
        ) : (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: seed.x - rootOff.current.x - 16,
              top: seed.y - rootOff.current.y - SEED_UP - 16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: '#9A6534',
              borderWidth: 3,
              borderColor: '#FFF8E8',
              zIndex: 50,
            }}
          />
        ))}
      <SeedDrag.Provider value={seedApi}>
        {/* Tohum sürüklenirken tabela görünmez olur ama sökülmez: parmak hareketi listedeki tohuma bağlı. */}
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: kbLift,
            padding: 10,
            paddingBottom: kbLift ? 8 : insets.bottom + 8,
            opacity: seed ? 0 : 1,
          }}
        >
          <View
            pointerEvents="box-none"
            style={
              scene || sel !== null || showLog || showOrders
                ? {
                    backgroundColor: 'rgba(255,248,232,0.96)',
                    borderRadius: 20,
                    borderWidth: 3,
                    borderColor: '#9A6534',
                    padding: 12,
                    gap: 10,
                    shadowColor: '#3A2A10',
                    shadowOpacity: 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 8,
                  }
                : { gap: 8 }
            }
          >
            {scene ? (
              <ScenePanel
                scene={scene}
                meta={FARM_SCENES[scene.kind] ?? { title: scene.kind, verb: '' }}
                coupleId={couple.id}
                uid={uid}
                partnerId={partnerId}
                partnerName={partnerName}
                profile={profile}
                partnerProfile={partnerProfile}
                onJoined={() => {
                  doScene(scene);
                }}
                extra={
                  live && ((live.kind === 'harvest' && bigIds.length > 0) || (live.kind === 'market' && stockCount(farm) > 0)) ? (
                    <Btn
                      label={
                        live.kind === 'harvest'
                          ? `Birlikte topla (${bigIds.length})`
                          : `Tezgâhı aç · ${stockValue(farm, MARKET_BONUS)} altın`
                      }
                      onPress={() => doScene(live)}
                    />
                  ) : null
                }
              />
            ) : (
              <Sheet
                farm={(seed && seedFarm.current) || farm}
                sel={sel}
                now={now}
                uid={uid}
                partnerName={partnerName}
                shop={shop}
                setShop={setShop}
                plantAll={plantAll}
                setPlantAll={setPlantAll}
                showLog={showLog}
                showOrders={showOrders}
                showShop={showShop}
                onShop={() => setShowShop(true)}
                onPlace={(pl) => {
                  setPlacing(pl);
                  setShowShop(false);
                  setSel(null);
                }}
                onOrders={() => setShowOrders(true)}
                onWorkshop={(tile) => {
                  // -2: atölye listesi · -1: dükkânın atölye sekmesi · diğer: o atölyenin paneli
                  if (tile === -2) {
                    setSel(null);
                    setShowOrders('ws');
                  } else if (tile >= 0) {
                    setShowOrders(false);
                    setSel(tile);
                  } else {
                    setShowOrders(false);
                    setShop('workshop');
                    setShowShop(true);
                  }
                }}
                onDepot={() => setSel(BARN_TILE)}
                onDeliver={(id) => work({ a: 'deliver', i: PILE_TILE, order: id })}
                onNote={(text) => work({ a: 'note', i: NOTE_TREE, text })}
                ready={ready.length}
                thirsty={thirsty}
                fields={fields}
                bank={couple.dreamBank ?? 0}
                onBank={() =>
                  collectDreamBank(couple.id, uid, myName)
                    .then((n) => n && flash(`+${n} altın kumbaradan geldi`))
                    .catch(() => {})
                }
                onClose={() => {
                  setSel(null);
                  setShowLog(false);
                  setShowOrders(false);
                  setShowShop(false);
                  setPlantAll(false);
                }}
                onLog={() => setShowLog(true)}
                onMarket={() => setShowMarket(true)}
                onKitchen={() => setSel(FIXED_ANCHOR.house[0] * N + FIXED_ANCHOR.house[1])}
                onAll={() =>
                  ready.forEach((i) => {
                    const x = farm.tiles[i];
                    if (x.k === 'crop' && CROPS[x.crop].big) return; // büyük ürün hasat günüyle
                    work({ a: x.k === 'crop' ? 'harvest' : x.k === 'tree' ? 'pick' : x.k === 'building' ? 'gather' : 'collect', i });
                  })
                }
                onSell={() => work({ a: 'sell', i: PILE_TILE })}
                onWaterAll={() =>
                  farm.tiles.forEach((x, i) => {
                    if (x.k === 'crop' && x.by !== uid && !x.watered && !cropReady(x, now)) work({ a: 'water', i });
                  })
                }
                onScene={begin}
                onStay={(a) => work(a)}
                onAct={(a, all) => {
                  if (all && a.a === 'plant') farm.tiles.forEach((x, i) => x.k === 'soil' && work({ ...a, i }));
                  else work(a);
                  setSel(null);
                  setPlantAll(false);
                }}
              />
            )}
          </View>
        </View>
        {showShop && !scene && (
          <ShopPanel
            farm={(seed && seedFarm.current) || farm}
            level={lv.level}
            shop={shop}
            setShop={setShop}
            width={Math.min(244, Math.round(box.w * 0.58))}
            top={insets.top + 104}
            bottom={insets.bottom + 10}
            hidden={!!seed}
            onClose={() => setShowShop(false)}
            onPlace={(pl) => {
              setPlacing(pl);
              setShowShop(false);
              setSel(null);
            }}
            onAct={(a) => {
              work(a);
              setShowShop(false);
            }}
          />
        )}
      </SeedDrag.Provider>
      {couple && user && (
        <FarmMarket
          open={showMarket}
          onClose={() => setShowMarket(false)}
          farm={farm}
          who={{ coupleId: couple.id, uid: user.uid, name: myName, partnerName }}
        />
      )}
      {/* Yönetimden gelen hediye paketi: her şeyin üstünde, ortada. */}
      {gift && couple && user && (
        <FarmBonusGift
          key={gift.id}
          bonus={gift}
          coupleId={couple.id}
          uid={user.uid}
          onClose={() => {
            seenGifts.current.add(gift.id);
            setGift(null);
          }}
        />
      )}
    </View>
  );
}

type SheetProps = {
  farm: Farm;
  sel: number | null;
  now: number;
  uid: string;
  partnerName: string;
  shop: Shop;
  setShop: (s: Shop) => void;
  plantAll: boolean;
  setPlantAll: (v: boolean) => void;
  showLog: boolean;
  showOrders: boolean | 'ws';
  showShop: boolean;
  onShop: () => void;
  onPlace: (pl: Placing) => void;
  onOrders: () => void;
  onWorkshop: (tile: number) => void;
  onDepot: () => void;
  onDeliver: (orderId: string) => void;
  onNote: (text: string) => void;
  ready: number;
  thirsty: number;
  fields: number;
  bank: number;
  onBank: () => void;
  onClose: () => void;
  onLog: () => void;
  onMarket: () => void;
  onKitchen: () => void;
  onAll: () => void;
  onWaterAll: () => void;
  onSell: () => void;
  onScene: (k: 'harvest' | 'market') => void;
  onAct: (a: Action, all?: boolean) => void;
  onStay: (a: Action) => void; // paneli kapatmadan iş ver (mutfak)
};

function Btn({
  label,
  onPress,
  kind = 'green',
  disabled,
  flex,
}: {
  label: string;
  onPress: () => void;
  kind?: 'green' | 'soft' | 'accent';
  disabled?: boolean;
  flex?: boolean;
}) {
  const bg = kind === 'green' ? GREEN : kind === 'accent' ? '#E8516A' : '#F3EEE8';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: flex ? 1 : undefined,
        minHeight: 46,
        borderRadius: 23,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      <Text maxFontSizeMultiplier={1.0} style={{ color: kind === 'soft' ? INK : '#fff', fontWeight: '800', fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Yuvarlak cam oyun düğmesi: arkası bulanık, renk tonlu; altında kısa etiket, köşede sayı rozeti.
// Menünün üstündeki sabit düğme: iş varsa yeşil ve sayılı, yoksa soluk ve basılamaz.
function Quick({
  icon,
  label,
  count,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  count: number;
  onPress: () => void;
}) {
  const on = count > 0;
  return (
    <Pressable
      disabled={!on}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !on }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minWidth: 140,
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: on ? '#fff' : 'rgba(255,255,255,0.5)',
        backgroundColor: on ? (pressed ? '#2F6A16' : '#3E7F22') : 'rgba(60,60,60,0.55)',
        opacity: on ? 1 : 0.75,
        transform: [{ scale: pressed ? 0.96 : 1 }],
        shadowColor: '#000',
        shadowOpacity: on ? 0.25 : 0,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: on ? 4 : 0,
      })}
    >
      <Ionicons name={icon} size={20} color={on ? '#fff' : 'rgba(255,255,255,0.6)'} />
      <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '900', fontSize: 14, color: on ? '#fff' : 'rgba(255,255,255,0.6)' }}>
        {label}
        {on ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

// Kenar düğmesi: krem zeminli, ahşap çerçeveli yuvarlak düğme; adı altında yazar.
function Edge({
  icon,
  art,
  label,
  badge,
  accent,
  big,
  onPress,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  art?: string;
  label: string;
  badge?: number;
  accent?: boolean;
  big?: boolean;
  onPress: () => void;
}) {
  const d = big ? 62 : 52;
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={4} style={{ alignItems: 'center', width: 76 }}>
      {({ pressed }) => (
        <>
          <View
            style={{
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: accent ? '#E8516A' : '#FFF8E8',
              borderWidth: 3,
              borderColor: accent ? '#B93A55' : '#9A6534',
              alignItems: 'center',
              justifyContent: 'center',
              transform: [{ scale: pressed ? 0.93 : 1 }],
              shadowColor: '#3A2A10',
              shadowOpacity: 0.3,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 3 },
              elevation: 5,
            }}
          >
            {art && ART[art] ? (
              <Image source={ART[art].src} style={{ width: d * 0.6, height: d * 0.56 }} resizeMode="contain" />
            ) : (
              <Ionicons name={icon ?? 'ellipse'} size={d * 0.46} color={accent ? '#fff' : '#7A4A1C'} />
            )}
            {!!badge && (
              <View
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 22,
                  height: 22,
                  borderRadius: 11,
                  paddingHorizontal: 5,
                  backgroundColor: accent ? '#FFD23F' : '#E8516A',
                  borderWidth: 2,
                  borderColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '900', fontSize: 12, color: accent ? '#5A3E00' : '#fff' }}>
                  {badge}
                </Text>
              </View>
            )}
          </View>
          <Text
            maxFontSizeMultiplier={1.0}
            numberOfLines={2}
            style={{
              marginTop: 3,
              fontWeight: '900',
              fontSize: 11,
              lineHeight: 13,
              color: '#fff',
              textAlign: 'center',
              textShadowColor: 'rgba(30,50,25,0.9)',
              textShadowRadius: 3,
              textShadowOffset: { width: 0, height: 1 },
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function Head({ art, title, onClose }: { art?: string; title: string; onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {art && ART[art] && <Image source={ART[art].src} style={{ width: 34, height: 30 }} resizeMode="contain" />}
      <Text maxFontSizeMultiplier={1.0} style={{ flex: 1, fontWeight: '900', fontSize: 17, color: INK }}>
        {title}
      </Text>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Kapat"
        hitSlop={8}
        style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#F3EEE8', alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="close" size={18} color={INK} />
      </Pressable>
    </View>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <Text maxFontSizeMultiplier={1.0} style={{ color: MUTED, fontSize: 13, lineHeight: 18 }}>
      {children}
    </Text>
  );
}

type Item = {
  id: string;
  wall?: WallKind;
  flowers?: boolean;
  art: string;
  name: string;
  cost: number;
  lvl: number;
  sub: string;
  a: Action;
};
// Sürükle-bırak: listedeki şey çekilince parmağı izler. Tohum ve çit geçtiği her uygun kareye konur;
// bina, ağaç, atölye ve süs bırakıldığı kareye, hayvan bırakıldığı (ya da boş yeri olan) binaya gider.
type DragItem = { a: Action; art: string; cost: number };
type SeedDragApi = { start: (it: DragItem, px: number, py: number) => void; move: (px: number, py: number) => void; end: () => void };
const SeedDrag = createContext<RefObject<SeedDragApi | null> | null>(null);
const DRAGGABLE = ['plant', 'build', 'tree', 'decor', 'adopt'];

// dir: liste yatay kayıyorsa yukarı, dikey kayıyorsa sağa çekiş sürüklemeyi başlatır (kaydırmayla karışmasın).
function SeedChip({ item, dir, children }: { item: DragItem | null; dir: 'up' | 'right'; children: ReactNode }) {
  const api = useContext(SeedDrag);
  const ref = useRef(item);
  ref.current = item;
  // Sürükleme sürerken bu parça ekrandan kalkarsa (liste değişirse) parmak olayı kaybolur; sürükleme açık kalmasın.
  const active = useRef(false);
  useEffect(
    () => () => {
      if (active.current) api?.current?.end();
    },
    [api],
  );
  const pr = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          !!ref.current &&
          !!api?.current &&
          (dir === 'up' ? g.dy < -10 && Math.abs(g.dy) > Math.abs(g.dx) : g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy)),
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          active.current = true;
          api?.current?.start(ref.current!, e.nativeEvent.pageX, e.nativeEvent.pageY);
        },
        onPanResponderMove: (e) => api?.current?.move(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderRelease: () => {
          active.current = false;
          api?.current?.end();
        },
        onPanResponderTerminate: () => {
          active.current = false;
          api?.current?.end();
        },
      }),
    [api, dir],
  );
  return <View {...pr.panHandlers}>{children}</View>;
}
const dragOf = (it: Item, off: boolean): DragItem | null =>
  !off && DRAGGABLE.includes(it.a.a) ? { a: it.a, art: it.art, cost: it.cost } : null;

function Items({ list, level, coins, onPick }: { list: Item[]; level: number; coins: number; onPick: (a: Action) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {list.map((it) => {
        const off = level < it.lvl || coins < it.cost;
        return (
          <SeedChip key={it.id} dir="up" item={dragOf(it, off)}>
            <Pressable
              disabled={off}
              onPress={() => onPick(it.a)}
              style={({ pressed }) => ({
                width: 86,
                paddingVertical: 6,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: pressed ? GREEN : '#F0E2DC',
                backgroundColor: '#FBFAF6',
                alignItems: 'center',
                opacity: off ? 0.4 : 1,
              })}
            >
              {it.wall ? (
                <View style={{ height: 44, justifyContent: 'center' }}>
                  <Wall kind={it.wall} mask={0} scale={0.62} flowers={it.flowers} />
                </View>
              ) : (
                <Image source={ART[it.art].src} style={{ width: 54, height: 44 }} resizeMode="contain" />
              )}
              <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontWeight: '800', fontSize: 12, color: INK }}>
                {it.name}
              </Text>
              <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '900', fontSize: 12, color: '#7A5A00' }}>
                {level < it.lvl ? `Seviye ${it.lvl}` : `${it.cost} altın`}
              </Text>
              <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontSize: 10, color: MUTED }}>
                {it.sub}
              </Text>
            </Pressable>
          </SeedChip>
        );
      })}
    </ScrollView>
  );
}

function ago(ms: number) {
  const m = Math.floor(ms / MIN);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} sa` : `${Math.floor(h / 24)} gün`;
}

// Hediye sepeti tezgâhı: ev ile ahır arasındaki yol karesinde durur; dokununca sepet hazırlanır / gelen sepet açılır.
const GIFT_TILE = (1 + OFF) * N + 3 + OFF;

// Depodaki bir ürünün simgesi: görseli varsa görsel, yoksa (mutfak ürünleri) emoji.
function StockIcon({ k, w, h }: { k: string; w: number; h: number }) {
  if (ART[k]) return <Image source={ART[k].src} style={{ width: w, height: h }} resizeMode="contain" />;
  return (
    <Text maxFontSizeMultiplier={1.0} style={{ fontSize: Math.round(h * 0.72), lineHeight: h, height: h }}>
      {STOCK_EMOJI[k] ?? '📦'}
    </Text>
  );
}

function Sheet(p: SheetProps) {
  const { farm, sel, now } = p;
  const level = levelOf(farm.xp).level;

  if (p.showShop) return null; // dükkân yandan açılan ayrı bir paneldir
  if (p.showOrders === 'ws') return <Workshops farm={farm} now={now} onClose={p.onClose} onPick={p.onWorkshop} />;
  if (p.showOrders)
    return <Orders farm={farm} now={now} uid={p.uid} partnerName={p.partnerName} onClose={p.onClose} onDeliver={p.onDeliver} />;
  if (sel === GIFT_TILE)
    return (
      <>
        <Head art="sepet" title="Hediye sepeti" onClose={p.onClose} />
        <Baskets
          farm={farm}
          now={now}
          uid={p.uid}
          partnerName={p.partnerName}
          onGift={(basket) => p.onAct({ a: 'gift', i: GIFT_TILE, basket })}
          onOpen={(gift) => p.onAct({ a: 'openGift', i: GIFT_TILE, gift })}
        />
      </>
    );
  if (sel === NOTE_TREE)
    return <NoteTree farm={farm} now={now} uid={p.uid} partnerName={p.partnerName} onClose={p.onClose} onNote={p.onNote} />;

  if (p.showLog)
    return (
      <>
        <Head title="Bahçe günlüğü" onClose={p.onClose} />
        <ScrollView style={{ maxHeight: 160 }}>
          {farm.log.length === 0 && <Note>Henüz bir şey olmadı. İlk tohumu ekin!</Note>}
          {farm.log.map((l, k) => (
            <View key={k} style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
              <Text maxFontSizeMultiplier={1.0} style={{ width: 46, color: MUTED, fontSize: 12 }}>
                {ago(now - l.at)}
              </Text>
              <Text maxFontSizeMultiplier={1.0} style={{ flex: 1, color: INK, fontSize: 13 }}>
                {l.text}
              </Text>
            </View>
          ))}
        </ScrollView>
      </>
    );

  if (sel === null) {
    const n = stockCount(farm);
    const big = bigReady(farm, now).length;
    const weekend = isWeekend(now);
    const small = p.ready - big;
    const kitchenReady = stationJobs(farm, 'mutfak').filter((j) => j.ready <= now).length;
    // Atölyeler: hazır ürünü olan öne alınır; düğme onu açar.
    const shops = farm.tiles
      .map((x, k) => (x.k === 'decor' && DECOR[x.item].station ? k : -1))
      .filter((k) => k >= 0)
      .map((k) => ({
        k,
        ready: stationJobs(farm, (farm.tiles[k] as { item: string }).item as Station).filter((j) => j.ready <= now).length,
      }));
    const shopReady = shops.reduce((a, b) => a + b.ready, 0);
    const shopTile = (shops.find((x) => x.ready > 0) ?? shops[0])?.k ?? -1;
    const deliverable = farm.orders.filter((o) => o.openAt <= now && canGive(farm, o) > 0).length;
    // Yalnız iş varsa kısa bir balon; altta oyun düğmeleri. Zemin yok, çiftlik görünür kalır.
    const gift = (farm.gifts ?? []).find((g) => g.from !== p.uid);
    const hungryAll = farm.tiles.reduce(
      (a, x) => a + (x.k === 'building' ? x.res.filter((r) => needsFeed(r.id) && r.fed === null).length : 0),
      0,
    );
    const hint = gift
      ? `${p.partnerName} sana ${BASKETS[gift.kind].name.toLocaleLowerCase('tr-TR')} gönderdi ${BASKETS[gift.kind].emoji}`
      : big
        ? `${big} büyük ürün hazır · hasat günü ikinizle 🌾`
        : p.thirsty
          ? `${p.partnerName}’in ${p.thirsty} ürünü susuz 💧`
          : p.bank > 0
            ? `Günlük görevden ${p.bank} altın geldi`
            : hungryAll
              ? `${hungryAll} hayvan aç · kümese ya da ağıla dokun, oradan yemle`
              : farm.harvests < 20
                ? 'Depoya ya da çimene dokun: depo, pazar, atölyeler, dükkân'
                : '';
    // Zemin yok: düğmeler iki kenarda dizilir, ortası çiftliğe açık kalır. İpucu ve toplu işler altta ortada.
    return (
      <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View pointerEvents="box-none" style={{ alignItems: 'center', gap: 10 }}>
          {p.bank > 0 && <Edge icon="gift" label={`${p.bank} al`} accent onPress={p.onBank} />}
          {big > 0 && <Edge icon="people" label="Hasat günü" accent onPress={() => p.onScene('harvest')} />}
          <Edge icon="receipt" label="Sipariş" badge={deliverable} onPress={p.onOrders} />
          {shopTile >= 0 && (
            <Edge icon="construct" label="Atölyeler" badge={shopReady} onPress={() => p.onWorkshop(shops.length > 1 ? -2 : shopTile)} />
          )}
          <Edge icon="cart" label="Dükkân" big accent onPress={p.onShop} />
        </View>
        <View pointerEvents="box-none" style={{ flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingBottom: 4 }}>
          {(p.thirsty > 0 || small > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {p.thirsty > 0 && <Quick icon="water" label="Hepsini sula" count={p.thirsty} onPress={p.onWaterAll} />}
              {small > 0 && <Quick icon="basket" label="Topla" count={small} onPress={p.onAll} />}
            </View>
          )}
          {!!hint && (
            <Text
              pointerEvents="none"
              maxFontSizeMultiplier={1.0}
              style={{
                backgroundColor: 'rgba(43,29,34,0.78)',
                color: '#fff',
                fontWeight: '700',
                fontSize: 12,
                textAlign: 'center',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {hint}
            </Text>
          )}
        </View>
        <View pointerEvents="box-none" style={{ alignItems: 'center', gap: 10 }}>
          {kitchenReady > 0 && <Edge icon="home" label="Evde hazır" badge={kitchenReady} accent onPress={p.onKitchen} />}
          <Edge icon="swap-horizontal" label="Çiftçi pazarı" onPress={p.onMarket} />
          <Edge icon="book" label="Günlük" onPress={p.onLog} />
          <Edge art="barn" label={n > 0 ? `Depo ${n}` : 'Depo'} onPress={p.onDepot} />
          {n > 0 &&
            (weekend ? (
              <Edge icon="storefront" label={`Pazar ${stockValue(farm, MARKET_BONUS)}`} big accent onPress={() => p.onScene('market')} />
            ) : (
              <Edge art="coin" label={`Sat ${stockValue(farm)}`} big onPress={p.onSell} />
            ))}
        </View>
      </View>
    );
  }

  const i = sel;
  const t: Tile = farm.tiles[i];
  if (t.k === 'locked' && isOuter(i)) {
    const price = outerPrice(farm);
    const ok = farm.coins >= price;
    return (
      <>
        <Head title="Satılık arazi" onClose={p.onClose} />
        <Note>
          Çiftliğin çevresinde {parcelTiles(farm, i).length} karelik arazi. Satın alınca çimen olur; tarla sürer, ağaç diker, bina
          kurarsınız. Her yeni arazi biraz daha pahalı.
        </Note>
        <Btn
          label={ok ? `Satın al · ${price} altın` : `${price} altın (${price - farm.coins} eksik)`}
          onPress={() => p.onAct({ a: 'unlock', i })}
          disabled={!ok}
        />
      </>
    );
  }
  if (t.k === 'locked') {
    const need = parcelNeed(farm);
    const ok = farm.harvests >= need;
    return (
      <>
        <Head title="Komşu arazi" onClose={p.onClose} />
        <Note>
          Bu parselde {parcelTiles(farm, i).length} kare var. Arazi parayla değil ortak hasatla açılır: biri eker, diğeri sular; büyük
          ürünler hasat günüyle kalkar. {ok ? 'Açılmaya hazır!' : `${need}. ortak hasatta açılır (${farm.harvests}/${need}).`}
        </Note>
        <Btn
          label={ok ? 'Araziyi aç' : `${need - farm.harvests} ortak hasat daha`}
          onPress={() => p.onAct({ a: 'unlock', i })}
          disabled={!ok}
        />
      </>
    );
  }
  if (t.k === 'path')
    return (
      <>
        <Head title="Patika" onClose={p.onClose} />
        <Note>Basılı tutup sürükleyerek de taşıyabilirsin.</Note>
        <Btn
          label={`Patika döşemeye devam et · kare ${PAVE} altın`}
          onPress={() => p.onPlace({ a: 'pave' })}
          disabled={farm.coins < PAVE}
        />
        <Btn kind="soft" label="Patikayı taşı · sonra boş bir çimene dokun" onPress={() => p.onPlace({ a: 'move', from: i })} />
        <Btn kind="soft" label="Kaldır, çimene çevir" onPress={() => p.onAct({ a: 'remove', i })} />
      </>
    );
  if (t.k === 'fixed' && t.item === 'barn') {
    const items = Object.entries(farm.stock)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    const n = stockCount(farm);
    const weekend = isWeekend(now);
    return (
      <>
        <Head art="barn" title="Ahır · Depo" onClose={p.onClose} />
        {items.length === 0 ? (
          <Note>
            Depo boş. Topladığınız ürünler burada birikir: satınca altın olur, siparişlere verilir, atölyelerde yeni ürünlere, sepet
            tezgâhında partnerine armağana dönüşür.
          </Note>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {items.map(([k, v]) => (
                <View
                  key={k}
                  style={{
                    width: 74,
                    alignItems: 'center',
                    paddingVertical: 6,
                    borderRadius: 14,
                    backgroundColor: '#FBFAF6',
                    borderWidth: 1,
                    borderColor: '#F0E2DC',
                  }}
                >
                  <StockIcon k={k} w={44} h={40} />
                  <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontWeight: '800', fontSize: 11, color: INK }}>
                    {PRODUCT_NAME[k] ?? k}
                  </Text>
                  <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '900', fontSize: 14, color: '#7A5A00' }}>
                    ×{v}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <Note>
              {n} ürün · {stockValue(farm)} altın değerinde.{' '}
              {weekend ? 'Hafta sonu: pazarı ikiniz kurarsanız bir buçuk kat.' : 'Hafta sonu pazarda bir buçuk kata gider.'}
            </Note>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {weekend ? (
                <Btn flex kind="accent" label={`Pazarı kur · ${stockValue(farm, MARKET_BONUS)}`} onPress={() => p.onScene('market')} />
              ) : (
                <Btn flex label={`Sat · ${stockValue(farm)} altın`} onPress={p.onSell} />
              )}
              <Btn kind="soft" label="Siparişler" onPress={p.onOrders} />
            </View>
          </>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {items.length === 0 && <Btn flex kind="soft" label="Siparişler" onPress={p.onOrders} />}
          <Btn flex kind="soft" label="Çiftçi pazarı" onPress={p.onMarket} />
          <Btn flex kind="soft" label="Dükkân" onPress={p.onShop} />
        </View>
        <Btn kind="soft" label="Depoyu taşı · sonra 2×2 boş çimene dokun" onPress={() => p.onPlace({ a: 'moveBarn' })} />
      </>
    );
  }
  if (t.k === 'fixed')
    return (
      <>
        <Head art={t.item} title="Eviniz" onClose={p.onClose} />
        {/* Evde artık mutfak yok. Yalnızca eski kayıtlardan kalan (ya da atölyesi kaldırılmış) yarım işler buradan toplanır. */}
        {stationJobs(farm, 'mutfak').length > 0 ? (
          <Kitchen
            farm={farm}
            level={level}
            now={now}
            onCook={(recipe) => p.onStay({ a: 'cook', i, recipe })}
            onCollect={() => p.onStay({ a: 'collectProd', i, at: 'mutfak' })}
          />
        ) : (
          <Note>Yemekler aşçı mutfağında, ekmek ve kek fırında, reçel reçel atölyesinde yapılır. Atölyeleri dükkândan alabilirsin.</Note>
        )}
        <Btn kind="soft" label="Çiftlik günlüğü" onPress={p.onLog} />
      </>
    );
  if (t.k === 'soil') {
    const empties = farm.tiles.filter((x) => x.k === 'soil').length;
    const list: Item[] = (Object.keys(CROPS) as CropId[]).map((id) => ({
      id,
      art: id,
      name: CROPS[id].name,
      cost: CROPS[id].cost,
      lvl: CROPS[id].lvl,
      sub: `${timeLeft(CROPS[id].mins * MIN)} · ${CROPS[id].sell} altın${CROPS[id].big ? ' · hasat günü' : ''}`,
      a: { a: 'plant', i, crop: id },
    }));
    return (
      <>
        <Head art="soil" title="Boş tarla" onClose={p.onClose} />
        <Note>
          Tohumu yukarı sürükleyip istediğin tarlaların üstünden geçir; geçtiğin her boş tarlaya ekilir. Dokunursan yalnızca bu tarlaya
          ekilir.
        </Note>
        <Items list={list} level={level} coins={farm.coins} onPick={(a) => p.onAct(a, p.plantAll)} />
        <Btn kind="soft" label="Tarlayı taşı · sonra boş bir çimene dokun" onPress={() => p.onPlace({ a: 'move', from: i })} />
        <Btn kind="soft" label="Çimene çevir" onPress={() => p.onAct({ a: 'remove', i })} />
        {empties > 1 && (
          <Pressable onPress={() => p.setPlantAll(!p.plantAll)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={p.plantAll ? 'checkbox' : 'square-outline'} size={20} color={GREEN} />
            <Text maxFontSizeMultiplier={1.0} style={{ color: INK, fontSize: 13 }}>
              Boş tarlaların hepsine ek ({empties})
            </Text>
          </Pressable>
        )}
      </>
    );
  }
  if (t.k === 'crop') {
    const c = CROPS[t.crop];
    const done = cropReady(t, now);
    const mine = t.by === p.uid;
    const prog = Math.min(1, (now - t.at) / Math.max(1, t.ready - t.at));
    return (
      <>
        <Head art={t.crop} title={c.name} onClose={p.onClose} />
        {done ? (
          c.big ? (
            <>
              <Note>Büyük ürün: hasat günü ikinizle olur. Biri çağırır, diğeri gelir; birlikte toplar, ortak hasat sayılır.</Note>
              <Btn kind="accent" label={`Hasat günü · ${p.partnerName}’i çağır`} onPress={() => p.onScene('harvest')} />
            </>
          ) : (
            <>
              <Note>
                Hasada hazır: depoya {c.sell} altınlık ürün, +{c.xp} tecrübe{t.watered ? ' · ortak hasat' : ''}
              </Note>
              <Btn label="Topla" onPress={() => p.onAct({ a: 'harvest', i })} />
            </>
          )
        ) : (
          <>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#EEE6DD', overflow: 'hidden' }}>
              <View style={{ width: `${Math.round(prog * 100)}%`, height: 8, backgroundColor: '#F2B33D' }} />
            </View>
            <Note>
              {timeLeft(t.ready - now)} kaldı · {mine ? 'sen ektin' : `${p.partnerName} ekti`}
              {t.watered ? ' · sulandı 💧' : ''}
            </Note>
            {!mine && !t.watered && <Btn kind="accent" label="Sula · iki kat hızlı büyür" onPress={() => p.onAct({ a: 'water', i })} />}
            {mine && !t.watered && <Note>{p.partnerName} sularsa kalan süre yarıya iner ve hasat ortak sayılır.</Note>}
            <Btn kind="soft" label="Tarlayı taşı · sonra boş bir çimene dokun" onPress={() => p.onPlace({ a: 'move', from: i })} />
            <Btn kind="soft" label="Ekini sök, çimene çevir (ekin kaybolur)" onPress={() => p.onAct({ a: 'remove', i })} />
          </>
        )}
      </>
    );
  }
  if (t.k === 'animal') {
    const an = ANIMALS[t.item];
    const done = animalReady(t, now);
    const what = productNames(t.item);
    return (
      <>
        <Head art={t.item} title={an.name} onClose={p.onClose} />
        <Note>
          {done
            ? `${what} hazır: depoya ${productValue(t.item)} altınlık ürün`
            : `${what} için ${timeLeft(t.last + an.mins * MIN - now)} kaldı`}
        </Note>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {done && <Btn flex label="Topla" onPress={() => p.onAct({ a: 'collect', i })} />}
          <Btn kind="soft" label={`Sat (+${Math.floor(an.cost / 2)})`} onPress={() => p.onAct({ a: 'remove', i })} />
        </View>
        <Note>Taşımak için üstüne basılı tutup sürükle.</Note>
      </>
    );
  }
  if (t.k === 'tree') {
    const tr = TREES[t.item];
    const done = treeReady(t, now);
    return (
      <>
        <Head art={ART[t.item] ? t.item : 'tree'} title={tr.name} onClose={p.onClose} />
        <Note>
          {done
            ? `${tr.yieldN} ${tr.fruit.toLowerCase()} olgunlaştı: depoya ${tr.yieldN * tr.sell} altınlık meyve`
            : `${t.last === t.at ? 'İlk meyve' : 'Yeni meyve'} ${timeLeft(treeReadyAt(t) - now)} sonra · her ${timeLeft(tr.mins * MIN)}te ${tr.yieldN} ${tr.fruit.toLowerCase()}`}
        </Note>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {done && <Btn flex label="Meyve topla" onPress={() => p.onAct({ a: 'pick', i })} />}
          <Btn kind="soft" label={`Kes (+${Math.floor(tr.cost / 2)})`} onPress={() => p.onAct({ a: 'remove', i })} />
        </View>
        <Note>Taşımak için üstüne basılı tutup sürükle.</Note>
      </>
    );
  }
  if (t.k === 'decor' && DECOR[t.item].station) {
    const d = DECOR[t.item];
    const st = t.item as Station;
    return (
      <>
        <Head art={d.sp} title={d.name} onClose={p.onClose} />
        <Kitchen
          farm={farm}
          level={level}
          now={now}
          station={st}
          onCook={(recipe) => p.onStay({ a: 'cook', i, recipe })}
          onCollect={() => p.onStay({ a: 'collectProd', i, at: st })}
        />
        {stationJobs(farm, st).length === 0 && (
          <Btn kind="soft" label={`Kaldır (+${Math.floor(d.cost / 2)})`} onPress={() => p.onAct({ a: 'remove', i })} />
        )}
        <Note>Taşımak için üstüne basılı tutup sürükle.</Note>
      </>
    );
  }
  if (t.k === 'decor') {
    const d = DECOR[t.item];
    return (
      <>
        <Head art={d.wall ? undefined : d.sp} title={d.name} onClose={p.onClose} />
        <Note>
          {t.item === 'sera'
            ? 'Çevresindeki 2 kare içindeki tarlalara ekilen ekin %25 daha çabuk büyür (yeni ekilenlerde geçerli).'
            : t.item === 'degirmen'
              ? 'Değirmen çiftlikteyken fırında ekmek ve kek çift çıkar.'
              : 'Bahçenizi güzelleştiriyor.'}
        </Note>
        {d.wall &&
          (() => {
            const n = farm.tiles.filter((x) => x.k === 'decor' && x.item === t.item).length;
            return (
              <>
                <Btn
                  label={d.flowers ? 'Çiçekleri kaldır' : `Dibine çiçek ek · ${BLOOM} altın`}
                  onPress={() => p.onAct({ a: 'bloom', i })}
                  disabled={!d.flowers && farm.coins < BLOOM}
                />
                {n > 1 && (
                  <Btn
                    kind="soft"
                    label={d.flowers ? `Hepsinin çiçeğini kaldır (${n} parça)` : `Hepsine çiçek ek · ${n} parça, ${n * BLOOM} altın`}
                    onPress={() => p.onAct({ a: 'bloom', i, all: true })}
                    disabled={!d.flowers && farm.coins < n * BLOOM}
                  />
                )}
              </>
            );
          })()}
        <Btn kind="soft" label={`Kaldır (+${Math.floor(d.cost / 2)})`} onPress={() => p.onAct({ a: 'remove', i })} />
        <Note>Taşımak için üstüne basılı tutup sürükle.</Note>
      </>
    );
  }
  if (t.k === 'building') {
    const b = BUILDINGS[t.item];
    const ready = t.res.filter((r) => residentReady(r, now)).length;
    const hungry = t.res.filter((r) => needsFeed(r.id) && r.fed === null).length;
    const wheat = farm.stock.bugday ?? 0;
    return (
      <>
        <Head art={t.item} title={`${b.name} · ${t.res.length}/${b.cap}`} onClose={p.onClose} />
        {t.res.length === 0 && <Note>Boş. Aşağıdan hayvan al; burada yaşar, yemlenir, ürün verir.</Note>}
        {t.res.length > 0 && (
          <View style={{ gap: 6 }}>
            {t.res.map((r, k) => {
              const an = ANIMALS[r.id];
              const isReady = residentReady(r, now);
              const hungryOne = needsFeed(r.id) && r.fed === null;
              return (
                <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Image source={ART[r.id].src} style={{ width: 34, height: 30 }} resizeMode="contain" />
                  <Text maxFontSizeMultiplier={1.0} style={{ flex: 1, fontWeight: '800', fontSize: 13, color: INK }}>
                    {an.name}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={1.0}
                    style={{ fontSize: 12, color: isReady ? GREEN : hungryOne ? '#B4521E' : MUTED, fontWeight: '700' }}
                  >
                    {isReady
                      ? `${productNames(r.id)} hazır`
                      : hungryOne
                        ? 'aç · yemle'
                        : `${productNames(r.id)} ${timeLeft(residentReadyAt(r) - now)} sonra`}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {ready > 0 && <Btn flex label={`Topla (${ready})`} onPress={() => p.onAct({ a: 'gather', i })} />}
          {hungry > 0 && (
            <Btn
              flex
              kind="accent"
              label={`Yemle (${hungry}) · ${wheat ? `${Math.min(wheat, hungry)} buğday` : `${hungry * 5} altın`}`}
              onPress={() => p.onAct({ a: 'feed', i })}
            />
          )}
        </View>
        {t.res.length < b.cap && (
          <>
            <Note>Hayvan al:</Note>
            <Items
              list={b.animals.map((id) => ({
                id,
                art: id,
                name: ANIMALS[id].name,
                cost: ANIMALS[id].cost,
                lvl: ANIMALS[id].lvl,
                sub: `${productNames(id)} · ${timeLeft(ANIMALS[id].mins * MIN)}`,
                a: { a: 'adopt', i, item: id },
              }))}
              level={level}
              coins={farm.coins}
              onPick={(a) => p.onAct(a)}
            />
          </>
        )}
        {t.res.length === 0 && (
          <Btn kind="soft" label={`Kaldır (+${Math.floor(b.cost / 2)})`} onPress={() => p.onAct({ a: 'remove', i })} />
        )}
        <Note>Taşımak için üstüne basılı tutup sürükle.</Note>
        <Note>
          {needsFeed(b.animals[0])
            ? 'Yem: depodan 1 buğday, yoksa 5 altın. Yemlenen hayvan süre dolunca ürün verir.'
            : 'Arılar yemsiz; bal kendi döngüsünde olur.'}
        </Note>
      </>
    );
  }
  // çimen: bir şey koymak dükkândan seçilir; burada yalnız tarla sürülür.
  return (
    <>
      <Head title="Boş çimen" onClose={p.onClose} />
      <Note>Buraya bina, ağaç ya da süs koymak için dükkânı aç ve seç; sonra bu kareye dokun. Ya da tarla sür.</Note>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn flex label={`Tarla sür · ${TILL} altın`} onPress={() => p.onAct({ a: 'till', i })} disabled={farm.coins < TILL} />
        <Btn flex kind="soft" label="Dükkân" onPress={p.onShop} />
      </View>
      <Btn
        kind="soft"
        label={`Patika döşe · kare ${PAVE} altın`}
        onPress={() => {
          p.onAct({ a: 'pave', i });
          p.onPlace({ a: 'pave' });
        }}
        disabled={farm.coins < PAVE}
      />
    </>
  );
}

// Dükkân: tohum, hayvan, bina, ağaç, süs. Yere konacaklar seçilince yerleştirme moduna geçilir.
const SHOP_TABS: { id: Shop; art: string; title: string }[] = [
  { id: 'crop', art: 'misir', title: 'Tarla ürünleri' },
  { id: 'animal', art: 'tavuk', title: 'Hayvanlar' },
  { id: 'building', art: 'kumes', title: 'Hayvan evleri' },
  { id: 'workshop', art: 'firin', title: 'Atölyeler' },
  { id: 'tree', art: 'elma', title: 'Ağaçlar' },
  { id: 'decor', art: 'fountain', title: 'Süsler' },
];

// Dükkân: soldan açılan panel. Kategoriler sağ kenarda resimli sekme; ürünler iki sütun, sağa sürüklenip yere bırakılır.
function ShopPanel({
  farm,
  level,
  shop,
  setShop,
  width,
  top,
  bottom,
  hidden,
  onClose,
  onPlace,
  onAct,
}: {
  farm: Farm;
  level: number;
  shop: Shop;
  setShop: (s: Shop) => void;
  width: number;
  top: number;
  bottom: number;
  hidden: boolean;
  onClose: () => void;
  onPlace: (pl: Placing) => void;
  onAct: (a: Action) => void;
}) {
  const soil = farm.tiles.filter((x) => x.k === 'soil').length;
  const list: Item[] =
    shop === 'crop'
      ? (Object.keys(CROPS) as CropId[]).map((id) => ({
          id,
          art: id,
          name: CROPS[id].name,
          cost: CROPS[id].cost,
          lvl: CROPS[id].lvl,
          sub: `${timeLeft(CROPS[id].mins * MIN)} · ${CROPS[id].sell} altın${CROPS[id].big ? ' · hasat günü' : ''}`,
          a: { a: 'plant', i: -1, crop: id },
        }))
      : shop === 'animal'
        ? (Object.keys(ANIMALS) as AnimalId[]).map((id) => ({
            id,
            art: id,
            name: ANIMALS[id].name,
            cost: ANIMALS[id].cost,
            lvl: ANIMALS[id].lvl,
            sub: `${BUILDINGS[buildingFor(id)].name} · ${productNames(id)}`,
            a: { a: 'adopt', i: -1, item: id },
          }))
        : shop === 'building'
          ? (Object.keys(BUILDINGS) as BuildingId[]).map((id) => ({
              id,
              art: id,
              name: BUILDINGS[id].name,
              cost: BUILDINGS[id].cost,
              lvl: BUILDINGS[id].lvl,
              sub: `${BUILDINGS[id].animals.map((a) => ANIMALS[a].name).join(', ')} · ${BUILDINGS[id].cap} yer`,
              a: { a: 'build', i: -1, item: id },
            }))
          : shop === 'tree'
            ? (Object.keys(TREES) as TreeId[]).map((id) => ({
                id,
                art: ART[id] ? id : 'tree',
                name: TREES[id].name,
                cost: TREES[id].cost,
                lvl: TREES[id].lvl,
                sub: `${TREES[id].yieldN} ${TREES[id].fruit.toLowerCase()} / ${timeLeft(TREES[id].mins * MIN)}`,
                a: { a: 'tree', i: -1, item: id },
              }))
            : (Object.keys(DECOR) as DecorId[])
                // Atölyeler kendi sekmesinde durur; süslerin arasında aranmaz.
                .filter((id) => !DECOR[id].hidden && !!DECOR[id].station === (shop === 'workshop'))
                .sort((x, y) => (shop === 'workshop' ? DECOR[x].lvl - DECOR[y].lvl : 0))
                .map((id) => ({
                  id,
                  wall: DECOR[id].wall,
                  flowers: DECOR[id].flowers,
                  art: DECOR[id].sp,
                  name: DECOR[id].name,
                  cost: DECOR[id].cost,
                  lvl: DECOR[id].lvl,
                  sub: DECOR[id].perk ?? `+${DECOR[id].xp} tecrübe`,
                  a: { a: 'decor', i: -1, item: id },
                }));
  const pick = (a: Action) => {
    if (a.a === 'plant') return onPlace({ a: 'plant', crop: a.crop });
    if (a.a === 'build') return onPlace({ a: 'build', item: a.item });
    if (a.a === 'tree') return onPlace({ a: 'tree', item: a.item });
    if (a.a === 'decor') return onPlace({ a: 'decor', item: a.item });
    if (a.a === 'adopt') {
      // Boş yeri olan uygun binaya girer; bina yoksa önce bina kurulur.
      const need = buildingFor(a.item);
      const j = farm.tiles.findIndex((x) => x.k === 'building' && x.item === need && x.res.length < BUILDINGS[need].cap);
      if (j >= 0) return onAct({ a: 'adopt', i: j, item: a.item });
      return onAct({ a: 'adopt', i: -1, item: a.item }); // kural metni: "önce bina kur"
    }
  };
  // Sahip olunan sayı: atölyeden bir tane olur (alınmışsa kapalı); hayvan evleri kaç tane kurulduysa.
  const owned = (it: Item) =>
    it.a.a === 'decor' && DECOR[it.a.item].station
      ? farm.tiles.filter((x) => x.k === 'decor' && x.item === it.id).length
      : it.a.a === 'build'
        ? farm.tiles.filter((x) => x.k === 'building' && x.item === it.id).length
        : 0;
  const cell = (width - 6 - 16 - 8) / 2;
  const tab = SHOP_TABS.find((x) => x.id === shop) ?? SHOP_TABS[0];
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 8, top, bottom, width: width + 48, opacity: hidden ? 0 : 1 }}>
      <View style={{ position: 'absolute', left: width - 3, top: 52, gap: 5 }}>
        {SHOP_TABS.map((x) => {
          const on = x.id === shop;
          return (
            <Pressable
              key={x.id}
              onPress={() => setShop(x.id)}
              accessibilityLabel={x.title}
              style={{
                width: on ? 48 : 44,
                height: 46,
                borderTopRightRadius: 12,
                borderBottomRightRadius: 12,
                borderWidth: 3,
                borderLeftWidth: 0,
                borderColor: '#9A6534',
                backgroundColor: on ? '#FFF8E8' : '#E9C480',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {ART[x.art] && <Image source={ART[x.art].src} style={{ width: 32, height: 30 }} resizeMode="contain" />}
            </Pressable>
          );
        })}
      </View>
      <View
        style={{
          width,
          flex: 1,
          backgroundColor: 'rgba(255,248,232,0.97)',
          borderRadius: 20,
          borderWidth: 3,
          borderColor: '#9A6534',
          padding: 8,
          gap: 8,
          shadowColor: '#3A2A10',
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Head title={tab.title} onClose={onClose} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {list.map((it) => {
            const have = owned(it);
            const full = have > 0 && it.a.a === 'decor';
            const locked = level < it.lvl;
            const off = locked || full || farm.coins < it.cost;
            return (
              <SeedChip key={it.id} dir="right" item={dragOf(it, off)}>
                <Pressable
                  disabled={off}
                  onPress={() => pick(it.a)}
                  style={({ pressed }) => ({
                    width: cell,
                    paddingVertical: 6,
                    paddingHorizontal: 3,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: pressed ? GREEN : '#E5C99B',
                    backgroundColor: locked ? '#EEE4D0' : '#FBFAF6',
                    alignItems: 'center',
                  })}
                >
                  <View style={{ height: 54, justifyContent: 'center', opacity: off ? 0.45 : 1 }}>
                    {it.wall ? (
                      <Wall kind={it.wall} mask={0} scale={0.62} flowers={it.flowers} />
                    ) : ART[it.art] ? (
                      <Image source={ART[it.art].src} style={{ width: 64, height: 54 }} resizeMode="contain" />
                    ) : null}
                  </View>
                  <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontWeight: '800', fontSize: 12, color: INK }}>
                    {it.name}
                  </Text>
                  {locked ? (
                    <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 12, color: '#8A6F4A' }}>
                      Seviye {it.lvl}
                    </Text>
                  ) : full ? (
                    <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 12, color: '#3E7F22' }}>
                      1/1 · kuruldu
                    </Text>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Image source={ART.coin.src} style={{ width: 14, height: 14 }} resizeMode="contain" />
                      <Text
                        maxFontSizeMultiplier={1.0}
                        style={{ fontWeight: '900', fontSize: 12, color: farm.coins < it.cost ? '#B93A55' : '#7A5A00' }}
                      >
                        {it.cost}
                      </Text>
                    </View>
                  )}
                  <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontSize: 10, color: MUTED }}>
                    {it.sub}
                  </Text>
                  {have > 0 && !full && (
                    <Text
                      maxFontSizeMultiplier={1.0}
                      style={{ position: 'absolute', top: 4, left: 6, fontWeight: '900', fontSize: 11, color: '#7A4A1C' }}
                    >
                      ×{have}
                    </Text>
                  )}
                </Pressable>
              </SeedChip>
            );
          })}
        </ScrollView>
        <Text maxFontSizeMultiplier={1.0} style={{ color: MUTED, fontSize: 11, lineHeight: 15, textAlign: 'center' }}>
          {shop === 'crop'
            ? soil
              ? 'Sağa sürükle, tarlaların üstünden geçir'
              : 'Boş tarla yok: çimene dokunup tarla sür'
            : shop === 'animal'
              ? 'Sürükleyip kümese, ağıla ya da kovana bırak'
              : 'Sağa sürükle, boş çimene bırak'}
        </Text>
      </View>
    </View>
  );
}

// Sipariş defteri: kasabadaki çiftlerin 3 açık siparişi; depodan teslim edilir, ikisi de katkı verirse ortak hasat sayılır.
// Sipariş tamamlanınca sahibi çift posta kutusuna almaya gelir.
function Orders({
  farm,
  now,
  uid,
  partnerName,
  onClose,
  onDeliver,
}: {
  farm: Farm;
  now: number;
  uid: string;
  partnerName: string;
  onClose: () => void;
  onDeliver: (id: string) => void;
}) {
  const who = (o: Order) => (o.by.length ? o.by.map((b) => (b === uid ? 'sen' : partnerName)).join(' + ') : '');
  return (
    <>
      <Head title="Sipariş defteri" onClose={onClose} />
      <Note>
        Siparişi teslim edince sahibi çift girişe gelir; yanlarına gidip dokununca ürünleri verirsiniz, altın ve tecrübe o an kazanılır.
        İkiniz de katkı verirseniz ortak hasat sayılır.
      </Note>
      <ScrollView style={{ maxHeight: 230 }} contentContainerStyle={{ gap: 8 }}>
        {farm.orders.length === 0 && <Note>İlk işinizden sonra deftere sipariş yazılmaya başlar.</Note>}
        {farm.orders.map((o) => {
          const open = o.openAt <= now;
          const give = canGive(farm, o);
          const left = orderLeft(o);
          const leftN = Object.values(left).reduce((a, b) => a + b, 0);
          return (
            <View
              key={o.id}
              style={{ borderWidth: 1, borderColor: '#F0E2DC', borderRadius: 14, padding: 10, gap: 6, opacity: open ? 1 : 0.55 }}
            >
              {open ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        backgroundColor: '#FDE7EA',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="heart" size={15} color="#E8516A" />
                    </View>
                    <Text maxFontSizeMultiplier={1.0} style={{ flex: 1, fontWeight: '800', fontSize: 14, color: INK }}>
                      {orderWho(o)}
                      {o.special ? ' · özel sipariş ⭐' : ''}
                    </Text>
                    <Text maxFontSizeMultiplier={1.0} style={{ color: MUTED, fontSize: 12 }}>
                      +{o.coins} altın · +{o.xp} tecrübe
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {Object.entries(o.items).map(([k, q]) => (
                      <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <StockIcon k={k} w={22} h={22} />
                        <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 13, color: left[k] ? INK : GREEN }}>
                          {o.given[k] ?? 0}/{q} {PRODUCT_NAME[k] ?? k}
                        </Text>
                        {left[k] > 0 && (
                          <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 11, color: (farm.stock[k] ?? 0) > 0 ? GREEN : MUTED }}>
                            · depoda {farm.stock[k] ?? 0}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text maxFontSizeMultiplier={1.0} style={{ flex: 1, color: MUTED, fontSize: 12 }}>
                      {who(o) ? `Katkı: ${who(o)}` : ''}
                    </Text>
                    <Btn
                      kind={give ? 'green' : 'soft'}
                      label={
                        o.packed
                          ? 'Girişte bekliyorlar'
                          : give
                            ? give >= leftN
                              ? 'Teslim et, gelsinler'
                              : `Hazır olanı ayır (${give})`
                            : 'Depoda yok'
                      }
                      onPress={() => onDeliver(o.id)}
                      disabled={!give}
                    />
                  </View>
                </>
              ) : (
                <Text maxFontSizeMultiplier={1.0} style={{ color: MUTED, fontSize: 13 }}>
                  Yeni sipariş {timeLeft(o.openAt - now)} sonra yazılacak
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

// Not Ağacı: evin yanındaki ağaç. Kısa notlar; yalnız ikiniz görürsünüz.
// Mutfak: depodaki ürünlerden tarif işe konur, süresi dolunca buradan toplanır. Aynı anda birkaç iş (seviyeyle artar).
// Atölye listesi: kurulu atölyeler ve durumları; dokununca o atölyenin üretim paneli açılır.
function Workshops({ farm, now, onClose, onPick }: { farm: Farm; now: number; onClose: () => void; onPick: (tile: number) => void }) {
  const level = levelOf(farm.xp).level;
  const rows = farm.tiles
    .map((x, k) => (x.k === 'decor' && DECOR[x.item].station ? { k, st: x.item as Station } : null))
    .filter((x): x is { k: number; st: Station } => !!x)
    .map((x) => {
      const jobs = stationJobs(farm, x.st);
      const ready = jobs.filter((j) => j.ready <= now).length;
      const next = jobs.filter((j) => j.ready > now).sort((a, b) => a.ready - b.ready)[0];
      return { ...x, jobs: jobs.length, ready, next, slots: stationSlots(x.st, level) };
    })
    .sort((a, b) => b.ready - a.ready);
  return (
    <>
      <Head title="Atölyeler" onClose={onClose} />
      <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
        {rows.map((r) => (
          <Pressable
            key={r.k}
            onPress={() => onPick(r.k)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F6EFE6', borderRadius: 14, padding: 10 }}
          >
            <StockIcon k={r.st} w={40} h={36} />
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 14, color: INK }}>
                {STATIONS[r.st].name}
              </Text>
              <Text
                maxFontSizeMultiplier={1.0}
                style={{ fontSize: 12, color: r.ready ? GREEN : MUTED, fontWeight: r.ready ? '800' : '400' }}
              >
                {r.ready
                  ? `${r.ready} ürün hazır, topla`
                  : r.next
                    ? `Üretimde · ${timeLeft(r.next.ready - now)} sonra hazır`
                    : `Boş · ${r.slots} ${STATIONS[r.st].slot}`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED} />
          </Pressable>
        ))}
      </ScrollView>
      <Btn kind="soft" label="Yeni atölye al" onPress={() => onPick(-1)} />
    </>
  );
}

function Kitchen({
  farm,
  level,
  now,
  station = 'mutfak',
  onCook,
  onCollect,
}: {
  farm: Farm;
  level: number;
  now: number;
  station?: Station;
  onCook: (r: RecipeId) => void;
  onCollect: () => void;
}) {
  const jobs = stationJobs(farm, station);
  const slots = Math.max(stationSlots(station, level), jobs.length);
  const full = jobs.length >= slots;
  const ready = jobs.filter((j) => j.ready <= now).length;
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {Array.from({ length: slots }, (_, k) => {
          const j = jobs[k];
          const done = !!j && j.ready <= now;
          return (
            <View
              key={k}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 6,
                borderRadius: 14,
                backgroundColor: done ? '#E9F6DF' : '#FBFAF6',
                borderWidth: 1,
                borderColor: done ? GREEN : '#F0E2DC',
                minHeight: 74,
                justifyContent: 'center',
              }}
            >
              {j ? (
                <>
                  <StockIcon k={j.recipe} w={34} h={32} />
                  <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 11, color: done ? GREEN : INK }}>
                    {done ? 'Hazır' : timeLeft(j.ready - now)}
                  </Text>
                </>
              ) : (
                <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 11, color: MUTED }}>
                  Boş {STATIONS[station].slot}
                </Text>
              )}
            </View>
          );
        })}
      </View>
      {ready > 0 ? (
        <Btn kind="accent" label={`Hazır olanları topla (${ready})`} onPress={onCollect} />
      ) : (
        <Note>
          {jobs.length
            ? 'Üretim sürüyor. Süre dolunca buradan toplarsın; ürün depoya girer.'
            : 'Depodaki ürünlerden bir ürün seç; süresi dolunca buradan toplanır. Daha pahalıya satılır, siparişlerde istenir.'}
        </Note>
      )}
      <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ gap: 8 }}>
        {(Object.keys(RECIPES) as RecipeId[])
          .filter((id) => stationOf(id, farm) === station)
          .sort((x, y) => RECIPES[x].lvl - RECIPES[y].lvl)
          // Liste uzamasın: açılmış tarifler ve sıradaki iki kilitli tarif görünür.
          .filter((id, k, all) => RECIPES[id].lvl <= level || all.filter((q) => RECIPES[q].lvl > level).indexOf(id) < 2)
          .map((id) => {
            const r = RECIPES[id];
            const locked = level < r.lvl;
            const ok = !locked && !full && hasAll(farm, r.needs);
            return (
              <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: locked ? 0.5 : 1 }}>
                <StockIcon k={id} w={34} h={34} />
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 13, color: INK }}>
                    {r.name} · {r.sell} altın · {timeLeft(r.mins * MIN)}
                    {(farm.stock[id] ?? 0) > 0 ? ` · depoda ${farm.stock[id]}` : ''}
                  </Text>
                  {locked ? (
                    <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 12, color: MUTED }}>
                      {r.lvl}. seviyede açılır
                    </Text>
                  ) : (
                    <>
                      {/* Malzemeler: her biri resmiyle ve "depoda/gereken" sayısıyla; yeten yeşil, eksik kırmızı. */}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                        {Object.entries(r.needs).map(([k, q]) => {
                          const have = farm.stock[k] ?? 0;
                          const enough = have >= q;
                          return (
                            <View
                              key={k}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 3,
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: 10,
                                backgroundColor: enough ? '#E8F5E4' : '#FDE7EA',
                              }}
                            >
                              <StockIcon k={k} w={16} h={16} />
                              <Text
                                maxFontSizeMultiplier={1.0}
                                style={{ fontSize: 11, fontWeight: '800', color: enough ? GREEN : '#C7354F' }}
                              >
                                {PRODUCT_NAME[k]} {Math.min(have, q)}/{q}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                      {/* Eksik malzeme nereden gelir: tek tek, açıkça. */}
                      {Object.entries(r.needs)
                        .filter(([k, q]) => (farm.stock[k] ?? 0) < q)
                        .map(([k, q]) => (
                          <Text key={k} maxFontSizeMultiplier={1.0} style={{ fontSize: 11, color: '#C7354F', marginTop: 2 }}>
                            {q - (farm.stock[k] ?? 0)} {PRODUCT_NAME[k].toLocaleLowerCase('tr-TR')} eksik · {sourceOf(k, farm)}
                          </Text>
                        ))}
                    </>
                  )}
                </View>
                <Btn
                  kind={ok ? 'green' : 'soft'}
                  label={ok ? 'Başlat' : locked ? 'Kilitli' : full ? 'Dolu' : 'Eksik'}
                  disabled={!ok}
                  onPress={() => onCook(id)}
                />
              </View>
            );
          })}
      </ScrollView>
    </>
  );
}

// Hediye sepeti: depodan hazırlanır, partnere gider. Partner açınca çiftlik altın, çift puan kazanır; ortak hasat sayılır.
function Baskets({
  farm,
  now,
  uid,
  partnerName,
  onGift,
  onOpen,
}: {
  farm: Farm;
  now: number;
  uid: string;
  partnerName: string;
  onGift: (b: BasketId) => void;
  onOpen: (id: string) => void;
}) {
  const incoming = (farm.gifts ?? []).filter((g) => g.from !== uid);
  const wait = giftWait(farm, uid, now);
  return (
    <>
      {incoming.map((g) => (
        <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <StockIcon k={BASKETS[g.kind].art} w={36} h={34} />
          <Text maxFontSizeMultiplier={1.0} style={{ flex: 1, fontWeight: '800', fontSize: 13, color: INK }}>
            {partnerName} sana {BASKETS[g.kind].name.toLocaleLowerCase('tr-TR')} gönderdi
          </Text>
          <Btn kind="accent" label="Aç" onPress={() => onOpen(g.id)} />
        </View>
      ))}
      <Note>
        {wait === 'pending'
          ? `Gönderdiğin sepet ${partnerName} açınca ödüle dönüşecek. O açmadan yenisi gönderilmez.`
          : wait === 'day'
            ? 'Bugünkü sepetini gönderdin; yarın yenisini hazırlayabilirsin.'
            : `Sepeti hazırla, ${partnerName} açsın: çiftliğe altın, ikinize puan gelir ve ortak hasat sayılır. Günde bir sepet.`}
      </Note>
      <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ gap: 8 }}>
        {(Object.keys(BASKETS) as BasketId[]).map((id) => {
          const b = BASKETS[id];
          const ok = !wait && hasAll(farm, b.needs);
          return (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <StockIcon k={b.art} w={36} h={34} />
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 13, color: INK }}>
                  {b.name} · +{b.coins} altın, +{b.points} puan
                </Text>
                <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 12, color: hasAll(farm, b.needs) ? GREEN : MUTED }}>
                  {needsText(b.needs)}
                </Text>
              </View>
              <Btn
                kind={ok ? 'green' : 'soft'}
                label={ok ? 'Gönder' : wait ? 'Bekle' : 'Eksik'}
                disabled={!ok}
                onPress={() => onGift(id)}
              />
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

function NoteTree({
  farm,
  now,
  uid,
  partnerName,
  onClose,
  onNote,
}: {
  farm: Farm;
  now: number;
  uid: string;
  partnerName: string;
  onClose: () => void;
  onNote: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const leftToday = NOTES_PER_DAY - notesToday(farm, uid, now);
  return (
    <>
      <Head art="tree" title="Not Ağacı" onClose={onClose} />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={farm.notes.length ? 'Bir not as…' : 'İlk notu sen as: “Bugün seni düşündüm.”'}
          placeholderTextColor={MUTED}
          maxLength={NOTE_MAX}
          multiline
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 90,
            borderWidth: 1,
            borderColor: '#F0E2DC',
            borderRadius: 12,
            padding: 10,
            color: INK,
            fontSize: 14,
          }}
        />
        <Btn
          label="As"
          disabled={!text.trim() || leftToday <= 0}
          onPress={() => {
            onNote(text);
            setText('');
          }}
        />
      </View>
      <ScrollView style={{ maxHeight: 170 }} contentContainerStyle={{ gap: 6 }}>
        {farm.notes.length === 0 && <Note>Ağaç boş. Birbirinize kısa notlar bırakın; yalnız ikiniz görürsünüz.</Note>}
        {farm.notes.map((n, k) => {
          const mine = n.by === uid;
          return (
            <View
              key={k}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: mine ? '#EAF6DF' : '#FFF4E6',
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text maxFontSizeMultiplier={1.0} style={{ color: INK, fontSize: 14 }}>
                {n.text}
              </Text>
              <Text maxFontSizeMultiplier={1.0} style={{ color: MUTED, fontSize: 10, textAlign: mine ? 'right' : 'left' }}>
                {mine ? 'sen' : partnerName} · {ago(now - n.at)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}
