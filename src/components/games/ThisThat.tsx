import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { THIS_THAT } from '../../lib/gameData';
import { answerThisThat, type GameProps } from '../../lib/games';
import { useTheme } from '../../lib/useTheme';
import { Card, Muted } from '../ui';
import { BigChoice, Done, Progress, ResultHeader, useFinishOnce } from './shared';

export function ThisThat({ game, coupleId, uid, partnerId, partnerName, myName }: GameProps) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const pairs = game.pairs ?? [];
  const total = pairs.length;
  const mine = game.answers?.[uid] ?? [];
  const theirs = game.answers?.[partnerId] ?? [];
  const bothDone = mine.length >= total && theirs.length >= total;
  useFinishOnce(bothDone, game, coupleId, uid);

  async function choose(choice: number) {
    if (busy) return;
    setBusy(true);
    try {
      await answerThisThat(coupleId, game, uid, choice);
    } finally {
      setBusy(false);
    }
  }

  if (mine.length < total) {
    const [a, b] = THIS_THAT[pairs[mine.length]];
    return (
      <>
        <Progress value={mine.length} total={total} label={`Sen ${mine.length}/${total} · ${partnerName} ${Math.min(theirs.length, total)}/${total}`} />
        <Muted style={{ textAlign: 'center' }}>Hızlı ol, düşünme!</Muted>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <BigChoice label={a} onPress={() => choose(0)} disabled={busy} />
          <BigChoice label={b} onPress={() => choose(1)} disabled={busy} />
        </View>
      </>
    );
  }

  if (!bothDone) {
    return (
      <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
        <ActivityIndicator color={t.colors.primary} />
        <Muted style={{ textAlign: 'center' }}>
          Sen bitirdin. {partnerName} {theirs.length}/{total} soruda, sonuçlar onun bitirmesini bekliyor.
        </Muted>
      </Card>
    );
  }

  const same = pairs.filter((_, i) => mine[i] === theirs[i]).length;
  const pct = Math.round((same / total) * 100);
  const line =
    pct >= 80 ? 'Aynı kafadasınız!' : pct >= 50 ? 'Gayet uyumlusunuz, ama sürprizler de var.' : 'Zıt kutuplar birbirini çeker 😄';

  return (
    <Done>
      <ResultHeader big={`%${pct}`} line={`${total} sorunun ${same} tanesinde aynı seçtiniz. ${line}`} game={game} uid={uid} />
      {pairs.map((p, i) => {
        const pair = THIS_THAT[p];
        const match = mine[i] === theirs[i];
        return (
          <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
            <Ionicons name={match ? 'heart' : 'swap-horizontal'} size={20} color={match ? t.colors.primary : t.colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.colors.text, fontFamily: t.fonts.body, fontSize: 15 }}>
                {match ? `İkiniz de: ${pair[mine[i]]}` : `${myName}: ${pair[mine[i]]} · ${partnerName}: ${pair[theirs[i]]}`}
              </Text>
            </View>
          </Card>
        );
      })}
    </Done>
  );
}
