import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { Avatar } from '../Avatar';
import {
  anyFits,
  clearedCells,
  COLORS,
  EDGE,
  fits,
  fullLines,
  SHAPES,
  shapeSize,
  SIZE,
  type BlocksState,
  type Piece,
} from '../../lib/blocks';
import { partnerJoined, placeBlock, type GameProps } from '../../lib/games';
import { setGameOpen } from '../../lib/push';
import { CallButton } from '../CallButton';
import { useSession } from '../../lib/session';
import { useFinishOnce } from './shared';

// Birlikte Blok: Block Blast oynanışı. Parçayı alttan sürükleyip tahtaya bırakırsın; sürüklerken gölgesi ve
// dolacak satırlar görünür. Sen üç parçanı koyunca sıradaki set partnere geçer. Tahta ve puan ortak.

const BG = '#2B2560';
const CELL_BG = '#231E55';
const GOLD = '#FFD23F';
const PRAISE = ['', 'Güzel!', 'Harika!', 'Muhteşem!', 'İnanılmaz!'];

// Küp: koyu dolgu, parlak neon kenar, hafif iç ışık.
function Cube({ size, col, radius = 6 }: { size: number; col: number; radius?: number }) {
  const bw = Math.max(1.5, size * 0.07);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: COLORS[col],
        borderWidth: bw,
        borderColor: EDGE[col],
        shadowColor: EDGE[col],
        shadowOpacity: 0.55,
        shadowRadius: size * 0.18,
        shadowOffset: { width: 0, height: 0 },
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: bw,
          right: bw,
          top: bw,
          height: Math.max(2, size * 0.16),
          backgroundColor: 'rgba(255,255,255,0.14)',
          borderRadius: 2,
        }}
      />
    </View>
  );
}

function PieceView({ p, cell, gap = 2, ghost }: { p: NonNullable<Piece>; cell: number; gap?: number; ghost?: boolean }) {
  const { rows, cols } = shapeSize(p.s);
  const w = cols * cell + (cols - 1) * gap;
  const h = rows * cell + (rows - 1) * gap;
  return (
    <View style={{ width: w, height: h, opacity: ghost ? 0.45 : 1 }}>
      {SHAPES[p.s].cells.map(([r, c]) => (
        <View key={`${r}-${c}`} style={{ position: 'absolute', left: c * (cell + gap), top: r * (cell + gap) }}>
          <Cube size={cell} col={p.col} radius={Math.max(3, cell * 0.2)} />
        </View>
      ))}
    </View>
  );
}

