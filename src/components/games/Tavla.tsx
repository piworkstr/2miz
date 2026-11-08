import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { commitTavla, rollTavla, sideOf, type GameProps } from '../../lib/games';
import { notifyPartner, setGameOpen } from '../../lib/push';
import { useSession } from '../../lib/session';
import { BAR, diceOf, legalMoves, OFF, pipCount, play, toView, type Move, type View as TView } from '../../lib/tavla';
import { useTheme } from '../../lib/useTheme';
import { Button, Card, Muted } from '../ui';
import { Done, ResultHeader, useFinishOnce } from './shared';

// Tavla: herkes tahtayı kendi açısından görür, kendi evi sağ altta. Tur telefonda oynanır, "Hamleyi bitir" ile kaydedilir.
export function Tavla({ game, coupleId, uid, partnerId, partnerName, myName }: GameProps) {
  const t = useTheme();
  const { couple } = useSession();
  const { width } = useWindowDimensions();
  const tv = game.tavla!;
  const side = sideOf(game, uid);
  const server = useMemo(() => toView(tv, side), [tv, side]);
  const myTurn = tv.turn === uid && !tv.winner;
  const turnKey = `${tv.turn}|${tv.rolled.join(',')}|${tv.pts.join(',')}`;

  const [view, setView] = useState<TView>(server);
  const [dice, setDice] = useState<number[]>(diceOf(tv.rolled));
  const [history, setHistory] = useState<{ view: TView; dice: number[] }[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setView(server);
    setDice(diceOf(tv.rolled));
    setHistory([]);
    setSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey]);

  useEffect(() => {
    setGameOpen(game.id);
    return () => setGameOpen(null);
  }, [game.id]);

  useFinishOnce(!!tv.winner, game, coupleId, uid);

  const rolled = tv.rolled.length > 0;
  const legal = myTurn && rolled ? legalMoves(view, dice) : [];
  const sources = new Set(legal.map((m) => m.from));
  const targets = sel === null ? [] : legal.filter((m) => m.from === sel);
  const targetSet = new Set(targets.map((m) => m.to));
  const turnDone = myTurn && rolled && legal.length === 0;

  function tapPoint(i: number) {
    if (!myTurn || !rolled || busy) return;
    if (sel !== null && targetSet.has(i)) return move(i);
    setSel(sources.has(i) && sel !== i ? i : null);
  }

  function move(to: number) {
    // Aynı yere iki zarla gidilebiliyorsa küçüğü kullanılır.
    const m = targets.filter((x) => x.to === to).sort((a, b) => a.die - b.die)[0] as Move | undefined;
    if (!m) return;
    setHistory((h) => [...h, { view, dice }]);
    const r = play(view, dice, m);
    setView(r.view);
    setDice(r.dice);
    // Aynı pulla devam edilebilsin.
    setSel(m.to !== OFF && legalMoves(r.view, r.dice).some((x) => x.from === m.to) ? m.to : null);
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setView(last.view);
    setDice(last.dice);
    setHistory((h) => h.slice(0, -1));
    setSel(null);
  }

  async function roll() {
    setBusy(true);
    setMsg('');
    try {
      const r = await rollTavla(coupleId, game.id, uid);
      if (r?.blocked) {
        setMsg(`Zarın ${r.rolled.join('-')}: oynanacak hamle yok, sıra ${partnerName}'e geçti.`);
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
    setBusy(true);
    try {
      const s = await commitTavla(coupleId, game.id, uid, view, history.length);
      if (s) {
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

  // ---------- Tahta ----------
  const W = Math.min(width - 40, 400);
  const col = (W - 4) / 14; // 12 hane + bar + toplama
  const ck = col - 3;
  const H = 5 * ck + 8;
  const mineColor = t.colors.primary;
  const oppColor = t.colors.text;

  function Stack({ n, top, highlight }: { n: number; top: boolean; highlight?: boolean }) {
    const count = Math.abs(n);
    const shown = Math.min(count, 5);
    const color = n > 0 ? mineColor : oppColor;
    return (
      <View style={{ position: 'absolute', left: 0, right: 0, [top ? 'top' : 'bottom']: 2, alignItems: 'center', gap: 0 }}>
        {Array.from({ length: shown }, (_, k) => (
          <View
            key={k}
            style={{
              width: ck,
              height: ck,
              borderRadius: ck / 2,
              backgroundColor: color,
              borderWidth: highlight && k === (top ? shown - 1 : 0) ? 2 : 1,
              borderColor: highlight && k === (top ? shown - 1 : 0) ? t.colors.success : t.colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {k === (top ? shown - 1 : 0) && count > 5 && (
              <Text style={{ color: t.colors.card, fontSize: ck * 0.45, fontWeight: '700' }}>{count}</Text>
            )}
          </View>
        ))}
      </View>
    );
  }

  function Point({ i, top }: { i: number; top: boolean }) {
    const n = view.pts[i];
    const isTarget = targetSet.has(i);
    const isSel = sel === i;
    const canPick = sources.has(i);
    return (
      <Pressable onPress={() => tapPoint(i)} style={{ width: col, height: H }}>
        <View
          style={{
            position: 'absolute',
            left: col * 0.12,
            width: 0,
            height: 0,
            borderLeftWidth: col * 0.38,
            borderRightWidth: col * 0.38,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            [top ? 'top' : 'bottom']: 0,
            [top ? 'borderTopWidth' : 'borderBottomWidth']: H * 0.85,
            [top ? 'borderTopColor' : 'borderBottomColor']: isTarget ? t.colors.success : i % 2 ? t.colors.primarySoft : t.colors.border,
          }}
        />
        {n !== 0 && <Stack n={n} top={top} highlight={isSel || (sel === null && canPick)} />}
      </Pressable>
    );
  }

  const half = (ids: number[], top: boolean) => ids.map((i) => <Point key={i} i={i} top={top} />);
  const barPick = sources.has(BAR);

  const board = (
    <View
      style={{
        width: W,
        alignSelf: 'center',
        borderRadius: 10,
        borderWidth: 2,
        borderColor: t.colors.border,
        backgroundColor: t.colors.card,
        paddingVertical: 4,
        gap: col * 0.6,
      }}
    >
      <View style={{ flexDirection: 'row' }}>
        {half([12, 13, 14, 15, 16, 17], true)}
        <View style={{ width: col, height: H, backgroundColor: t.colors.border, alignItems: 'center' }}>
          {view.barOpp > 0 && <Stack n={-view.barOpp} top />}
        </View>
        {half([18, 19, 20, 21, 22, 23], true)}
        <Tray count={view.offOpp} color={oppColor} col={col} H={H} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {half([11, 10, 9, 8, 7, 6], false)}
        <Pressable onPress={() => tapPoint(BAR)} style={{ width: col, height: H, backgroundColor: t.colors.border }}>
          {view.barMe > 0 && <Stack n={view.barMe} top={false} highlight={barPick} />}
        </Pressable>
        {half([5, 4, 3, 2, 1, 0], false)}
        <Pressable onPress={() => sel !== null && targetSet.has(OFF) && move(OFF)}>
          <Tray count={view.offMe} color={mineColor} col={col} H={H} glow={targetSet.has(OFF)} />
        </Pressable>
      </View>
    </View>
  );

  const wins = couple?.tavlaWins ?? {};

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
        {board}
      </Done>
    );
  }

  return (
    <>
      <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}>
        <Side label="Sen" wins={wins[uid] ?? 0} pip={pipCount(view)} color={mineColor} active={myTurn} />
        <Side
          label={partnerName}
          wins={wins[partnerId] ?? 0}
          pip={pipCount({ ...view, pts: view.pts.map((_, i) => -view.pts[23 - i]), barMe: view.barOpp })}
          color={oppColor}
          active={!myTurn}
        />
      </Card>

      {board}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, minHeight: 44, alignItems: 'center' }}>
        {rolled &&
          diceOf(tv.rolled).map((d, k) => {
            const usedCount = diceOf(tv.rolled).length - dice.length;
            return <Die key={k} n={d} used={myTurn && k < usedCount} />;
          })}
      </View>

      <Text style={{ textAlign: 'center', color: myTurn ? t.colors.primary : t.colors.muted, fontWeight: '600', fontFamily: t.fonts.body }}>
        {msg ||
          (!myTurn
            ? `${partnerName} oynuyor…`
            : !rolled
              ? 'Senin sıran, zar at'
              : turnDone
                ? 'Hamlen tamam, bitir'
                : sel === null
                  ? view.barMe > 0
                    ? 'Kırılan pulunu oyuna sok'
                    : 'Oynatacağın pulu seç'
                  : 'Yeşil haneye dokun')}
      </Text>

      {myTurn && !rolled && <Button label="Zar at 🎲" busy={busy} onPress={roll} />}
      {myTurn && rolled && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {history.length > 0 && <Button style={{ flex: 1 }} variant="secondary" label="Geri al" onPress={undo} />}
          {turnDone && <Button style={{ flex: 1 }} label="Hamleyi bitir" busy={busy} onPress={finishTurn} />}
        </View>
      )}
      {!myTurn && tv.last && tv.last.by !== uid && (
        <Muted style={{ textAlign: 'center', fontSize: 12 }}>Son zar: {tv.last.dice.join('-')}</Muted>
      )}
      <Muted style={{ textAlign: 'center', fontSize: 12 }}>
        Evin sağ altta, senin pulların renkli. Toplarken sağdaki kutuya dokun. Mars 2 sayı.
      </Muted>
    </>
  );
}

