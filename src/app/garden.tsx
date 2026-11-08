import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Image, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, Path, Pattern, Polygon, Rect } from 'react-native-svg';
import { Avatar } from '../components/Avatar';
import { WorldChar } from '../components/world/WorldChar';
import {
  ANIMALS,
  animalReady,
  CROPS,
  cropReady,
  DECOR,
  collectDreamBank,
  farmAction,
  farmOf,
  FIXED_ANCHOR,
  levelOf,
  MIN,
  N,
  parcelCost,
  parcelOf,
  parcelTiles,
  rc,
  readyTiles,
  TILL,
  timeLeft,
  type Action,
  type AnimalId,
  type CropId,
  type DecorId,
  type Farm,
  type Tile,
} from '../lib/farm';
import { ART } from '../lib/farmArt';
import { notifyPartner } from '../lib/push';
import { useSession } from '../lib/session';

// Bizim Bahçe: 2.5D ortak çiftlik. Bütün arazi tek ekranda; avatarın dokunduğun kareye yürüyüp işi yapar.
// Partnerinin avatarı en son çalıştığı yerde durur, o bir şey yapınca oraya yürür.

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
type Shop = 'crop' | 'animal' | 'decor';
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
    s('hay', B.x + TW * 1.6, btm + TW * 1.1, TW * 0.8, 2000, 9),
    s('planter', B.x + TW * 2.6, btm + TW * 0.6, TW * 0.75, 2000, 10),
  ];
})();

function SpriteImg({ s }: { s: Spr }) {
  const a = ART[s.art];
  if (!a) return null;
  const h = s.w * a.h;
  return <Image source={a.src} style={{ position: 'absolute', left: s.x - s.w / 2, top: s.y - h, width: s.w, height: h, zIndex: s.z }} />;
}

