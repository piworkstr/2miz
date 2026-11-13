import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, LinearGradient, Path, Pattern, Polygon, Rect, Stop } from 'react-native-svg';
import { Avatar } from '../components/Avatar';
import { ScenePanel, type SceneMeta } from '../components/world/ScenePanel';
import { GlassCircle } from '../components/Glass';
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
  farmOf,
  FIXED_ANCHOR,
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
} from '../lib/farm';
import { logActivityCapped } from '../lib/bond';
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
const PILE_TILE = (2 + OFF) * N + 4 + OFF; // ahırın önü (iç çiftlikte (2,4))

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
// Bütün arazi (14x14): sürükleme buraya kadar
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
type Shop = 'crop' | 'animal' | 'building' | 'tree' | 'decor';
// Dükkandan seçilen, yere konacak şey: sonraki dokunuş o kareye yerleştirir.
type Placing =
  | { a: 'plant'; crop: CropId }
  | { a: 'build'; item: BuildingId }
  | { a: 'tree'; item: TreeId }
  | { a: 'decor'; item: DecorId }
  | { a: 'move'; from: number }; // yerleştirilmiş bir şeyi taşı
type Spr = { key: string; art: string; x: number; y: number; w: number; z: number; o?: number };

function sprites(f: Farm, now: number): Spr[] {
  const out: Spr[] = [];
  f.tiles.forEach((t, i) => {
    const [r, c] = rc(i);
    const { x, y } = center(r, c);
    const base = { x, y: y + TH / 2 + TW * 0.11, z: zOf(r, c) + 5, w: TW * 1.02 };
    const up = { x, y: y + TH * 0.32, z: zOf(r, c) + 6 };
    if (t.k === 'soil') out.push({ key: `s${i}`, art: 'soil', ...base });
    if (t.k === 'crop') {
      const p = Math.min(1, (now - t.at) / Math.max(1, t.ready - t.at));
      out.push({ key: `s${i}`, art: cropReady(t, now) ? t.crop : p < 0.35 ? 'sprout' : 'young', ...base });
    }
    if (t.k === 'animal') out.push({ key: `s${i}`, art: t.item, ...up, w: TW * ANIMALS[t.item].w });
    if (t.k === 'tree') out.push({ key: `s${i}`, art: ART[t.item] ? t.item : 'tree', ...up, w: TW * TREES[t.item].w });
    if (t.k === 'building') {
      out.push({ key: `s${i}`, art: t.item, ...up, y: up.y + TH * 0.25, w: TW * BUILDINGS[t.item].w });
      // İçindekiler binanın önünde küçük küçük görünür.
      t.res.forEach((r, k) => {
        if (r.id === 'ari') return;
        out.push({
          key: `s${i}r${k}`,
          art: r.id,
          x: up.x + (k - 1) * TW * 0.3,
          y: up.y + TH * 0.62 + (k % 2) * 4,
          z: up.z + 1,
          w: TW * ANIMALS[r.id].w * 0.45,
        });
      });
    }
    if (t.k === 'decor') out.push({ key: `s${i}`, art: DECOR[t.item].sp, ...up, w: TW * DECOR[t.item].w });
    if (i === GIFT_TILE && ART.sepet) out.push({ key: 'sepet', art: 'sepet', ...up, y: up.y + TH * 0.2, w: TW * 0.95 });
    if (t.k === 'fixed') {
      const [ar, ac] = FIXED_ANCHOR[t.item];
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
const SCENERY: Spr[] = (() => {
  const L = center(N - 1, 0);
  const R = center(0, N - 1);
  const T = center(0, 0);
  const B = center(N - 1, N - 1);
  const btm = B.y + TH / 2;
  const s = (art: string, x: number, y: number, w: number, z: number, k: number): Spr => ({ key: `sc${k}`, art, x, y, w, z });
  return [
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
  if (!a) return null;
  const h = s.w * a.h;
  return (
    <Image
      source={a.src}
      style={{ position: 'absolute', left: s.x - s.w / 2, top: s.y - h, width: s.w, height: h, zIndex: s.z, opacity: s.o ?? 1 }}
    />
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
  const hiTiles = sel === null ? [] : f.tiles[sel].k === 'locked' ? parcelTiles(f, sel) : [sel];
  return (
    <Svg width={WW} height={WH} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <Pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <Rect width="3" height="7" fill="#5D8A36" />
        </Pattern>
      </Defs>
      {/* Tabakanın altına yumuşak gölge: manzaraya oturur */}
      <Ellipse cx={B.x} cy={btm + D - 2} rx={TW * 5.6} ry={TW * 1.1} fill="rgba(40,60,20,0.18)" />
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

function FloatText({ x, y, text }: { x: number; y: number; text: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [v]);
  return (
    <Animated.Text
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: x - 40,
        top: y,
        width: 80,
        textAlign: 'center',
        zIndex: 4000,
        color: '#fff',
        fontWeight: '900',
        fontSize: 16,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowRadius: 3,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) }],
      }}
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
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [now, setNow] = useState(Date.now());
  const [sel, setSel] = useState<number | null>(null);
  const [shop, setShop] = useState<Shop>('crop');
  const [plantAll, setPlantAll] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
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
  const [say, setSay] = useState('');
  const [tool, setTool] = useState<string | null>(null);
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const scene = useOpenScene(couple?.id, 'farm');

  const farm = farmOf(couple);
  const uid = user?.uid ?? '';
  const myName = profile?.name ?? 'Ben';
  const [myTile, setMyTile] = useState<number>(() => farm.pos[uid] ?? (2 + OFF) * N + 2 + OFF);
  const myTileRef = useRef(myTile);
  const partnerTile = (partnerId ? farm.pos[partnerId] : undefined) ?? (2 + OFF) * N + 5 + OFF;

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
  // Tek dokunuşla iş: rozete ya da tek işi belli olan kareye dokununca sormadan yapılır (her render'da yenilenir).
  const quickRef = useRef<(wx: number, wy: number) => boolean>(() => false);
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
            const z = Math.min(MAX_ZOOM, Math.max(1, (pinch.current.z0 * d) / pinch.current.d0));
            const s2 = c.fit * z;
            setZoom(z);
            if (z <= 1 && Math.abs(c.pan.x) + Math.abs(c.pan.y) < 1) setPan({ x: 0, y: 0 });
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
  const walkTo = (i: number) =>
    new Promise<void>((res) => {
      if (i === myTileRef.current) return res();
      arrived.current = res;
      myTileRef.current = i;
      setMyTile(i);
    });
  const queue = useRef<Action[]>([]);
  const busy = useRef(false);
  const flash = (text: string) => {
    setSay(text);
    setTimeout(() => setSay(''), 1800);
  };

  async function work(a: Action) {
    queue.current.push(a);
    if (busy.current || !couple || !partnerId) return;
    busy.current = true;
    // Kalp için: bu partide tek başına mı iş yapıldı, yoksa birlikte bir şey mi?
    let solo = false;
    let together = false;
    while (queue.current.length) {
      const job = queue.current.shift()!;
      await walkTo(job.i);
      const tl = job.a === 'water' ? 'can' : job.a === 'plant' || job.a === 'till' ? 'seed' : null;
      setTool(tl);
      await sleep(tl ? (queue.current.length ? 400 : 800) : 250);
      setTool(null);
      const before = farmOf(couple).tiles[job.i];
      try {
        const r = await farmAction(couple.id, uid, myName, partnerName, job);
        if (typeof r === 'string') flash(r);
        else {
          const helped = job.a === 'water' && before.k === 'crop' && before.by !== uid;
          if (helped || ('scene' in job && job.scene) || job.a === 'harvestDay' || (job.a === 'deliver' && r.gained) || job.a === 'note')
            together = true;
          else solo = true;
          if (r.gained) {
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
    if (rest !== myTileRef.current) void walkTo(rest);
    if (together) logActivityCapped(couple.id, uid, 'farmTogether');
    else if (solo) logActivityCapped(couple.id, uid, 'farm');
    // Çiftlik işleri için bildirim gitmez; partner çiftliği açınca "sen yokken" kartında görür.
    busy.current = false;
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
  // Kaldırılan eşya yerinde görünmez; parmağın altında yarı saydam kopyası gezer
  const farmView = lift ? { ...farm, tiles: farm.tiles.map((t, j) => (j === lift.from ? ({ k: 'grass' } as Tile) : t)) } : farm;
  const sprs = [...SCENERY, ...sprites(farmView, now)].sort((a, b) => a.z - b.z);
  objectAtRef.current = (wx, wy) => {
    let best = -1;
    let bz = -1;
    for (const sp of sprs) {
      const m = /^s(\d+)$/.exec(sp.key);
      if (!m) continue;
      const i = Number(m[1]);
      const k = farm.tiles[i]?.k;
      if (k !== 'tree' && k !== 'building' && k !== 'decor' && k !== 'animal') continue;
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
    ghost = sprites(one, now).map((sp) => ({ ...sp, x: sp.x + lift.wx - o.x, y: sp.y + lift.wy - o.y - TH * 0.6, z: 9000, o: 0.8 }));
    liftTarget = tileAt(lift.wx, lift.wy);
  }
  const badges: { key: string; i: number; x: number; y: number; art: string; z: number; n?: number; label?: string }[] = [];
  // Depo rozeti: ahırın üstünde en çok olan ürün ve toplam adet; dokununca depo açılır.
  {
    const n = stockCount(farm);
    const top = Object.entries(farm.stock).sort((a, b) => b[1] - a[1])[0];
    if (n > 0 && top) {
      const [ar, ac] = FIXED_ANCHOR.barn;
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
    const can = (Object.keys(RECIPES) as RecipeId[]).filter((id) => RECIPES[id].lvl <= lvNow && hasAll(farm, RECIPES[id].needs));
    const [hr, hc] = FIXED_ANCHOR.house;
    const h = center(hr, hc);
    const hb = center(hr - 1, hc - 1);
    if (can.length)
      badges.push({
        key: 'mutfak',
        i: hr * N + hc,
        x: (h.x + hb.x) / 2,
        y: h.y - TW * 1.45,
        art: ART[can[0]] ? can[0] : 'bugday',
        z: zOf(hr, hc) + 420,
        label: 'Mutfak',
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
    return !!tl && i !== NOTE_TREE && (tl.k === 'tree' || tl.k === 'building' || tl.k === 'decor' || tl.k === 'animal');
  };
  liftDropRef.current = (from, to) => {
    if (to < 0 || to === from) return;
    if (farm.tiles[to]?.k !== 'grass') {
      flash('Boş bir çimene bırak');
      return;
    }
    setSel(null);
    work({ a: 'move', i: to, from });
  };
  placeRef.current = (i: number) => {
    const pl = placingRef.current;
    if (!pl) return;
    if (pl.a === 'move' && farm.tiles[i]?.k !== 'grass' && i !== pl.from) {
      flash('Boş bir çimene dokun'); // taşıma sürsün, yanlış dokunuş iptal etmesin
      return;
    }
    work({ ...pl, i } as Action);
    setPlacing(null);
  };
  quickRef.current = (wx, wy) => {
    // Önce rozetler: rozet karenin üstünde durduğu için aksi hâlde arkadaki kare seçilirdi.
    const hit = badges.find((b) => Math.hypot(b.x - wx, b.y - wy) < TW * 0.45);
    if (hit?.key === 'depo' || hit?.key === 'mutfak' || hit?.key === 'sepetb') {
      setSel(hit.i);
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
  const meAt = stand(sceneTile ?? myTile, -1);
  const pAt = stand(sceneTile ?? partnerTile, 1);

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
      style={{ flex: 1, backgroundColor: SKY }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
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
          <Ground f={farmView} sel={lift ? liftTarget : sel} season={season} />
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
          <WorldChar profile={partnerProfile} name={partnerName} x={pAt.x} y={pAt.y} z={pAt.z} tag={partnerName} />
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
          {floats.map((f) => (
            <FloatText key={f.id} x={f.x} y={f.y} text={f.text} />
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
                : placing.a === 'move'
                  ? 'Taşı: boş bir çimene dokun'
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
      {zoom > 1 && (
        <Pressable
          accessibilityLabel="Bütün çiftliği göster"
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
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, paddingBottom: insets.bottom + 8 }}
      >
        <View
          pointerEvents="box-none"
          style={
            scene || sel !== null || showLog || showOrders || showShop
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
                      live.kind === 'harvest' ? `Birlikte topla (${bigIds.length})` : `Tezgâhı aç · ${stockValue(farm, MARKET_BONUS)} altın`
                    }
                    onPress={() => doScene(live)}
                  />
                ) : null
              }
            />
          ) : (
            <Sheet
              farm={farm}
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
  showOrders: boolean;
  showShop: boolean;
  onShop: () => void;
  onPlace: (pl: Placing) => void;
  onOrders: () => void;
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
  onAll: () => void;
  onWaterAll: () => void;
  onSell: () => void;
  onScene: (k: 'harvest' | 'market') => void;
  onAct: (a: Action, all?: boolean) => void;
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

function Round({
  icon,
  art,
  label,
  badge,
  accent,
  off,
  onPress,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  art?: string;
  label: string;
  badge?: number;
  accent?: boolean;
  off?: boolean;
  onPress: () => void;
}) {
  const tint = accent ? '#E8516A' : '#3E7F22';
  return (
    <View style={{ alignItems: 'center', width: 64 }}>
      <GlassCircle size={54} tint={tint} active={accent} onPress={onPress} disabled={off} accessibilityLabel={label}>
        {art && ART[art] ? (
          <Image source={ART[art].src} style={{ width: 32, height: 30 }} resizeMode="contain" />
        ) : (
          <Ionicons name={icon ?? 'ellipse'} size={26} color={accent ? '#fff' : '#1F4D0C'} />
        )}
        {!!badge && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              paddingHorizontal: 5,
              backgroundColor: '#FFD23F',
              borderWidth: 2,
              borderColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '900', fontSize: 12, color: '#5A3E00' }}>
              {badge}
            </Text>
          </View>
        )}
      </GlassCircle>
      <Text
        maxFontSizeMultiplier={1.0}
        numberOfLines={1}
        style={{
          marginTop: 3,
          fontWeight: '800',
          fontSize: 11,
          color: '#fff',
          textShadowColor: 'rgba(0,0,0,0.6)',
          textShadowRadius: 3,
          textShadowOffset: { width: 0, height: 1 },
        }}
      >
        {label}
      </Text>
    </View>
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

type Item = { id: string; art: string; name: string; cost: number; lvl: number; sub: string; a: Action };
function Items({ list, level, coins, onPick }: { list: Item[]; level: number; coins: number; onPick: (a: Action) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {list.map((it) => {
        const off = level < it.lvl || coins < it.cost;
        return (
          <Pressable
            key={it.id}
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
            <Image source={ART[it.art].src} style={{ width: 54, height: 44 }} resizeMode="contain" />
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
        );
      })}
    </ScrollView>
  );
}

function Tabs({ tabs, value, onChange, extra }: { tabs: [Shop, string][]; value: Shop; onChange: (s: Shop) => void; extra?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {tabs.map(([k, l]) => (
        <Pressable
          key={k}
          onPress={() => onChange(k)}
          style={{
            flex: 1,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: value === k ? GREEN : '#F0E2DC',
            backgroundColor: value === k ? GREEN : '#fff',
            alignItems: 'center',
          }}
        >
          <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 13, color: value === k ? '#fff' : INK }}>
            {l}
          </Text>
        </Pressable>
      ))}
      {extra}
    </View>
  );
}

function ago(ms: number) {
  const m = Math.floor(ms / MIN);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} sa` : `${Math.floor(h / 24)} gün`;
}

const BARN_TILE = FIXED_ANCHOR.barn[0] * N + FIXED_ANCHOR.barn[1];
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

  if (p.showShop)
    return (
      <ShopPanel
        farm={farm}
        now={now}
        level={level}
        shop={p.shop}
        setShop={p.setShop}
        onClose={p.onClose}
        onPlace={p.onPlace}
        onAct={p.onAct}
      />
    );
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
              : '';
    return (
      <>
        {!!hint && (
          <View pointerEvents="none" style={{ alignItems: 'center' }}>
            <Text
              maxFontSizeMultiplier={1.0}
              style={{
                backgroundColor: 'rgba(43,29,34,0.78)',
                color: '#fff',
                fontWeight: '700',
                fontSize: 12,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {hint}
            </Text>
          </View>
        )}
        {/* Sula ve Topla menünün üstünde sabit; iş yoksa pasif görünür. */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          <Quick icon="water" label="Hepsini sula" count={p.thirsty} onPress={p.onWaterAll} />
          <Quick icon="basket" label="Topla" count={small > 0 ? small : 0} onPress={p.onAll} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -10 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'flex-end', gap: 10, paddingHorizontal: 10 }}
        >
          {p.bank > 0 && <Round icon="gift" label={`${p.bank} al`} accent onPress={p.onBank} />}
          {big > 0 && <Round icon="people" label="Hasat günü" accent onPress={() => p.onScene('harvest')} />}
          <Round icon="receipt" label="Sipariş" badge={deliverable} onPress={p.onOrders} />
          {n > 0 &&
            (weekend ? (
              <Round icon="storefront" label={`Pazar ${stockValue(farm, MARKET_BONUS)}`} accent onPress={() => p.onScene('market')} />
            ) : (
              <Round art="coin" label={`Sat ${stockValue(farm)}`} onPress={p.onSell} />
            ))}
          <Round art="barn" label={n > 0 ? `Depo ${n}` : 'Depo'} onPress={p.onDepot} />
          <Round icon="book" label="Günlük" onPress={p.onLog} />
          <Round icon="storefront" label="Dükkân" onPress={p.onShop} />
        </ScrollView>
      </>
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
        <Note>Yollara bir şey konmaz.</Note>
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
            Depo boş. Topladığınız ürünler burada birikir: satınca altın olur, siparişlere verilir, evdeki mutfakta tarife, sepet tezgâhında
            partnerine armağana dönüşür.
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
      </>
    );
  }
  if (t.k === 'fixed')
    return (
      <>
        <Head art={t.item} title="Eviniz · Mutfak" onClose={p.onClose} />
        <Kitchen farm={farm} level={level} onCook={(recipe) => p.onAct({ a: 'cook', i, recipe })} />
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
        <Note>Tarlaya tohum ekilir. Hayvan, ağaç ve süs çayıra (çimene) konur.</Note>
        <Items list={list} level={level} coins={farm.coins} onPick={(a) => p.onAct(a, p.plantAll)} />
        <Btn kind="soft" label="Tarlayı taşı · sonra boş bir çimene dokun" onPress={() => p.onPlace({ a: 'move', from: i })} />
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
  if (t.k === 'decor') {
    const d = DECOR[t.item];
    return (
      <>
        <Head art={d.sp} title={d.name} onClose={p.onClose} />
        <Note>Bahçenizi güzelleştiriyor.</Note>
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
    </>
  );
}

// Dükkân: tohum, hayvan, bina, ağaç, süs. Yere konacaklar seçilince yerleştirme moduna geçilir.
function ShopPanel({
  farm,
  now,
  level,
  shop,
  setShop,
  onClose,
  onPlace,
  onAct,
}: {
  farm: Farm;
  now: number;
  level: number;
  shop: Shop;
  setShop: (s: Shop) => void;
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
            : (Object.keys(DECOR) as DecorId[]).map((id) => ({
                id,
                art: DECOR[id].sp,
                name: DECOR[id].name,
                cost: DECOR[id].cost,
                lvl: DECOR[id].lvl,
                sub: `+${DECOR[id].xp} tecrübe`,
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
  return (
    <>
      <Head title="Dükkân" onClose={onClose} />
      <Tabs
        tabs={[
          ['crop', 'Tohum'],
          ['animal', 'Hayvan'],
          ['building', 'Bina'],
          ['tree', 'Ağaç'],
          ['decor', 'Süs'],
        ]}
        value={shop}
        onChange={setShop}
      />
      <Items list={list} level={level} coins={farm.coins} onPick={pick} />
      <Note>
        {shop === 'crop'
          ? soil
            ? 'Tohumu seç, sonra boş tarlaya dokun.'
            : 'Boş tarla yok: çimene dokunup tarla sür.'
          : shop === 'animal'
            ? 'Hayvan binasında yaşar: kümes, ağıl ya da kovan. Önce binayı kur.'
            : 'Seç, sonra boş bir çimene dokun.'}
      </Note>
    </>
  );
}

// Kasaba siparişleri: 3 açık sipariş; depodan teslim edilir, ikisi de katkı verirse ortak hasat sayılır.
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
      <Head title="Kasaba siparişleri" onClose={onClose} />
      <Note>
        Sayılar teslim edilen/istenen; yanında depodaki miktar yazar. İkiniz de katkı verirseniz ortak hasat sayılır. Ödül ham satışın 1,4
        katı.
      </Note>
      <ScrollView style={{ maxHeight: 230 }} contentContainerStyle={{ gap: 8 }}>
        {farm.orders.length === 0 && <Note>Kasaba ilk işinizden sonra sipariş göndermeye başlar.</Note>}
        {farm.orders.map((o) => {
          const open = o.openAt <= now;
          const give = canGive(farm, o);
          const left = orderLeft(o);
          return (
            <View
              key={o.id}
              style={{ borderWidth: 1, borderColor: '#F0E2DC', borderRadius: 14, padding: 10, gap: 6, opacity: open ? 1 : 0.55 }}
            >
              {open ? (
                <>
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
                      +{o.coins} altın · +{o.xp} tecrübe{who(o) ? ` · ${who(o)}` : ''}
                    </Text>
                    <Btn
                      kind={give ? 'green' : 'soft'}
                      label={give ? `Teslim et (${give})` : 'Depoda yok'}
                      onPress={() => onDeliver(o.id)}
                      disabled={!give}
                    />
                  </View>
                </>
              ) : (
                <Text maxFontSizeMultiplier={1.0} style={{ color: MUTED, fontSize: 13 }}>
                  Yeni sipariş {timeLeft(o.openAt - now)} sonra
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
// Mutfak: depodaki ürünlerden tarif. Yapılan ürün depoya girer; ham hâlinden değerlidir, sepetlere ve siparişlere gider.
function Kitchen({ farm, level, onCook }: { farm: Farm; level: number; onCook: (r: RecipeId) => void }) {
  return (
    <>
      <Note>Depodaki ürünlerden yap: daha pahalıya satılır, siparişlerde istenir, hediye sepetine girer.</Note>
      <ScrollView style={{ maxHeight: 230 }} contentContainerStyle={{ gap: 8 }}>
        {(Object.keys(RECIPES) as RecipeId[]).map((id) => {
          const r = RECIPES[id];
          const locked = level < r.lvl;
          const ok = !locked && hasAll(farm, r.needs);
          return (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: locked ? 0.5 : 1 }}>
              <StockIcon k={id} w={34} h={34} />
              <View style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={1.0} style={{ fontWeight: '800', fontSize: 13, color: INK }}>
                  {r.name} · {r.sell} altın{(farm.stock[id] ?? 0) > 0 ? ` · depoda ${farm.stock[id]}` : ''}
                </Text>
                <Text maxFontSizeMultiplier={1.0} style={{ fontSize: 12, color: ok ? GREEN : MUTED }}>
                  {locked ? `${r.lvl}. seviyede açılır` : needsText(r.needs)}
                </Text>
              </View>
              <Btn kind={ok ? 'green' : 'soft'} label={ok ? 'Yap' : 'Eksik'} disabled={!ok} onPress={() => onCook(id)} />
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