function Tray({ count, color, col, H, glow }: { count: number; color: string; col: number; H: number; glow?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: col,
        height: H,
        marginLeft: 0,
        borderRadius: 4,
        borderWidth: glow ? 2 : 0,
        borderColor: t.colors.success,
        backgroundColor: glow ? t.colors.successSoft : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
      }}
    >
      {count > 0 && (
        <>
          <View style={{ width: col * 0.7, height: Math.min(H * 0.7, count * 4), borderRadius: 2, backgroundColor: color }} />
          <Text style={{ color: t.colors.muted, fontSize: 10 }}>{count}</Text>
        </>
      )}
    </View>
  );
}

function Die({ n, used }: { n: number; used: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        backgroundColor: t.colors.card,
        borderWidth: 1.5,
        borderColor: used ? t.colors.border : t.colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: used ? 0.35 : 1,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '700', color: t.colors.text }}>{n}</Text>
    </View>
  );
}

function Side({ label, wins, pip, color, active }: { label: string; wins: number; pip: number; color: string; active: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
        <Text style={{ fontSize: 15, fontWeight: '700', color: active ? t.colors.primary : t.colors.text }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Muted style={{ fontSize: 12 }}>
        {wins} galibiyet · {pip} pip
      </Muted>
    </View>
  );
}
