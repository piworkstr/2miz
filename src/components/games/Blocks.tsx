import { useEffect, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { fits, PIECES, SIZE } from '../../lib/blocks';
import { placeBlock, type GameProps } from '../../lib/games';
import { notifyPartner, setGameOpen } from '../../lib/push';
import { useSession } from '../../lib/session';
import { useTheme } from '../../lib/useTheme';
import { Button, Card, Muted } from '../ui';
import { Done, ResultHeader, useFinishOnce } from './shared';

// Birlikte Blok: ortak tahta, ortak puan. Sırası gelen eldeki parçalardan birini koyar,
// dolan satır/sütunlar silinir, sıra partnere geçer. Hiçbir parça sığmayınca oyun biter.
export function Blocks({ game, coupleId, uid, partnerId, partnerName, myName }: GameProps) {
  const t = useTheme();
  const { couple } = useSession();
  const { width } = useWindowDimensions();
  const b = game.blocks!;
  const [slot, setSlot] = useState<number | null>(null);
  const [cell, setCell] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState('');
  useFinishOnce(b.over, game, coupleId, uid);

  useEffect(() => {
    setGameOpen(game.id);
    return () => setGameOpen(null);
  }, [game.id]);

  const myTurn = b.turn === uid && !b.over;
  // Sıra değişince seçim sıfırlansın.
  useEffect(() => {
    setSlot(null);
    setCell(null);
  }, [b.moves]);

  const board = Math.min(width - 40, 380);
  const gap = 3;
  const cs = (board - gap * (SIZE - 1)) / SIZE;
  const mine = uid === game.from ? 1 : 2;
  const colorOf = (v: number) => (v === mine ? t.colors.primary : t.colors.text);

  const piece = slot !== null ? b.hand[slot] : -1;
  const r = cell !== null ? Math.floor(cell / SIZE) : -1;
  const c = cell !== null ? cell % SIZE : -1;
  const ghost = new Set<number>();
  let ghostOk = false;
  if (piece >= 0 && cell !== null) {
    ghostOk = fits(b.board, piece, r, c);
    for (const [dr, dc] of PIECES[piece]) if (r + dr < SIZE && c + dc < SIZE) ghost.add((r + dr) * SIZE + c + dc);
  }
  const lastCells = new Set(b.last && b.last.by !== uid ? b.last.cells : []);

  async function place() {
    if (!myTurn || busy || slot === null || cell === null || !ghostOk) return;
    setBusy(true);
    try {
      const res = await placeBlock(coupleId, game.id, uid, slot, r, c);
      if (res) {
        setFlash(res.lines > 0 ? `${res.lines} satır gitti! +${res.gained}` : `+${res.gained}`);
        setTimeout(() => setFlash(''), 1600);
        notifyPartner(
          partnerId,
          res.state.over ? 'Birlikte Blok bitti 🧩' : 'Sıra sende 🧩',
          res.state.over ? `Ortak skorunuz ${res.state.score}` : `${myName} hamlesini yaptı. Skorunuz ${res.state.score}`,
          { type: 'game', url: `/game/${game.id}` },
        );
      }
    } catch {
      // ağ hatası: seçim kalsın, tekrar denenebilir
    }
    setBusy(false);
  }

  const grid = (
    <View style={{ width: board, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {b.board.map((v, i) => {
        const g = ghost.has(i);
        const bg = g ? (ghostOk ? t.colors.primarySoft : t.colors.border) : v ? colorOf(v) : t.colors.card;
        return (
          <Pressable
            key={i}
            disabled={!myTurn || slot === null}
            onPress={() => (cell === i && ghostOk ? place() : setCell(i))}
            style={{
              width: cs,
              height: cs,
              borderRadius: 5,
              backgroundColor: bg,
              borderWidth: g || lastCells.has(i) ? 2 : 1,
              borderColor: g ? (ghostOk ? t.colors.primary : t.colors.muted) : lastCells.has(i) ? t.colors.primary : t.colors.border,
              opacity: v && !g ? (v === mine ? 1 : 0.8) : 1,
            }}
          />
        );
      })}
    </View>
  );

  if (b.over) {
    const best = couple?.blocksBest ?? 0;
    return (
      <Done>
        <ResultHeader
          big={String(b.score)}
          line={`${b.moves} hamle, ${b.lines} satır. ${b.score >= best ? 'Yeni çift rekorunuz!' : `Rekorunuz ${best}`}`}
          game={game}
          uid={uid}
        />
        {grid}
      </Done>
    );
  }

  return (
    <>
      <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
        <Stat label="Ortak skor" value={String(b.score)} />
        <Stat label="Silinen satır" value={String(b.lines)} />
        <Stat label="Rekorunuz" value={String(couple?.blocksBest ?? 0)} />
      </Card>
      <Text style={{ textAlign: 'center', color: myTurn ? t.colors.primary : t.colors.muted, fontWeight: '600', fontFamily: t.fonts.body }}>
        {flash || (myTurn ? (slot === null ? 'Senin sıran: bir parça seç' : 'Koymak istediğin yere dokun') : `${partnerName} düşünüyor…`)}
      </Text>
      {grid}

      <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
        {b.hand.map((p, i) => (
          <Pressable
            key={i}
            disabled={p < 0 || !myTurn}
            onPress={() => setSlot(slot === i ? null : i)}
            style={{
              flex: 1,
              height: 92,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: Math.min(t.radius.card, 14),
              borderWidth: slot === i ? 2 : 1,
              borderColor: slot === i ? t.colors.primary : t.colors.border,
              backgroundColor: slot === i ? t.colors.primarySoft : t.colors.card,
              opacity: p < 0 ? 0.25 : myTurn ? 1 : 0.6,
            }}
          >
            {p >= 0 && <Mini piece={p} color={t.colors.primary} />}
          </Pressable>
        ))}
      </View>

      {myTurn && slot !== null && cell !== null && (
        <Button
          label={ghostOk ? 'Buraya koy' : 'Buraya sığmıyor'}
          variant={ghostOk ? 'primary' : 'secondary'}
          busy={busy}
          onPress={place}
        />
      )}
      <Muted style={{ textAlign: 'center', fontSize: 12 }}>
        Aynı takımdasınız: parçalar ortak, puan ortak. Senin koyduğun kareler renkli, {partnerName}’inkiler koyu.
      </Muted>
    </>
  );
}

function Mini({ piece, color }: { piece: number; color: string }) {
  const cells = PIECES[piece];
  const rows = Math.max(...cells.map(([r]) => r)) + 1;
  const cols = Math.max(...cells.map(([, c]) => c)) + 1;
  const s = Math.min(16, 64 / Math.max(rows, cols));
  return (
    <View style={{ width: cols * s, height: rows * s }}>
      {cells.map(([r, c]) => (
        <View
          key={`${r}-${c}`}
          style={{ position: 'absolute', left: c * s, top: r * s, width: s - 2, height: s - 2, borderRadius: 3, backgroundColor: color }}
        />
      ))}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: t.colors.text }}>{value}</Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}
