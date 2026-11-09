import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, PanResponder, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, LinearGradient, Path, Pattern, Polygon, Rect, Stop } from 'react-native-svg';
import { Avatar } from '../components/Avatar';
import { ScenePanel, type SceneMeta } from '../components/world/ScenePanel';
import { WorldChar } from '../components/world/WorldChar';
import {
  ANIMALS,
  animalReady,
  bigReady,
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
  NOTE_MAX,
  NOTE_TREE,
  NOTES_PER_DAY,
  notesToday,
  orderLeft,
  parcelNeed,
  parcelOf,
  parcelTiles,
  PRODUCT_NAME,
  productNames,
  PRODUCTS,
  productValue,
  rc,
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
  type CropId,
  type DecorId,
  type Farm,
  type Order,
  type Season,
  type Tile,
  type TreeId,
} from '../lib/farm';
import { ART } from '../lib/farmArt';
import { notifyPartner } from '../lib/push';
import { startScene, useOpenScene, type Scene } from '../lib/scenes';
import { useSession } from '../lib/session';

// Bizim Çiftlik: 2.5D ortak çiftlik. Bütün arazi tek ekranda; avatarın dokunduğun kareye yürüyüp işi yapar.
// Partnerinin avatarı en son çalıştığı yerde durur, o bir şey yapınca oraya yürür.
// İki kişilik sahneler: Hasat günü (büyük ürünler) ve hafta sonu Pazar. Depo ahırın önünde yığın olarak görünür.

export const FARM_SCENES: Record<string, SceneMeta> = {
  harvest: { title: 'Hasat günü', verb: 'hasadı birlikte kaldırmak', reward: { coins: 15 } },
  market: { title: 'Pazar', verb: 'pazarda tezgâh kurmak', reward: { coins: 10 } },
};
// Depo yığını ahırın önünde durur.
const PILE_TILE = 24;

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

const BOUNDS = {
  x0: center(N - 1, 0).x - TW / 2 - 4,
  x1: center(0, N - 1).x + TW / 2 + 4,
  y0: OY - TH / 2 - TW * 1.7,
  y1: center(N - 1, N - 1).y + TH / 2 + TW * 0.4,
};

const GRASS = '#A9D46C';
const GREEN = '#5FA83A';
const INK = '#2B1D22';
const MUTED = '#8A7479';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Shop = 'crop' | 'animal' | 'tree' | 'decor';
type Spr = { key: string; art: string; x: number; y: number; w: number; z: number };

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
    if (t.k === 'decor') out.push({ key: `s${i}`, art: DECOR[t.item].sp, ...up, w: TW * DECOR[t.item].w });
    if (t.k === 'fixed') {
      const [ar, ac] = FIXED_ANCHOR[t.item];
      if (r === ar && c === ac) {
        const a = center(ar, ac);
        const back = center(ar - 1, ac - 1);
        out.push({ key: `s${i}`, art: t.item, x: (a.x + back.x) / 2, y: a.y + TH * 0.55, z: zOf(ar, ac) + 6, w: TW * 2.05 });
      }
    }
  });
  // Depo: ahırın önünde ürün yığını; en çok olan ürünün resmi, miktara göre büyür.
  const top = Object.entries(f.stock).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] > 0) {
    const [r, c] = rc(PILE_TILE);
    const { x, y } = center(r, c);
    const w = TW * Math.min(1.5, 0.7 + Math.sqrt(stockCount(f)) * 0.12);
    out.push({ key: 'pile', art: top[0], x, y: y + TH * 0.4, z: zOf(r, c) + 7, w });
  }
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
  return <Image source={a.src} style={{ position: 'absolute', left: s.x - s.w / 2, top: s.y - h, width: s.w, height: h, zIndex: s.z }} />;
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

