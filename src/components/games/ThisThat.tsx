import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { THIS_THAT } from '../../lib/gameData';
import { answerThisThat, type GameProps } from '../../lib/games';
import { useTheme } from '../../lib/useTheme';
import { Card } from '../ui';
import { Done, Progress, ResultHeader, useFinishOnce } from './shared';

const REVEAL_MS = 2200;

// Soru soru birlikte ilerlenir: üstte senin seçimin, altta partnerinin cevabı.
// İkiniz de seçince cevaplar kısa süre açık kalır, sonra sonraki soruya geçilir.
export function ThisThat({ game, coupleId, uid, partnerId, partnerName, myName }: GameProps) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const pairs = game.pairs ?? [];
  const total = pairs.length;
  const mine = game.answers?.[uid] ?? [];
  const theirs = game.answers?.[partnerId] ?? [];
  const both = Math.min(mine.length, theirs.length); // ikinizin de cevapladığı soru sayısı
  const bothDone = both >= total;
  useFinishOnce(bothDone, game, coupleId, uid);

  // Yeni bir soru ikiniz tarafından da cevaplandığında, o sorunun sonucunu biraz göster.
  const [reveal, setReveal] = useState<number | null>(null);
  const seen = useRef(both);
  useEffect(() => {
    if (both > seen.current) {
      setReveal(both - 1);
      seen.current = both;
      const tm = setTimeout(() => setReveal(null), REVEAL_MS);
      return () => clearTimeout(tm);
    }
  }, [both]);

  async function choose(choice: number) {
    if (busy || mine.length > both) return; // bu soruya zaten cevap verdin
    setBusy(true);
    try {
      await answerThisThat(coupleId, game, uid, choice);
    } finally {
      setBusy(false);
    }
  }

  if (!bothDone || reveal !== null) {
    const index = reveal ?? both;
    const [a, b] = THIS_THAT[pairs[index]];
    const myPick = mine[index];
    const theirPick = theirs[index];
    const revealed = myPick !== undefined && theirPick !== undefined;
    const match = revealed && myPick === theirPick;

    return (
      <>
        <Progress value={both} total={total} label={`Soru ${index + 1}/${total}`} />

        <Half title="Senin cevabın" highlight={!revealed && myPick === undefined}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[a, b].map((label, i) => (
              <Choice
                key={label}
                label={label}
                state={myPick === undefined ? 'open' : myPick === i ? 'picked' : 'dim'}
                onPress={() => choose(i)}
                disabled={busy || myPick !== undefined}
              />
            ))}
          </View>
        </Half>

        {revealed && (
          <View style={{ alignItems: 'center', marginVertical: -4 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: match ? t.colors.primary : t.colors.card,
                borderWidth: 1,
                borderColor: match ? t.colors.primary : t.colors.border,
                borderRadius: 20,
                paddingHorizontal: 14,
                paddingVertical: 6,
              }}
            >
              <Ionicons name={match ? 'heart' : 'swap-vertical'} size={16} color={match ? t.colors.onPrimary : t.colors.muted} />
              <Text maxFontSizeMultiplier={1.25} style={{ color: match ? t.colors.onPrimary : t.colors.muted, fontWeight: '600' }}>
                {match ? 'Aynı!' : 'Farklı'}
              </Text>
            </View>
          </View>
        )}

        <Half title={`${partnerName}'in cevabı`} partner>
          {revealed ? (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {[a, b].map((label, i) => (
                <Choice key={label} label={label} state={theirPick === i ? 'picked' : 'dim'} partner />
              ))}
            </View>
          ) : (
            <View style={{ minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {theirPick === undefined ? (
                <>
                  <ActivityIndicator color={t.colors.muted} />
                  <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted, fontFamily: t.fonts.body }}>
                    {partnerName} düşünüyor…
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="lock-closed-outline" size={22} color={t.colors.primary} />
                  <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted, fontFamily: t.fonts.body, textAlign: 'center' }}>
                    {partnerName} seçti. Sen seçince görünecek.
                  </Text>
                </>
              )}
            </View>
          )}
        </Half>
      </>
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
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontFamily: t.fonts.body, fontSize: 15 }}>
                {match ? `İkiniz de: ${pair[mine[i]]}` : `${myName}: ${pair[mine[i]]} · ${partnerName}: ${pair[theirs[i]]}`}
              </Text>
            </View>
          </Card>
        );
      })}
    </Done>
  );
}

function Half({ title, partner, highlight, children }: { title: string; partner?: boolean; highlight?: boolean; children: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: partner ? t.colors.primarySoft : t.colors.card,
        borderRadius: Math.max(t.radius.card, 6),
        borderWidth: highlight ? 2 : 1,
        borderColor: highlight ? t.colors.primary : t.colors.border,
        padding: 14,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={partner ? 'heart-outline' : 'person-outline'} size={18} color={t.colors.primary} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontWeight: '700', fontSize: 15, fontFamily: t.fonts.button }}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function Choice({
  label,
  state,
  onPress,
  disabled,
  partner,
}: {
  label: string;
  state: 'open' | 'picked' | 'dim';
  onPress?: () => void;
  disabled?: boolean;
  partner?: boolean;
}) {
  const t = useTheme();
  const picked = state === 'picked';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 96,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: Math.max(t.radius.card - 4, 4),
        borderWidth: 2,
        borderColor: picked || pressed ? t.colors.primary : t.colors.border,
        backgroundColor: picked ? t.colors.primary : partner ? t.colors.card : t.colors.bg,
        opacity: state === 'dim' ? 0.4 : 1,
      })}
    >
      <Text
        maxFontSizeMultiplier={1.25}
        style={{
          fontFamily: t.fonts.display,
          fontSize: 24,
          lineHeight: 30,
          color: picked ? t.colors.onPrimary : t.colors.text,
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