function Ground({ f, sel }: { f: Farm; sel: number | null }) {
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
  const px = L.x + TW * 0.6;
  const py = btm + TW * 0.9;
  const hiTiles = sel === null ? [] : f.tiles[sel].k === 'locked' ? parcelTiles(f, sel) : [sel];
  return (
    <Svg width={WW} height={WH} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <Pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <Rect width="3" height="7" fill="#5D8A36" />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={WW} height={WH} fill={GRASS} />
      <Path
        d={`M${B.x - TW * 0.35},${btm} C${B.x - TW * 0.5},${btm + 70} ${B.x + TW * 0.6},${btm + 140} ${B.x + TW * 0.2},${WH} L${B.x + TW},${WH} C${B.x + TW * 1.3},${btm + 140} ${B.x + TW * 0.3},${btm + 70} ${B.x + TW * 0.35},${btm} Z`}
        fill="#D9C9A6"
        stroke="#C7B48C"
        strokeWidth={2}
      />
      <Ellipse cx={px} cy={py + 6} rx={TW * 2.2} ry={TW * 0.75} fill="#7C9C4B" />
      <Ellipse cx={px} cy={py} rx={TW * 2.1} ry={TW * 0.68} fill="#4FA8D8" />
      <Ellipse cx={px - 8} cy={py - 5} rx={TW * 1.5} ry={TW * 0.42} fill="#6CC0EA" />
      <Polygon points={`${lx},${L.y} ${B.x},${btm} ${B.x},${btm + D} ${lx},${L.y + D}`} fill="#8B5E34" />
      <Polygon points={`${B.x},${btm} ${rx},${R.y} ${rx},${R.y + D} ${B.x},${btm + D}`} fill="#6E4625" />
      {f.tiles.map((t, i) => {
        const [r, c] = rc(i);
        const fill =
          t.k === 'path' ? '#D9CDB4' : t.k === 'locked' ? ((r + c) % 2 ? '#74A146' : '#6E9A42') : (r + c) % 2 ? '#93CB57' : '#8BC34F';
        return (
          <Polygon key={i} points={pts(r, c)} fill={fill} stroke={t.k === 'path' ? '#C9BC9F' : 'rgba(255,255,255,0.08)'} strokeWidth={1} />
        );
      })}
      {f.tiles.map((t, i) => {
        const [r, c] = rc(i);
        if (t.k === 'locked') return <Polygon key={`h${i}`} points={pts(r, c)} fill="url(#hatch)" opacity={0.45} />;
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

// Satılık her parselin ortasında küçük tabela.
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
            <Ellipse cx={10} cy={10} rx={4.5} ry={4.5} fill="#F4C542" stroke="#B88A1A" />
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
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [toast, setToast] = useState('');
  const [say, setSay] = useState('');
  const [tool, setTool] = useState<string | null>(null);
  const [floats, setFloats] = useState<{ id: number; x: number; y: number; text: string }[]>([]);

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
  const bottom = 150 + insets.bottom;
  const fit = box.w ? Math.min(1.1, box.w / (BOUNDS.x1 - BOUNDS.x0), (box.h - top - bottom) / (BOUNDS.y1 - BOUNDS.y0)) : 0.5;
  const s = fit * zoom;
  const tx = box.w / 2 - ((BOUNDS.x0 + BOUNDS.x1) / 2) * s + pan.x;
  const ty = top + (box.h - top - bottom) / 2 - ((BOUNDS.y0 + BOUNDS.y1) / 2) * s + pan.y;
  const cam = useRef({ s, tx, ty, zoom, pan });
  cam.current = { s, tx, ty, zoom, pan };
  const drag = useRef({ x: 0, y: 0, moved: false });

  const pr = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          drag.current = { ...cam.current.pan, moved: false };
        },
        onPanResponderMove: (_, g) => {
          if (Math.hypot(g.dx, g.dy) > 6) drag.current.moved = true;
          if (drag.current.moved && cam.current.zoom > 1) setPan({ x: drag.current.x + g.dx, y: drag.current.y + g.dy });
        },
        onPanResponderRelease: (e) => {
          if (drag.current.moved) return;
          const c = cam.current;
          const i = tileAt((e.nativeEvent.locationX - c.tx) / c.s, (e.nativeEvent.locationY - c.ty) / c.s);
          setSel((old) => (i < 0 || old === i ? null : i));
          setShowLog(false);
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
            const { x, y } = center(...rc(job.i));
            const id = Date.now() + Math.random();
            setFloats((f) => [...f, { id, x, y: y - TW * 0.6, text: `+${r.gained}` }]);
            setTimeout(() => setFloats((f) => f.filter((q) => q.id !== id)), 1300);
          }
          if (job.a === 'plant') {
            planted++;
            plantedCrop = job.crop;
          }
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
  const ready = readyTiles(farm, now);
  const thirsty = farm.tiles.filter((x) => x.k === 'crop' && x.by === partnerId && !x.watered && !cropReady(x, now)).length;
  const fields = farm.tiles.filter((x) => x.k === 'soil' || x.k === 'crop').length;
  const sprs = [...SCENERY, ...sprites(farm, now)].sort((a, b) => a.z - b.z);
  const badges: { key: string; x: number; y: number; art: string; z: number }[] = [];
  farm.tiles.forEach((tl, i) => {
    const [r, c] = rc(i);
    const { x, y } = center(r, c);
    const z = zOf(r, c) + 409;
    if (tl.k === 'crop' && !cropReady(tl, now) && tl.by !== uid && !tl.watered)
      badges.push({ key: `b${i}`, x, y: y - TW * 0.75, art: 'can', z });
    if (tl.k === 'crop' && cropReady(tl, now)) badges.push({ key: `b${i}`, x, y: y - TW * 0.95, art: 'coin', z });
    if (tl.k === 'animal' && animalReady(tl, now)) badges.push({ key: `b${i}`, x, y: y - TW * 0.85, art: ANIMALS[tl.item].product, z });
  });
  const meAt = stand(myTile, -1);
  const pAt = stand(partnerTile, 1);

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
      style={{ flex: 1, backgroundColor: GRASS }}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
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
          <Ground f={farm} sel={sel} />
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
      <View style={{ position: 'absolute', right: 10, top: insets.top + 52, gap: 6 }}>
        {(['in', 'out'] as const).map((k) => (
          <Pressable
            key={k}
            accessibilityLabel={k === 'in' ? 'Yakınlaş' : 'Uzaklaş'}
            onPress={() => {
              const z = k === 'in' ? Math.min(2.2, zoom * 1.4) : Math.max(1, zoom / 1.4);
              setZoom(z);
              if (z === 1) setPan({ x: 0, y: 0 });
            }}
            style={[pill, { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }]}
          >
            <Ionicons name={k === 'in' ? 'add' : 'remove'} size={20} color={INK} />
          </Pressable>
        ))}
      </View>
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

      {/* alt panel */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#fff',
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          padding: 14,
          paddingBottom: insets.bottom + 14,
          gap: 10,
          shadowColor: '#283C0A',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
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
          }}
          onLog={() => setShowLog(true)}
          onAll={() => ready.forEach((i) => work({ a: farm.tiles[i].k === 'crop' ? 'harvest' : 'collect', i }))}
          onAct={(a, all) => {
            if (all && a.a === 'plant') farm.tiles.forEach((x, i) => x.k === 'soil' && work({ ...a, i }));
            else work(a);
            setSel(null);
            setPlantAll(false);
          }}
        />
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
  ready: number;
  thirsty: number;
  fields: number;
  bank: number;
  onBank: () => void;
  onClose: () => void;
  onLog: () => void;
  onAll: () => void;
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

  if (sel === null)
    return (
      <>
        <Text style={{ color: MUTED, fontSize: 13, textAlign: 'center' }}>
          {p.thirsty
            ? `${p.partnerName}’in ${p.thirsty} ürünü sulanmayı bekliyor 💧 Sularsan iki kat hızlı büyür.`
            : `${p.fields} tarlanız var. Bir kareye dokun: ek, sula, topla. Tabelalı her yer satılık.`}
        </Text>
        {p.bank > 0 && <Btn kind="accent" label={`Günlük görevden ${p.bank} altın geldi · Al`} onPress={p.onBank} />}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Btn flex label={`Hepsini topla${p.ready ? ` (${p.ready})` : ''}`} onPress={p.onAll} disabled={!p.ready} />
          <Btn kind="soft" label="Günlük" onPress={p.onLog} />
        </View>
      </>
    );

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
      : (Object.keys(ANIMALS) as AnimalId[]).map((id) => ({
          id,
          art: id,
          name: ANIMALS[id].name,
          cost: ANIMALS[id].cost,
          lvl: ANIMALS[id].lvl,
          sub: `${ANIMALS[id].pname} · ${timeLeft(ANIMALS[id].mins * MIN)}`,
          a: { a: 'animal', i, item: id },
        }));

  if (t.k === 'locked') {
    const cost = parcelCost(farm);
    return (
      <>
        <Head title="Satılık arazi" onClose={p.onClose} />
        <Note>
          Bu parselde {parcelTiles(farm, i).length} kare var. Alınca hepsi sürülmüş tarla olur; istersen üstüne hayvan ya da süs de
          koyarsın.
        </Note>
        <Btn label={`Araziyi al · ${cost} altın`} onPress={() => p.onAct({ a: 'unlock', i })} disabled={farm.coins < cost} />
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
        <Note>{t.item === 'house' ? 'Çiftlikteki eviniz.' : 'Ürünleriniz burada saklanıyor.'}</Note>
      </>
    );
  if (t.k === 'soil') {
    const empties = farm.tiles.filter((x) => x.k === 'soil').length;
    const list: Item[] =
      p.shop === 'crop'
        ? (Object.keys(CROPS) as CropId[]).map((id) => ({
            id,
            art: id,
            name: CROPS[id].name,
            cost: CROPS[id].cost,
            lvl: CROPS[id].lvl,
            sub: `${timeLeft(CROPS[id].mins * MIN)} · ${CROPS[id].sell} altın`,
            a: { a: 'plant', i, crop: id },
          }))
        : placeList();
    return (
      <>
        <Head art="soil" title="Boş tarla" onClose={p.onClose} />
        <Tabs
          tabs={[
            ['crop', 'Tohum'],
            ['animal', 'Hayvan'],
            ['decor', 'Süs'],
          ]}
          value={p.shop}
          onChange={p.setShop}
        />
        <Items list={list} level={level} coins={farm.coins} onPick={(a) => p.onAct(a, p.shop === 'crop' && p.plantAll)} />
        {p.shop === 'crop' && empties > 1 && (
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
          <>
            <Note>
              Hasada hazır: +{c.sell} altın, +{c.xp} tecrübe
            </Note>
            <Btn label="Hasat et" onPress={() => p.onAct({ a: 'harvest', i })} />
          </>
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
            {mine && !t.watered && <Note>{p.partnerName} sularsa kalan süre yarıya iner.</Note>}
          </>
        )}
      </>
    );
  }
  if (t.k === 'animal') {
    const an = ANIMALS[t.item];
    const done = animalReady(t, now);
    const P1 = an.pname[0].toLocaleUpperCase('tr-TR') + an.pname.slice(1);
    return (
      <>
        <Head art={t.item} title={an.name} onClose={p.onClose} />
        <Note>{done ? `${P1} hazır: +${an.sell} altın` : `${an.pname} için ${timeLeft(t.last + an.mins * MIN - now)} kaldı`}</Note>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {done && <Btn flex label={`${P1} topla`} onPress={() => p.onAct({ a: 'collect', i })} />}
          <Btn kind="soft" label={`Sat (+${Math.floor(an.cost / 2)})`} onPress={() => p.onAct({ a: 'remove', i })} />
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
