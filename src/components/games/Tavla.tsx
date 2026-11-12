import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import { botTavla, commitTavla, partnerJoined, rollTavla, sideOf, type GameProps } from '../../lib/games';
import { notifyPartner, setGameOpen } from '../../lib/push';
import { useSession } from '../../lib/session';
import { BAR, diceOf, flipMove, legalMoves, OFF, pipCount, play, toView, type Move, type View as TView } from '../../lib/tavla';
import { useTheme } from '../../lib/useTheme';
import { Button, Muted } from '../ui';
import { Done, ResultHeader, useFinishOnce } from './shared';

// Tavla: deri kutulu, keçe zeminli tahta. Gidilecek yer gösterilmez; oyuncu pulu sürükler ya da pula sonra haneye dokunur.
// Tur telefonda oynanır; oynanacak hamle kalmayınca 1,5 sn sonra kendiliğinden kaydedilir (geri al iptal eder). Partnerin hamleleri pul pul kayarak görünür.

const CREAM = ['#FFF9EA', '#EFE3C6', '#D6C39C'];
const BROWN = ['#8E4A33', '#6A3022', '#4A1D14'];
const FELT = '#8A5A3B';
const LEATHER = '#5A2332';
const POINT_DARK = '#5A2332';
const POINT_LIGHT = '#EEE4CC';

type Geo = {
  W: number;
  H: number;
  f: number;
  tray: number;
  bar: number;
  L0: number;
  R0: number;
  pw: number;
  ptLen: number;
  d: number;
  barX: number;
  trayX: number;
};
function geo(W: number): Geo {
  const H = Math.round(W * 0.8);
  const f = 9;
  const tray = 22;
  const bar = 16;
  const x0 = f + 2;
  const x1 = W - f - tray - 4;
  const half = (x1 - x0 - bar) / 2;
  const pw = half / 6;
  const ptLen = H * 0.42;
  return {
    W,
    H,
    f,
    tray,
    bar,
    L0: x0,
    R0: x0 + half + bar,
    pw,
    ptLen,
    d: Math.min(pw * 0.92, ptLen / 5),
    barX: x0 + half,
    trayX: W - f - tray,
  };
}
const ptX = (g: Geo, i: number) =>
  i <= 5
    ? g.R0 + (5 - i + 0.5) * g.pw
    : i <= 11
      ? g.L0 + (11 - i + 0.5) * g.pw
      : i <= 17
        ? g.L0 + (i - 12 + 0.5) * g.pw
        : g.R0 + (i - 18 + 0.5) * g.pw;

// k'ıncı pulun (alttan/üstten) merkezi
function slot(g: Geo, mine: boolean, loc: number, k: number, count: number) {
  if (loc === BAR) return { x: g.barX + g.bar / 2, y: mine ? g.H / 2 + g.d * 0.9 + k * g.d * 0.7 : g.H / 2 - g.d * 0.9 - k * g.d * 0.7 };
  if (loc === OFF) return { x: g.trayX + g.tray / 2, y: mine ? g.H - g.f - 8 - k * 6 : g.f + 8 + k * 6 };
  const sp = count <= 5 ? g.d : (g.ptLen - g.d) / (count - 1);
  const top = loc >= 12;
  return { x: ptX(g, loc), y: top ? g.f + g.d / 2 + k * sp : g.H - g.f - g.d / 2 - k * sp };
}

function dropTarget(g: Geo, x: number, y: number): number | null {
  if (x >= g.trayX - 4 && y > g.H / 2) return OFF;
  if (x >= g.barX && x <= g.barX + g.bar) return BAR;
  let k: number;
  if (x >= g.R0 && x < g.R0 + 6 * g.pw) k = Math.floor((x - g.R0) / g.pw) + 6;
  else if (x >= g.L0 && x < g.L0 + 6 * g.pw) k = Math.floor((x - g.L0) / g.pw);
  else return null;
  return y < g.H / 2 ? 12 + k : 11 - k;
}

// Partnerin hamlesini benim açımdan uygular.
function applyOpp(v: TView, m: { from: number; to: number }): TView {
  const n = { ...v, pts: [...v.pts] };
  if (m.from === BAR) n.barOpp--;
  else n.pts[m.from]++;
  if (m.to === OFF) n.offOpp++;
  else {
    if (n.pts[m.to] === 1) {
      n.pts[m.to] = 0;
      n.barMe++;
    }
    n.pts[m.to]--;
  }
  return n;
}