function Badge({ x, y, art, z }: { x: number; y: number; art: string; z: number }) {
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
  const [myTile, setMyTile] = useState<number>(() => farm.pos[uid] ?? 22);
  const myTileRef = useRef(myTile);
  const partnerTile = (partnerId ? farm.pos[partnerId] : undefined) ?? 25;

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

  // Kamera: bütün araziyi ekrana sığdır; + ile yaklaşılır, sürükleyerek gezilir.
  const top = insets.top + 54;
  const bottom = 118 + insets.bottom;
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

  const pr = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          drag.current = { ...cam.current.pan, moved: false };
          pinch.current = null;
        },
        onPanResponderMove: (e, g) => {
          const t = e.nativeEvent.touches;
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
            if (z <= 1) setPan({ x: 0, y: 0 });
            else setPan({ x: mx - c.ox - (pinch.current.wx - c.cx) * s2, y: my - c.oy - (pinch.current.wy - c.cy) * s2 });
            return;
          }
          if (pinch.current) return; // iki parmaktan tek parmağa düşünce sürükleme başlamasın
          if (Math.hypot(g.dx, g.dy) > 6) drag.current.moved = true;
          if (drag.current.moved && cam.current.zoom > 1) setPan({ x: drag.current.x + g.dx, y: drag.current.y + g.dy });
        },
        onPanResponderRelease: (e) => {
          if (drag.current.moved || pinch.current) return;
          const c = cam.current;
          const wx = (e.nativeEvent.locationX - c.tx) / c.s;
          const wy = (e.nativeEvent.locationY - c.ty) / c.s;
          if (quickRef.current(wx, wy)) {
            setSel(null);
            setShowLog(false);
            setShowOrders(false);
            return;
          }
          const i = tileAt(wx, wy);
          setSel((old) => (i < 0 || old === i ? null : i));
          setShowLog(false);
          setShowOrders(false);
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
    let planted = 0;
    let plantedCrop: CropId | null = null;
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
            planted++;
            plantedCrop = job.crop;
          }
          if (job.a === 'note')
            notifyPartner(partnerId, `${myName} Not Ağacı’na bir not astı 🍃`, job.text.slice(0, 80), { type: 'mood', url: '/garden' });
          if (job.a === 'deliver' && r.gained) notifyPartner(partnerId, r.text, 'Bizim Çiftlik', { type: 'mood', url: '/garden' });
          if (job.a === 'water' && before.k === 'crop') {
            notifyPartner(
              before.by,
              `${myName} ektiğin ${CROPS[before.crop].name.toLowerCase()} ürününü suladı 💧`,
              'İki kat hızlı büyüyor.',
              {
                type: 'mood',
                url: '/garden',
              },
            );
            flash(`${partnerName}’e bildirim gitti`);
          }
        }
      } catch {
        flash('Olmadı, tekrar dene');
      }
    }
    if (planted && plantedCrop) {
      const c = CROPS[plantedCrop].name.toLowerCase();
      notifyPartner(
        partnerId,
        `${myName} bahçeye ${planted > 1 ? `${planted} tarla ` : ''}${c} ekti`,
        'Sen sularsan iki kat hızlı büyür 💧',
        {
          type: 'mood',
          url: '/garden',
        },
      );
    }
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
      await startScene(couple!.id, uid, { world: 'farm', kind, place: 'Bizim Çiftlik', windowMin: 120 });
      notifyPartner(partnerId!, `${myName} seni ${FARM_SCENES[kind].verb} için çağırıyor`, 'Bizim Çiftlik', {
        type: 'mood',
        url: '/garden',
      });
    } catch {
      flash('Sahne başlatılamadı');
    }
  }
  // Sahneye katılan kişi işi yapar: hasadı kaldırır ya da tezgâhı açıp satar.
  const doScene = (sc: Scene) =>
    sc.kind === 'harvest'
      ? work({ a: 'harvestDay', i: bigIds[0] ?? PILE_TILE, scene: sc.id })
      : work({ a: 'sell', i: PILE_TILE, scene: sc.id });
  const thirsty = farm.tiles.filter((x) => x.k === 'crop' && x.by === partnerId && !x.watered && !cropReady(x, now)).length;
  const fields = farm.tiles.filter((x) => x.k === 'soil' || x.k === 'crop').length;
  const sprs = [...SCENERY, ...sprites(farm, now)].sort((a, b) => a.z - b.z);
  const badges: { key: string; i: number; x: number; y: number; art: string; z: number }[] = [];
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
    return null;
  };
  quickRef.current = (wx, wy) => {
    // Önce rozetler: rozet karenin üstünde durduğu için aksi hâlde arkadaki kare seçilirdi.
    const hit = badges.find((b) => Math.hypot(b.x - wx, b.y - wy) < TW * 0.45);
    const i = hit ? hit.i : tileAt(wx, wy);
    if (i < 0) return false;
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
          <Ground f={farm} sel={sel} season={season} />
          {sprs.map((sp) => (
            <SpriteImg key={sp.key} s={sp} />
          ))}
          <Signs f={farm} />
          {badges.map((b) => (
            <Badge key={b.key} x={b.x} y={b.y} art={b.art} z={b.z} />
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
                  style={{ position: 'absolute', left: 30, top: 20, width: 26, height: 26, transform: [{ rotate: '-25deg' }] }}
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
            <Text style={{ fontWeight: '800', fontSize: 13, color: INK }}>Seviye {lv.level}</Text>
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
          <Text style={{ fontWeight: '900', color: '#7A5A00', fontSize: 15 }}>{farm.coins}</Text>
        </View>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: 10, top: insets.top + 52 }}>
        <Text
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
                notifyPartner(partnerId, `${myName} geldi 💛`, `${FARM_SCENES[scene.kind]?.title} başlıyor`, {
                  type: 'mood',
                  url: '/garden',
                });
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
              onOrders={() => setShowOrders(true)}
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
              }}
              onLog={() => setShowLog(true)}
              onAll={() =>
                ready.forEach((i) => {
                  const x = farm.tiles[i];
                  if (x.k === 'crop' && CROPS[x.crop].big) return; // büyük ürün hasat günüyle
                  work({ a: x.k === 'crop' ? 'harvest' : x.k === 'tree' ? 'pick' : 'collect', i });
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
  onOrders: () => void;
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
      <Text style={{ color: kind === 'soft' ? INK : '#fff', fontWeight: '800', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

// Yuvarlak oyun düğmesi: yeşil disk, koyu kenar, altında kısa etiket, köşede sayı rozeti.
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
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => ({ alignItems: 'center', width: 64, opacity: off ? 0.5 : pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 27,
          backgroundColor: accent ? '#E8516A' : '#6FBF3F',
          borderWidth: 3,
          borderColor: accent ? '#9E2740' : '#3E7F22',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#1E3A0A',
          shadowOpacity: 0.35,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 3 },
          elevation: 5,
        }}
      >
        {art && ART[art] ? (
          <Image source={ART[art].src} style={{ width: 32, height: 30 }} resizeMode="contain" />
        ) : (
          <Ionicons name={icon ?? 'ellipse'} size={26} color="#fff" />
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
              backgroundColor: '#FFD23F',
              borderWidth: 2,
              borderColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontWeight: '900', fontSize: 12, color: '#5A3E00' }}>{badge}</Text>
          </View>
        )}
      </View>
      <Text
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
    </Pressable>
  );
}