export function Blocks({ game, coupleId, uid, partnerId, partnerName, myName, onExit }: GameProps) {
  const { couple, profile, partnerProfile } = useSession();
  const b = game.blocks!;
  const myTurn = b.turn === uid && !b.over;
  useFinishOnce(b.over, game, coupleId, uid);

  const [W, setW] = useState(0);
  const PAD = 6;
  const GAP = 2;
  const cell = W ? Math.floor((W - PAD * 2 - GAP * (SIZE - 1)) / SIZE) : 36;
  const boardPx = cell * SIZE + GAP * (SIZE - 1) + PAD * 2;

  // Hamle sırasında yerel görüntü: parça konur, satır parlar ve silinir, sonra sunucu durumu gelir.
  const [local, setLocal] = useState<BlocksState | null>(null);
  const [clearing, setClearing] = useState<number[]>([]);
  const [flash, setFlash] = useState('');
  const [hidden, setHidden] = useState<number | null>(null); // sürüklenen parçanın yuvası
  const [drag, setDrag] = useState<{ slot: number; p: NonNullable<Piece>; x: number; y: number } | null>(null);
  const [ghost, setGhost] = useState<{ cells: number[]; glow: number[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = local ?? b;

  useEffect(() => {
    setGameOpen(game.id);
    return () => setGameOpen(null);
  }, [game.id]);
  // Sunucudan yeni durum gelince yerel görüntüyü bırak.
  useEffect(() => {
    setLocal(null);
    setClearing([]);
  }, [b.score, b.sets, b.turn, b.board.join('')]);

  // Tahtanın ve kapsayıcının pencere konumu: sürüklenen parça parmağın pencere koordinatıyla konumlanır.
  const boardPos = useRef({ x: 0, y: 0 });
  const rootPos = useRef({ x: 0, y: 0 });
  const boardEl = useRef<{ measureInWindow: (cb: (x: number, y: number) => void) => void } | null>(null);
  const rootEl = useRef<{ measureInWindow: (cb: (x: number, y: number) => void) => void } | null>(null);
  const measureBoard = () => {
    boardEl.current?.measureInWindow((x, y) => (boardPos.current = { x, y }));
    rootEl.current?.measureInWindow((x, y) => (rootPos.current = { x, y }));
  };

  const stateRef = useRef({ b: shown, myTurn, busy, cell, boardPx });
  stateRef.current = { b: shown, myTurn, busy, cell, boardPx };

  // Parça parmağın biraz üstünde taşınır; bırakınca en yakın kareye oturur.
  const dragSlotRef = useRef<number | null>(null);
  const dropRef = useRef<{ r: number; c: number } | null>(null);
  const liftY = () => stateRef.current.cell * 1.4;

  const posFor = (pageX: number, pageY: number, p: NonNullable<Piece>) => {
    const { cell: cz } = stateRef.current;
    const { rows, cols } = shapeSize(p.s);
    const w = cols * (cz + GAP) - GAP;
    const h = rows * (cz + GAP) - GAP;
    const x = pageX - w / 2;
    const y = pageY - h - liftY();
    const c = Math.round((x - boardPos.current.x - PAD) / (cz + GAP));
    const r = Math.round((y - boardPos.current.y - PAD) / (cz + GAP));
    return { x, y, r, c };
  };

  function onMove(pageX: number, pageY: number) {
    const slot = dragSlotRef.current;
    if (slot === null) return;
    const p = stateRef.current.b.tray[slot];
    if (!p) return;
    const { x, y, r, c } = posFor(pageX, pageY, p);
    setDrag({ slot, p, x, y });
    const cells = SHAPES[p.s].cells;
    if (fits(stateRef.current.b.board, cells, r, c)) {
      dropRef.current = { r, c };
      const ids = cells.map(([dr, dc]) => (r + dr) * SIZE + c + dc);
      const nb = [...stateRef.current.b.board];
      ids.forEach((i) => (nb[i] = 1));
      setGhost({ cells: ids, glow: clearedCells(fullLines(nb)) });
    } else {
      dropRef.current = null;
      setGhost(null);
    }
  }

  async function onDrop() {
    const slot = dragSlotRef.current;
    dragSlotRef.current = null;
    const target = dropRef.current;
    dropRef.current = null;
    setDrag(null);
    setGhost(null);
    setHidden(null);
    if (slot === null || !target || stateRef.current.busy) return;
    const cur = stateRef.current.b;
    const p = cur.tray[slot];
    if (!p) return;
    setBusy(true);
    // Önce yerelde göster: parça konur, dolan satırlar beyaza döner.
    const cells = SHAPES[p.s].cells;
    const nb = [...cur.board];
    cells.forEach(([dr, dc]) => (nb[(target.r + dr) * SIZE + target.c + dc] = p.col + 1));
    const full = fullLines(nb);
    const cleared = clearedCells(full);
    setLocal({ ...cur, board: nb, tray: cur.tray.map((x, i) => (i === slot ? null : x)) });
    if (cleared.length) setClearing(cleared);
    try {
      const res = await placeBlock(coupleId, game.id, uid, slot, target.r, target.c);
      if (res) {
        if (res.lines) {
          const n = res.lines;
          setFlash(
            `${PRAISE[Math.min(4, n + (res.state.combo > 1 ? 1 : 0))]} +${res.gained}${res.state.combo > 1 ? ` · ${res.state.combo}x kombo` : ''}`,
          );
        } else setFlash(`+${res.gained}`);
        setTimeout(() => setFlash(''), 1500);
      } else setLocal(null);
    } catch {
      setLocal(null);
    }
    setBusy(false);
  }

  const makeResponder = (slot: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => stateRef.current.myTurn && !stateRef.current.busy && !!stateRef.current.b.tray[slot],
      onMoveShouldSetPanResponder: () => stateRef.current.myTurn && !stateRef.current.busy && !!stateRef.current.b.tray[slot],
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        measureBoard();
        dragSlotRef.current = slot;
        setHidden(slot);
        onMove(e.nativeEvent.pageX, e.nativeEvent.pageY);
      },
      onPanResponderMove: (e) => onMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: onDrop,
      onPanResponderTerminate: onDrop,
    });
  const responders = useMemo(() => [0, 1, 2].map(makeResponder), []); // eslint-disable-line react-hooks/exhaustive-deps

  const best = couple?.blocksBest ?? 0;
  const lastCells = new Set(b.last && b.last.by !== uid ? b.last.cells : []);
  const ghostSet = new Set(ghost?.cells ?? []);
  const glowSet = new Set(ghost?.glow ?? []);
  const clearSet = new Set(clearing);
  const trayCell = Math.max(14, Math.floor(cell * 0.5));

  return (
    <View
      style={{ flex: 1, margin: -20, marginTop: -8, backgroundColor: BG, padding: 16, paddingTop: 8, gap: 12 }}
      onLayout={(e) => setW(Math.min(e.nativeEvent.layout.width - 32, 420))}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => (onExit ? onExit() : router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={12}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
        <Text maxFontSizeMultiplier={1.1} style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
          Birlikte Blok
        </Text>
      </View>

      {/* üst: solda rekor (taç), sağda ikiniz; ortada büyük skor */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="trophy" size={22} color={GOLD} />
          <Text
            maxFontSizeMultiplier={1.1}
            style={{ color: GOLD, fontSize: 22, fontWeight: '900', textShadowColor: 'rgba(255,210,63,0.7)', textShadowRadius: 10 }}
          >
            {best}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        <CallButton where="blocks" color="#fff" />
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <View style={{ opacity: myTurn ? 1 : 0.4, borderWidth: 2, borderColor: myTurn ? GOLD : 'transparent', borderRadius: 18 }}>
              <Avatar p={profile} name={myName} size={30} showMood={false} />
            </View>
            <View
              style={{
                opacity: !myTurn && !b.over ? 1 : 0.4,
                borderWidth: 2,
                borderColor: !myTurn && !b.over ? GOLD : 'transparent',
                borderRadius: 18,
              }}
            >
              <Avatar p={partnerProfile} name={partnerName} size={30} showMood={false} />
            </View>
          </View>
          <Text maxFontSizeMultiplier={1.1} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' }}>
            {b.over ? 'Oyun bitti' : myTurn ? 'Senin setin' : `${partnerName} oynuyor…`}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'center', marginTop: -6 }}>
        <View
          style={{
            position: 'absolute',
            top: -2,
            width: 56,
            height: 56,
            borderRadius: 10,
            borderWidth: 3,
            borderColor: '#E24BFF',
            transform: [{ rotate: '45deg' }],
            shadowColor: '#E24BFF',
            shadowOpacity: 0.8,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
        <Text
          maxFontSizeMultiplier={1.1}
          style={{
            color: GOLD,
            fontSize: 48,
            fontWeight: '900',
            letterSpacing: 1,
            textShadowColor: 'rgba(255,170,0,0.8)',
            textShadowRadius: 14,
            textShadowOffset: { width: 0, height: 2 },
          }}
        >
          {shown.score}
        </Text>
      </View>

      {/* tahta */}
      <View
        ref={(v) => (boardEl.current = v as never)}
        onLayout={measureBoard}
        style={{
          alignSelf: 'center',
          width: boardPx,
          height: boardPx,
          padding: PAD,
          borderRadius: 14,
          backgroundColor: '#1B1748',
          borderWidth: 3,
          borderColor: '#3D8BFF',
          shadowColor: '#3D8BFF',
          shadowOpacity: 0.6,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        {shown.board.map((v, i) => {
          const r = Math.floor(i / SIZE);
          const c = i % SIZE;
          const g = ghostSet.has(i);
          const glow = glowSet.has(i);
          const clr = clearSet.has(i);
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: PAD + c * (cell + GAP),
                top: PAD + r * (cell + GAP),
                width: cell,
                height: cell,
                borderRadius: 6,
                backgroundColor: clr ? '#fff' : v ? 'transparent' : g && drag ? COLORS[drag.p.col] : CELL_BG,
                opacity: g && !v ? 0.55 : 1,
                borderWidth: glow ? 2 : g && !v && drag ? 1.5 : lastCells.has(i) ? 1.5 : 1,
                borderColor: glow
                  ? '#fff'
                  : g && !v && drag
                    ? EDGE[drag.p.col]
                    : lastCells.has(i)
                      ? 'rgba(255,255,255,0.6)'
                      : 'rgba(255,255,255,0.05)',
              }}
            >
              {v > 0 && !clr && <Cube size={cell} col={v - 1} />}
            </View>
          );
        })}
      </View>

      <Text
        maxFontSizeMultiplier={1.1}
        style={{
          textAlign: 'center',
          color: GOLD,
          fontSize: 20,
          fontWeight: '900',
          minHeight: 26,
          textShadowColor: 'rgba(255,170,0,0.7)',
          textShadowRadius: 10,
        }}
      >
        {flash}
      </Text>

      {/* el */}
      <View style={{ flexDirection: 'row', gap: 8, minHeight: 100, alignSelf: 'center', width: boardPx }}>
        {[0, 1, 2].map((k) => {
          const p = shown.tray[k];
          return (
            <View key={k} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} {...(p ? responders[k].panHandlers : {})}>
              {/* Sürüklenirken parça kaldırılmaz, saydam olur: dokunulan görünüm yok olursa iOS dokunuşu düşürüyor. */}
              {p && (
                <View style={{ opacity: hidden === k ? 0 : myTurn ? 1 : 0.35 }}>
                  <PieceView p={p} cell={trayCell} />
                </View>
              )}
            </View>
          );
        })}
      </View>

      <Text maxFontSizeMultiplier={1.1} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
        {myTurn ? `3 parçanı koyunca set ${partnerName}’a geçer` : ' '}
      </Text>

      {b.over && <GameOver score={b.score} best={best} />}

      {drag && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: drag.x - winOffset.current.x, top: drag.y - winOffset.current.y, zIndex: 50 }}
        >
          <PieceView p={drag.p} cell={cell} />
        </View>
      )}
      <View
        style={{ position: 'absolute', left: 0, top: 0 }}
        onLayout={() => {}}
        ref={(v) => v?.measureInWindow((x, y) => (winOffset.current = { x, y }))}
      />
    </View>
  );
}
// Sürüklenen parça ekran koordinatıyla konumlanır; kapsayıcının pencere ofseti düşülür.
const winOffset = { current: { x: 0, y: 0 } };