function Checker({ x, y, d, mine, lift, dim }: { x: number; y: number; d: number; mine: boolean; lift?: boolean; dim?: boolean }) {
  const c = mine ? CREAM : BROWN;
  const s = lift ? d * 1.16 : d;
  return (
    <View
      style={{
        position: 'absolute',
        left: x - s / 2,
        top: y - s / 2,
        width: s,
        height: s,
        borderRadius: s / 2,
        backgroundColor: c[1],
        borderWidth: 1,
        borderColor: c[2],
        alignItems: 'center',
        justifyContent: 'center',
        opacity: dim ? 0 : 1,
        shadowColor: '#000',
        shadowOpacity: lift ? 0.45 : 0.35,
        shadowRadius: lift ? 6 : 2,
        shadowOffset: { width: 0, height: lift ? 6 : 2 },
        elevation: lift ? 8 : 3,
        zIndex: lift ? 30 : 2,
      }}
    >
      <View
        style={{
          width: s * 0.66,
          height: s * 0.66,
          borderRadius: s,
          borderWidth: 1.5,
          borderColor: mine ? 'rgba(185,160,115,0.55)' : 'rgba(0,0,0,0.25)',
          backgroundColor: c[0],
          opacity: 0.55,
        }}
      />
    </View>
  );
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function Die({ n, mine, used }: { n: number; mine: boolean; used?: boolean }) {
  return (
    <View
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        padding: 3,
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: mine ? '#FBF6E9' : '#62291D',
        opacity: used ? 0.35 : 1,
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      {Array.from({ length: 9 }, (_, k) => (
        <View key={k} style={{ width: '33.3%', height: '33.3%', alignItems: 'center', justifyContent: 'center' }}>
          {PIPS[n].includes(k) && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: mine ? '#3A1D14' : '#F3E6C9' }} />}
        </View>
      ))}
    </View>
  );
}

function BoardArt({ g }: { g: Geo }) {
  const { W, H, f, pw, ptLen, L0, R0, barX, bar, trayX, tray } = g;
  const half = pw * 6;
  const pts: React.ReactNode[] = [];
  for (let k = 0; k < 12; k++) {
    const hx = k < 6 ? L0 + k * pw : R0 + (k - 6) * pw;
    const dark = k % 2 === 0;
    pts.push(
      <Polygon
        key={`t${k}`}
        points={`${hx + 1.5},${f} ${hx + pw - 1.5},${f} ${hx + pw / 2},${f + ptLen}`}
        fill={dark ? POINT_DARK : POINT_LIGHT}
      />,
      <Polygon
        key={`ts${k}`}
        points={`${hx + 3.5},${f + 1} ${hx + pw - 3.5},${f + 1} ${hx + pw / 2},${f + ptLen - 6}`}
        fill="none"
        stroke={dark ? '#C9A97A' : '#8E6A55'}
        strokeWidth={0.8}
        strokeDasharray="2 1.6"
      />,
      <Polygon
        key={`b${k}`}
        points={`${hx + 1.5},${H - f} ${hx + pw - 1.5},${H - f} ${hx + pw / 2},${H - f - ptLen}`}
        fill={dark ? POINT_LIGHT : POINT_DARK}
      />,
      <Polygon
        key={`bs${k}`}
        points={`${hx + 3.5},${H - f - 1} ${hx + pw - 3.5},${H - f - 1} ${hx + pw / 2},${H - f - ptLen + 6}`}
        fill="none"
        stroke={dark ? '#8E6A55' : '#C9A97A'}
        strokeWidth={0.8}
        strokeDasharray="2 1.6"
      />,
    );
  }
  return (
    <Svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0 }}>
      <Defs>
        <LinearGradient id="felt" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#93623F" />
          <Stop offset="1" stopColor="#7E5135" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} rx={10} fill={LEATHER} />
      <Rect x={L0} y={f} width={half} height={H - 2 * f} rx={3} fill="url(#felt)" />
      <Rect x={R0} y={f} width={half} height={H - 2 * f} rx={3} fill="url(#felt)" />
      {pts}
      <Rect x={barX} y={0} width={bar} height={H} fill="#4A1B28" />
      <Rect x={barX + 3} y={H * 0.3} width={bar - 6} height={H * 0.4} rx={3} fill="#B07A52" />
      <Rect
        x={barX + 5}
        y={H * 0.3 + 2}
        width={bar - 10}
        height={H * 0.4 - 4}
        rx={2}
        fill="none"
        stroke="#E9D3AF"
        strokeWidth={0.8}
        strokeDasharray="2 1.6"
      />
      <Rect x={trayX} y={f} width={tray} height={H / 2 - f - 3} rx={3} fill="#7A4A31" />
      <Rect x={trayX} y={H / 2 + 3} width={tray} height={H / 2 - f - 3} rx={3} fill="#7A4A31" />
      <Rect
        x={3.5}
        y={3.5}
        width={W - 7}
        height={H - 7}
        rx={7}
        fill="none"
        stroke="#E9D3AF"
        strokeWidth={0.9}
        strokeDasharray="3 2"
        opacity={0.7}
      />
    </Svg>
  );
}