function Head({ art, title, onClose }: { art?: string; title: string; onClose: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {art && ART[art] && <Image source={ART[art].src} style={{ width: 34, height: 30 }} resizeMode="contain" />}
      <Text style={{ flex: 1, fontWeight: '900', fontSize: 17, color: INK }}>{title}</Text>
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
  return <Text style={{ color: MUTED, fontSize: 13, lineHeight: 18 }}>{children}</Text>;
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
            <Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 12, color: INK }}>
              {it.name}
            </Text>
            <Text style={{ fontWeight: '900', fontSize: 12, color: '#7A5A00' }}>
              {level < it.lvl ? `Seviye ${it.lvl}` : `${it.cost} altın`}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 10, color: MUTED }}>
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
          <Text style={{ fontWeight: '800', fontSize: 13, color: value === k ? '#fff' : INK }}>{l}</Text>
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

function Sheet(p: SheetProps) {
  const { farm, sel, now } = p;
  const level = levelOf(farm.xp).level;

  if (p.showOrders)
    return <Orders farm={farm} now={now} uid={p.uid} partnerName={p.partnerName} onClose={p.onClose} onDeliver={p.onDeliver} />;
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
              <Text style={{ width: 46, color: MUTED, fontSize: 12 }}>{ago(now - l.at)}</Text>
              <Text style={{ flex: 1, color: INK, fontSize: 13 }}>{l.text}</Text>
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
    const hint = big
      ? `${big} büyük ürün hazır · hasat günü ikinizle 🌾`
      : p.thirsty
        ? `${p.partnerName}’in ${p.thirsty} ürünü susuz 💧 ${p.thirsty > 3 ? 'Hepsini sula' : 'bidona dokun'}`
        : p.bank > 0
          ? `Günlük görevden ${p.bank} altın geldi`
          : '';
    return (
      <>
        {!!hint && (
          <View pointerEvents="none" style={{ alignItems: 'center' }}>
            <Text
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
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 10 }}>
          {p.bank > 0 && <Round icon="gift" label={`${p.bank} al`} accent onPress={p.onBank} />}
          {big > 0 && <Round icon="people" label="Hasat günü" accent onPress={() => p.onScene('harvest')} />}
          {p.thirsty > 0 && <Round icon="water" label="Hepsini sula" badge={p.thirsty} onPress={p.onWaterAll} />}
          <Round icon="basket" label="Topla" badge={small > 0 ? small : 0} off={small <= 0} onPress={p.onAll} />
          <Round icon="receipt" label="Sipariş" badge={deliverable} onPress={p.onOrders} />
          {n > 0 &&
            (weekend ? (
              <Round icon="storefront" label={`Pazar ${stockValue(farm, MARKET_BONUS)}`} accent onPress={() => p.onScene('market')} />
            ) : (
              <Round art="coin" label={`Sat ${stockValue(farm)}`} onPress={p.onSell} />
            ))}
          <Round icon="book" label="Günlük" onPress={p.onLog} />
        </View>
      </>
    );
  }

  const i = sel;
  const t: Tile = farm.tiles[i];
  const placeList = (): Item[] =>
    p.shop === 'decor'
      ? (Object.keys(DECOR) as DecorId[]).map((id) => ({
          id,
          art: DECOR[id].sp,
          name: DECOR[id].name,
          cost: DECOR[id].cost,
          lvl: DECOR[id].lvl,
          sub: `+${DECOR[id].xp} tecrübe`,
          a: { a: 'decor', i, item: id },
        }))
      : p.shop === 'tree'
        ? (Object.keys(TREES) as TreeId[]).map((id) => ({
            id,
            art: ART[id] ? id : 'tree',
            name: TREES[id].name,
            cost: TREES[id].cost,
            lvl: TREES[id].lvl,
            sub: `${TREES[id].yieldN} ${TREES[id].fruit.toLowerCase()} / ${timeLeft(TREES[id].mins * MIN)}`,
            a: { a: 'tree', i, item: id },
          }))
        : (Object.keys(ANIMALS) as AnimalId[]).map((id) => ({
            id,
            art: id,
            name: ANIMALS[id].name,
            cost: ANIMALS[id].cost,
            lvl: ANIMALS[id].lvl,
            sub: `${productNames(id)} · ${timeLeft(ANIMALS[id].mins * MIN)}`,
            a: { a: 'animal', i, item: id },
          }));

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
  if (t.k === 'fixed')
    return (
      <>
        <Head art={t.item} title={t.item === 'house' ? 'Eviniz' : 'Ahır'} onClose={p.onClose} />
        <Note>
          {t.item === 'house'
            ? 'Çiftlikteki eviniz.'
            : stockCount(farm)
              ? `Depoda ${stockCount(farm)} ürün var (${stockValue(farm)} altın). Hafta sonu pazarda bir buçuk kat.`
              : 'Depo boş. Toplanan ürünler burada birikir, satınca altın olur.'}
        </Note>
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
        {empties > 1 && (
          <Pressable onPress={() => p.setPlantAll(!p.plantAll)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={p.plantAll ? 'checkbox' : 'square-outline'} size={20} color={GREEN} />
            <Text style={{ color: INK, fontSize: 13 }}>Boş tarlaların hepsine ek ({empties})</Text>
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
      </>
    );
  }
  // çimen
  const shop = p.shop === 'crop' ? 'animal' : p.shop;
  return (
    <>
      <Head title="Boş çimen" onClose={p.onClose} />
      <Tabs
        tabs={[
          ['animal', 'Hayvan'],
          ['tree', 'Ağaç'],
          ['decor', 'Süs'],
        ]}
        value={shop}
        onChange={p.setShop}
        extra={
          <Pressable
            disabled={farm.coins < TILL}
            onPress={() => p.onAct({ a: 'till', i })}
            style={{
              flex: 1,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#F0E2DC',
              alignItems: 'center',
              opacity: farm.coins < TILL ? 0.45 : 1,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 13, color: INK }}>Tarla sür · {TILL}</Text>
          </Pressable>
        }
      />
      <Items list={placeList()} level={level} coins={farm.coins} onPick={(a) => p.onAct(a)} />
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
      <Note>Siparişi depodan teslim edin; ikiniz de katkı verirseniz ortak hasat sayılır. Ödül ham satışın 1,4 katı.</Note>
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
                        {ART[k] && <Image source={ART[k].src} style={{ width: 22, height: 22 }} resizeMode="contain" />}
                        <Text style={{ fontWeight: '800', fontSize: 13, color: left[k] ? INK : GREEN }}>
                          {o.given[k] ?? 0}/{q} {PRODUCT_NAME[k] ?? k}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ flex: 1, color: MUTED, fontSize: 12 }}>
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
                <Text style={{ color: MUTED, fontSize: 13 }}>Yeni sipariş {timeLeft(o.openAt - now)} sonra</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

// Not Ağacı: evin yanındaki ağaç. Kısa notlar; yalnız ikiniz görürsünüz.
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
              <Text style={{ color: INK, fontSize: 14 }}>{n.text}</Text>
              <Text style={{ color: MUTED, fontSize: 10, textAlign: mine ? 'right' : 'left' }}>
                {mine ? 'sen' : partnerName} · {ago(now - n.at)}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}