function GameOver({ score, best }: { score: number; best: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 14 }).start();
  }, [v]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: 24,
        right: 24,
        top: '38%',
        backgroundColor: '#1B1748',
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#E24BFF',
        padding: 18,
        alignItems: 'center',
        gap: 6,
        transform: [{ scale: v }],
        elevation: 10,
        shadowColor: '#E24BFF',
        shadowOpacity: 0.6,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <Text
        maxFontSizeMultiplier={1.1}
        style={{ fontSize: 48, fontWeight: '900', color: GOLD, textShadowColor: 'rgba(255,170,0,0.8)', textShadowRadius: 14 }}
      >
        {score}
      </Text>
      <Text maxFontSizeMultiplier={1.1} style={{ color: '#fff', fontWeight: '700' }}>
        {score >= best ? 'Yeni çift rekorunuz!' : `Rekorunuz ${best}`}
      </Text>
      <Text maxFontSizeMultiplier={1.1} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
        Günün ilk oyunuysa ikinize de +10 puan
      </Text>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={{ marginTop: 6, backgroundColor: '#3D8BFF', borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10 }}
      >
        <Text maxFontSizeMultiplier={1.1} style={{ color: '#fff', fontWeight: '800' }}>
          Bitir
        </Text>
      </Pressable>
    </Animated.View>
  );
}
