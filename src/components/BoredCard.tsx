import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { notifyPartner } from '../lib/push';
import { acceptInvite, GAMES, partnerJoined, sendInvite, turnOf, useActiveTurnGame, useMyOpenInvite, type GameType } from '../lib/games';
import { countGame, FREE, gamesToday, openPlus, usePlus } from '../lib/plus';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Button, Card, ErrorText, Muted, T } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

// "Canım sıkıldı": partnere canlı oyun daveti gönderir.
export function BoredCard() {
  const t = useTheme();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const open = useMyOpenInvite(couple?.id, user?.uid);
  const active = useActiveTurnGame(couple?.id);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState<GameType | null>(null);
  const [error, setError] = useState('');
  const plus = usePlus();

  if (!user || !couple || !partnerId) return null;

  async function invite(type: GameType) {
    if (!user || !couple || !partnerId) return;
    if (!plus.active && gamesToday(couple) >= FREE.gamesPerDay) return openPlus('game');
    setError('');
    setBusy(type);
    try {
      const id = await sendInvite(couple.id, user.uid, partnerId, type);
      countGame(couple.id, couple).catch(() => {});
      notifyPartner(
        partnerId,
        `${profile?.name ?? 'Partnerin'} ${GAMES[type].name} oynuyor 🎲`,
        'Müsait olunca katıl; oyun seni bekliyor.',
        {
          type: 'game',
          url: '/',
        },
      );
      setChoosing(false);
      router.push({ pathname: '/game/[id]', params: { id } });
    } catch {
      setError('Davet gönderilemedi, tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  if (active && user) {
    const mine = turnOf(active) === user.uid;
    const name = GAMES[active.type].name;
    const solo = !partnerJoined(active);
    const iStarted = active.from === user.uid;
    return (
      <Card accent>
        <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>
          {tx(t, mine ? `${name}: sıra sende` : `${name} sürüyor`)}
        </T>
        <Muted>
          {active.blocks ? `Ortak skorunuz ${active.blocks.score}. ` : ''}
          {solo
            ? iStarted
              ? `${partnerName} henüz katılmadı; yalnız oynuyorsun.`
              : `${partnerName} başlattı, seni bekliyor.`
            : mine
              ? `${partnerName} hamlesini yaptı.`
              : `${partnerName}'in hamlesi bekleniyor.`}
        </Muted>
        <Button
          label={solo && !iStarted ? 'Katıl' : mine ? 'Hamleni yap' : 'Oyuna bak'}
          variant={mine || solo ? 'primary' : 'secondary'}
          onPress={async () => {
            if (solo && !iStarted) await acceptInvite(couple.id, active.id, user.uid).catch(() => {});
            router.push({ pathname: '/game/[id]', params: { id: active.id } });
          }}
        />
      </Card>
    );
  }

  if (open) {
    return (
      <Card accent>
        <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Davetin bekliyor')}</T>
        <Muted>
          {partnerName}'e {GAMES[open.type].name} daveti gönderdin.
        </Muted>
        <Button label="Davete dön" variant="secondary" onPress={() => router.push({ pathname: '/game/[id]', params: { id: open.id } })} />
      </Card>
    );
  }

  return (
    <Card accent>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="game-controller-outline" size={24} color={t.colors.primary} />
        <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Birlikte oyna')}</T>
      </View>
      {choosing ? (
        <>
          <Muted>Hangi oyun? Hemen başlarsın; {partnerName} müsait olunca katılır.</Muted>
          {(Object.keys(GAMES) as GameType[]).map((g) => (
            <Pressable
              key={g}
              onPress={() => invite(g)}
              disabled={!!busy}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                borderRadius: Math.min(t.radius.card, 14),
                borderWidth: 1.5,
                borderColor: pressed || busy === g ? t.colors.primary : t.colors.border,
                backgroundColor: pressed || busy === g ? t.colors.primarySoft : t.colors.card,
              })}
            >
              <Ionicons name={GAMES[g].icon as IconName} size={24} color={t.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text
                  maxFontSizeMultiplier={1.25}
                  style={{ color: t.colors.text, fontWeight: '600', fontSize: 15, fontFamily: t.fonts.body }}
                >
                  {GAMES[g].name}
                </Text>
                <Muted style={{ fontSize: 12 }}>{busy === g ? 'Davet gönderiliyor…' : GAMES[g].blurb}</Muted>
              </View>
            </Pressable>
          ))}
          <ErrorText>{error}</ErrorText>
          <Pressable onPress={() => setChoosing(false)} style={{ alignItems: 'center', padding: 4 }}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted }}>
              Vazgeç
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <Muted>Hemen oynamaya başla; {partnerName} müsait olunca oyuna katılır. Günün ilk oyunu ikinize de +10 puan kazandırır.</Muted>
          <Button label="Oyun başlat" onPress={() => setChoosing(true)} />
        </>
      )}
    </Card>
  );
}
