import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { KNOW_ME } from '../../lib/gameData';
import { answerKnowMe, type GameProps } from '../../lib/games';
import { useTheme } from '../../lib/useTheme';
import { Card, Muted } from '../ui';
import { Done, Option, Progress, ResultHeader, useFinishOnce } from './shared';

// Her soruda önce kendin için cevap verirsin, sonra partnerinin ne diyeceğini tahmin edersin.
export function KnowMe({ game, coupleId, uid, partnerId, partnerName, myName }: GameProps) {
  const t = useTheme();
  const [self, setSelf] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const qs = game.questions ?? [];
  const total = qs.length;
  const mySelf = game.self?.[uid] ?? [];
  const myGuess = game.guess?.[uid] ?? [];
  const theirSelf = game.self?.[partnerId] ?? [];
  const theirGuess = game.guess?.[partnerId] ?? [];
  const bothDone = mySelf.length >= total && theirSelf.length >= total;
  useFinishOnce(bothDone, game, coupleId, uid);

  async function guess(g: number) {
    if (self === null || busy) return;
    setBusy(true);
    try {
      await answerKnowMe(coupleId, game, uid, self, g);
      setSelf(null);
    } finally {
      setBusy(false);
    }
  }

  if (mySelf.length < total) {
    const q = KNOW_ME[qs[mySelf.length]];
    return (
      <>
        <Progress
          value={mySelf.length}
          total={total}
          label={`Soru ${mySelf.length + 1}/${total} · ${partnerName} ${Math.min(theirSelf.length, total)}/${total}`}
        />
        <Text
          maxFontSizeMultiplier={1.25}
          style={{ fontFamily: t.fonts.display, fontSize: t.displaySize, lineHeight: t.displaySize * 1.3, color: t.colors.text }}
        >
          {q.q}
        </Text>
        {self === null ? (
          <>
            <Muted>Önce sen: senin cevabın ne?</Muted>
            {q.options.map((o, i) => (
              <Option key={o} label={o} onPress={() => setSelf(i)} />
            ))}
          </>
        ) : (
          <>
            <Muted>Peki sence {partnerName} ne dedi?</Muted>
            {q.options.map((o, i) => (
              <Option key={o} label={o} onPress={() => guess(i)} />
            ))}
            <Text
              maxFontSizeMultiplier={1.25}
              onPress={() => setSelf(null)}
              style={{ color: t.colors.muted, textAlign: 'center', padding: 6 }}
            >
              Kendi cevabımı değiştir ({q.options[self]})
            </Text>
          </>
        )}
      </>
    );
  }

  if (!bothDone) {
    return (
      <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 28 }}>
        <ActivityIndicator color={t.colors.primary} />
        <Muted style={{ textAlign: 'center' }}>
          Sen bitirdin. {partnerName} {theirSelf.length}/{total} soruda, sonuçlar onun bitirmesini bekliyor.
        </Muted>
      </Card>
    );
  }

  // Benim tahminlerim onun kendi cevaplarıyla, onun tahminleri benimkilerle karşılaştırılır.
  const myScore = qs.filter((_, i) => myGuess[i] === theirSelf[i]).length;
  const theirScore = qs.filter((_, i) => theirGuess[i] === mySelf[i]).length;
  const line =
    myScore === theirScore
      ? `Berabere! İkiniz de birbirinizi ${myScore}/${total} tanıyorsunuz.`
      : myScore > theirScore
        ? `Sen ${partnerName}'i daha iyi tanıyorsun (${myScore}-${theirScore}).`
        : `${partnerName} seni daha iyi tanıyor (${theirScore}-${myScore}).`;

  return (
    <Done>
      <ResultHeader big={`${myScore}-${theirScore}`} line={line} game={game} uid={uid} />
      {qs.map((qi, i) => {
        const q = KNOW_ME[qi];
        return (
          <Card key={i} style={{ gap: 6, paddingVertical: 14 }}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontWeight: '600', fontSize: 15, fontFamily: t.fonts.body }}>
              {q.q}
            </Text>
            <Row
              ok={myGuess[i] === theirSelf[i]}
              text={`${partnerName}: ${q.options[theirSelf[i]]} · senin tahminin: ${q.options[myGuess[i]]}`}
            />
            <Row ok={theirGuess[i] === mySelf[i]} text={`${myName}: ${q.options[mySelf[i]]} · onun tahmini: ${q.options[theirGuess[i]]}`} />
          </Card>
        );
      })}
    </Done>
  );
}

function Row({ ok, text }: { ok: boolean; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <Ionicons name={ok ? 'checkmark-circle' : 'close-circle'} size={18} color={ok ? t.colors.success : t.colors.muted} />
      <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, color: t.colors.text, fontSize: 14, fontFamily: t.fonts.body }}>
        {text}
      </Text>
    </View>
  );
}