export function Tavla({ game, coupleId, uid, partnerId, partnerName, myName }: GameProps) {
  const t = useTheme();
  const { couple } = useSession();
  const tv = game.tavla!;
  const side = sideOf(game, uid);
  const server = useMemo(() => toView(tv, side), [tv, side]);
  const myTurn = tv.turn === uid && !tv.winner;
  const rolled = tv.rolled.length > 0;
  // Partner henüz katılmadıysa onun tarafını bilgisayar oynar (kuranın telefonundan, sırası gelince).
  const solo = !partnerJoined(game);
  const botTurn = solo && uid === game.from && tv.turn === partnerId && !tv.rolled.length && !tv.winner;
  const turnKey = `${tv.turn}|${tv.rolled.join(',')}|${tv.pts.join(',')}`;

  const [W, setW] = useState(0);
  const g = useMemo(() => geo(W || 300), [W]);
  const [view, setView] = useState<TView>(server);
  const [dice, setDice] = useState<number[]>(diceOf(tv.rolled));
  const [hist, setHist] = useState<{ view: TView; dice: number[] }[]>([]);
  const [path, setPath] = useState<Move[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ from: number; x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [fly, setFly] = useState<{ mine: boolean; x0: number; y0: number; x1: number; y1: number } | null>(null);
  const flyV = useRef(new Animated.Value(0)).current;
  const prevServer = useRef<TView>(server);
  const [animating, setAnimating] = useState(false);

  // Sunucudan yeni durum geldi: partner oynadıysa hamlelerini tek tek kaydır.
  useEffect(() => {
    const last = tv.last;
    const from = prevServer.current;
    prevServer.current = server;
    setDice(diceOf(tv.rolled));
    setHist([]);
    setPath([]);
    setSel(null);
    if (!last || last.by === uid || !last.path?.length || !W) {
      setView(server);
      return;
    }
    let cancelled = false;
    (async () => {
      setAnimating(true);
      let v = from;
      setView(v);
      for (const abs of last.path!) {
        if (cancelled) return;
        const m = flipMove(side, abs);
        const count = m.from === BAR ? v.barOpp : m.from === OFF ? 0 : -v.pts[m.from];
        const a = slot(g, false, m.from, Math.max(0, count - 1), count);
        const toCount = m.to === BAR || m.to === OFF ? 0 : Math.max(0, -v.pts[m.to]);
        const b = slot(g, false, m.to, toCount, toCount + 1);
        v = applyOpp(v, m);
        flyV.setValue(0);
        setFly({ mine: false, x0: a.x, y0: a.y, x1: b.x, y1: b.y });
        await new Promise<void>((res) =>
          Animated.timing(flyV, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => res()),
        );
        setView(v);
        setFly(null);
      }
      setView(server);
      setAnimating(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey, W]);

  useEffect(() => {
    if (!botTurn || animating) return;
    const tm = setTimeout(() => botTavla(coupleId, game.id).catch(() => {}), 1400);
    return () => clearTimeout(tm);
  }, [botTurn, animating, coupleId, game.id, turnKey]);

  useEffect(() => {
    setGameOpen(game.id);
    return () => setGameOpen(null);
  }, [game.id]);

  useFinishOnce(!!tv.winner, game, coupleId, uid);

  const legal = myTurn && rolled && !animating ? legalMoves(view, dice) : [];
  const turnDone = myTurn && rolled && !animating && legal.length === 0;

  // Tur bitince kısa bir bekleme: son pulu yanlış koyduysan "Geri al" bu süreyi iptal eder.
  const [countdown, setCountdown] = useState(false);
  const finishRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!turnDone || busy) {
      setCountdown(false);
      return;
    }
    setCountdown(true);
    const t = setTimeout(
      () => {
        setCountdown(false);
        finishRef.current();
      },
      hist.length ? 1500 : 400,
    );
    return () => clearTimeout(t);
  }, [turnDone, busy, hist.length]);

  // Bir puldan gidilebilecek haneler: tek zar ya da aynı pulla zarların toplamı (6-2 ile 8 hane gibi).
  function routesFrom(from: number) {
    const out = new Map<number, Move[]>();
    const walk = (v: TView, ds: number[], cur: number, pathSoFar: Move[]) => {
      for (const m of legalMoves(v, ds)) {
        if (m.from !== cur) continue;
        const next = [...pathSoFar, m];
        if (!out.has(m.to) || out.get(m.to)!.length > next.length) out.set(m.to, next);
        if (m.to === OFF) continue;
        const r = play(v, ds, m);
        walk(r.view, r.dice, m.to, next);
      }
    };
    if (myTurn && rolled && !animating) walk(view, dice, from, []);
    return out;
  }

  function tryMove(from: number, to: number) {
    const route = routesFrom(from).get(to);
    if (!route) {
      setMsg('Bu zarlarla oraya gidemezsin · parlayan hanelere bırak');
      setTimeout(() => setMsg(''), 2200);
      return false;
    }
    let v = view;
    let ds = dice;
    const steps: { view: TView; dice: number[] }[] = [];
    for (const m of route) {
      steps.push({ view: v, dice: ds });
      const r = play(v, ds, m);
      v = r.view;
      ds = r.dice;
    }
    setHist((h) => [...h, ...steps]);
    setPath((p) => [...p, ...route]);
    setView(v);
    setDice(ds);
    setMsg('');
    return true;
  }

  const ref = useRef({ legal, view, sel, g, myTurn, rolled, animating });
  ref.current = { legal, view, sel, g, myTurn, rolled, animating };
  const drag = useRef<{ from: number | null; x0: number; y0: number; moved: boolean }>({ from: null, x0: 0, y0: 0, moved: false });
  const act = useRef({ tryMove, setSel, setGhost });
  act.current = { tryMove, setSel, setGhost };

  const pr = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          const { g: gg, view: v, myTurn: mt, rolled: rl, animating: an } = ref.current;
          const x = e.nativeEvent.locationX;
          const y = e.nativeEvent.locationY;
          let from: number | null = null;
          if (mt && rl && !an) {
            const tgt = dropTarget(gg, x, y);
            if (tgt === BAR && v.barMe > 0) from = BAR;
            else if (tgt !== null && tgt >= 0 && tgt < 24 && v.pts[tgt] > 0) from = tgt;
          }
          drag.current = { from, x0: x, y0: y, moved: false };
        },
        onPanResponderMove: (e, gs) => {
          const d = drag.current;
          if (d.from === null) return;
          if (!d.moved && Math.hypot(gs.dx, gs.dy) > 6) d.moved = true;
          if (d.moved) act.current.setGhost({ from: d.from, x: d.x0 + gs.dx, y: d.y0 + gs.dy });
        },
        onPanResponderRelease: (e, gs) => {
          const d = drag.current;
          const { g: gg, sel: s, view: v, myTurn: mt, rolled: rl } = ref.current;
          const x = d.x0 + gs.dx;
          const y = d.y0 + gs.dy;
          act.current.setGhost(null);
          if (d.from !== null && d.moved) {
            const to = dropTarget(gg, x, y);
            if (to !== null && to !== d.from) act.current.tryMove(d.from, to);
            act.current.setSel(null);
            return;
          }
          if (!mt || !rl) return;
          // dokunma: önce pul, sonra hedef
          const tgt = dropTarget(gg, d.x0, d.y0);
          if (s === null) {
            if (d.from !== null) act.current.setSel(d.from);
          } else if (tgt === s) act.current.setSel(null);
          else if (tgt !== null) {
            if (!act.current.tryMove(s, tgt) && tgt >= 0 && tgt < 24 && v.pts[tgt] > 0) act.current.setSel(tgt);
            else act.current.setSel(null);
          }
        },
      }),
    [],
  );

  async function roll() {
    setBusy(true);
    setMsg('');
    try {
      const r = await rollTavla(coupleId, game.id, uid);
      if (r?.blocked) {
        setMsg(`${r.rolled.join('-')} attın, oynanacak hamle yok. Sıra ${partnerName}'de.`);
        if (!solo)
          notifyPartner(partnerId, 'Sıra sende 🎲', `${myName} ${r.rolled.join('-')} attı ama oynayamadı.`, {
            type: 'game',
            url: `/game/${game.id}`,
          });
      }
    } catch {
      setMsg('Zar atılamadı, tekrar dene.');
    }
    setBusy(false);
  }

  async function finishTurn() {
    if (busy) return;
    setBusy(true);
    try {
      const s = await commitTavla(coupleId, game.id, uid, view, path);
      if (s && !solo) {
        notifyPartner(
          partnerId,
          s.winner ? `${myName} tavlada kazandı${s.mars ? ', mars!' : ''} 🎲` : 'Sıra sende 🎲',
          s.winner ? 'Rövanş ister misin?' : `${myName} ${tv.rolled.join('-')} oynadı.`,
          { type: 'game', url: `/game/${game.id}` },
        );
      }
    } catch {
      setMsg('Kaydedilemedi, tekrar dene.');
    }
    setBusy(false);
  }

  finishRef.current = finishTurn;

  function undo() {
    const last = hist[hist.length - 1];
    if (!last) return;
    setView(last.view);
    setDice(last.dice);
    setHist((h) => h.slice(0, -1));
    setPath((p) => p.slice(0, -1));
    setSel(null);
  }

  // ---------- pullar ----------
  const pieces: React.ReactNode[] = [];
  const stack = (mine: boolean, loc: number, count: number) => {
    const shown = loc === OFF ? count : count;
    for (let k = 0; k < shown; k++) {
      const top = k === shown - 1;
      const p = slot(g, mine, loc, k, count);
      if (loc === OFF) {
        pieces.push(
          <View
            key={`${mine}-${loc}-${k}`}
            style={{
              position: 'absolute',
              left: g.trayX + 3,
              top: p.y - 2.5,
              width: g.tray - 6,
              height: 5,
              borderRadius: 2,
              backgroundColor: (mine ? CREAM : BROWN)[1],
              borderWidth: 0.5,
              borderColor: (mine ? CREAM : BROWN)[2],
            }}
          />,
        );
        continue;
      }
      const lifted = mine && top && sel === loc;
      const hidden = mine && top && ghost?.from === loc;
      pieces.push(<Checker key={`${mine}-${loc}-${k}`} x={p.x} y={p.y} d={g.d} mine={mine} lift={lifted} dim={hidden} />);
    }
  };
  // Seçili ya da sürüklenen pulun gidebileceği haneler parlar.
  const active = ghost?.from ?? sel;
  if (W && active !== null && active !== undefined) {
    for (const to of routesFrom(active).keys()) {
      const n = to === OFF ? view.offMe : Math.max(0, view.pts[to]);
      const p = slot(g, true, to, Math.min(n, 5), Math.max(n + 1, 1));
      const y = to === OFF ? g.H * 0.75 : p.y;
      pieces.push(
        <View
          key={`hint-${to}`}
          style={{
            position: 'absolute',
            left: p.x - g.d / 2,
            top: y - g.d / 2,
            width: g.d,
            height: g.d,
            borderRadius: g.d / 2,
            borderWidth: 2,
            borderColor: '#FFD27A',
            backgroundColor: 'rgba(255,210,122,0.28)',
          }}
        />,
      );
    }
  }
  if (W) {
    view.pts.forEach((n, i) => n !== 0 && stack(n > 0, i, Math.abs(n)));
    if (view.barMe) stack(true, BAR, view.barMe);
    if (view.barOpp) stack(false, BAR, view.barOpp);
    if (view.offMe) stack(true, OFF, view.offMe);
    if (view.offOpp) stack(false, OFF, view.offOpp);
  }

  const allDice = diceOf(tv.rolled);
  const usedN = allDice.length - dice.length;
  const diceOwnerMine = tv.turn === uid;
  const wins = couple?.tavlaWins ?? {};
  const oppPip = pipCount({
    pts: view.pts.map((_, i) => -view.pts[23 - i]),
    barMe: view.barOpp,
    barOpp: view.barMe,
    offMe: view.offOpp,
    offOpp: view.offMe,
  });

  const board = (
    <View
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      style={{
        width: '100%',
        height: W ? g.H : 260,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 10,
      }}
      {...pr.panHandlers}
    >
      {W > 0 && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: g.W, height: g.H }}>
          <BoardArt g={g} />
          {pieces}
          {rolled && (
            <View
              style={{
                position: 'absolute',
                flexDirection: 'row',
                gap: 7,
                top: g.H / 2 - 13,
                left: (diceOwnerMine ? g.R0 : g.L0) + (g.pw * 6 - (allDice.length * 33 - 7)) / 2,
              }}
            >
              {allDice.map((d, k) => (
                <Die key={k} n={d} mine={diceOwnerMine} used={diceOwnerMine && k < usedN} />
              ))}
            </View>
          )}
          {fly && (
            <Animated.View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                zIndex: 40,
                transform: [
                  { translateX: flyV.interpolate({ inputRange: [0, 1], outputRange: [fly.x0, fly.x1] }) },
                  { translateY: flyV.interpolate({ inputRange: [0, 1], outputRange: [fly.y0, fly.y1] }) },
                ],
              }}
            >
              <Checker x={0} y={0} d={g.d} mine={fly.mine} lift />
            </Animated.View>
          )}
          {ghost && <Checker x={ghost.x} y={ghost.y} d={g.d} mine lift />}
        </View>
      )}
    </View>
  );

  const table = (children: React.ReactNode) => (
    <View style={{ borderRadius: 18, padding: 8, gap: 10, backgroundColor: '#9A5B32', overflow: 'hidden', marginHorizontal: -14 }}>
      <Svg style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} width="100%" height="100%">
        {Array.from({ length: 30 }, (_, k) => (
          <Rect key={k} x={k * 16} y={0} width={k % 3 === 0 ? 9 : 5} height={2000} fill={k % 2 ? '#A4653A' : '#8F5330'} opacity={0.6} />
        ))}
      </Svg>
      {children}
    </View>
  );

  if (tv.winner) {
    const iWon = tv.winner === uid;
    return (
      <Done>
        <ResultHeader
          big={iWon ? 'Kazandın!' : `${partnerName} kazandı`}
          line={`${tv.mars ? 'Mars! 2 sayı. ' : ''}Genel skor: Sen ${wins[uid] ?? 0} - ${wins[partnerId] ?? 0} ${partnerName}`}
          game={game}
          uid={uid}
        />
        {table(board)}
      </Done>
    );
  }

  const status =
    msg ||
    (animating
      ? `${partnerName} oynuyor…`
      : !myTurn
        ? `${partnerName} oynuyor…`
        : !rolled
          ? 'Sıra sende, zarı at'
          : turnDone
            ? dice.length
              ? 'Kalan zar oynanamıyor, sıra geçiyor…'
              : 'Hamlen tamam, sıra geçiyor…'
            : `Kalan zar: ${dice.join(', ')}`);

  return (
    <>
      {table(
        <>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(43,20,14,0.45)',
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text maxFontSizeMultiplier={1.1} style={{ color: myTurn ? '#FFD27A' : '#FFF6E6', fontSize: 13 }}>
              <Text maxFontSizeMultiplier={1.1} style={{ fontWeight: '800' }}>
                ⚪ Sen
              </Text>{' '}
              · {wins[uid] ?? 0} · {pipCount(view)} pip
            </Text>
            <Text maxFontSizeMultiplier={1.1} style={{ color: !myTurn ? '#FFD27A' : '#FFF6E6', fontSize: 13 }}>
              <Text maxFontSizeMultiplier={1.1} style={{ fontWeight: '800' }}>
                🟤 {partnerName}
              </Text>{' '}
              · {wins[partnerId] ?? 0} · {oppPip}
            </Text>
          </View>
          {board}
          <Text
            maxFontSizeMultiplier={1.1}
            style={{ textAlign: 'center', color: '#FFF6E6', fontWeight: '800', minHeight: 20, fontFamily: t.fonts.body }}
          >
            {status}
          </Text>
        </>,
      )}
      {myTurn && !rolled && !animating && <Button label="Zar at" busy={busy} onPress={roll} />}
      {myTurn && rolled && !animating && hist.length > 0 && !busy && (
        <Button variant="secondary" label={countdown ? 'Geri al (1,5 sn)' : 'Geri al'} onPress={undo} />
      )}
      <Muted style={{ textAlign: 'center', fontSize: 12 }}>
        Pulu parmağınla sürükle ya da önce pula sonra gideceği haneye dokun. Toplarken sağdaki kutuya bırak. Mars 2 sayı.
      </Muted>
    </>
  );
}
