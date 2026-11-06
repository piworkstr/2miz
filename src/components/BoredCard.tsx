import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GAMES, sendInvite, useMyOpenInvite, type GameType } from '../lib/games';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Button, Card, ErrorText, Muted, T } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

// "Canım sıkıldı": partnere canlı oyun daveti gönderir.
export function BoredCard() {
  const t = useTheme();
  const { user, couple, partnerId, partnerName } = useSession();
  const open = useMyOpenInvite(couple?.id, user?.uid);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState<GameType | null>(null);
  const [error, setError] = useState('');

  if (!user || !couple || !partnerId) return null;

  async function invite(type: GameType) {
    if (!user || !couple || !partnerId) return;
    setError('');
    setBusy(type);
    try {
      const id = await sendInvite(couple.id, user.uid, partnerId, type);
      setChoosing(false);
      router.push({ pathname: '/game/[id]', params: { id } });
    } catch {
      setError('Davet gönderilemedi, tekrar dene.');
    } finally {
      setBusy(null);
    }
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
        <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Canım sıkıldı')}</T>
      </View>
      {choosing ? (
        <>
          <Muted>Hangi oyunu oynayalım? {partnerName}'e davet gidecek.</Muted>
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
                <Text style={{ color: t.colors.text, fontWeight: '600', fontSize: 15, fontFamily: t.fonts.body }}>{GAMES[g].name}</Text>
                <Muted style={{ fontSize: 12 }}>{busy === g ? 'Davet gönderiliyor…' : GAMES[g].blurb}</Muted>
              </View>
            </Pressable>
          ))}
          <ErrorText>{error}</ErrorText>
          <Pressable onPress={() => setChoosing(false)} style={{ alignItems: 'center', padding: 4 }}>
            <Text style={{ color: t.colors.muted }}>Vazgeç</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Muted>{partnerName}'i kısa bir oyuna davet et. Günün ilk oyunu ikinize de puan kazandırır.</Muted>
          <Button label="Oyun daveti gönder" onPress={() => setChoosing(true)} />
        </>
      )}
    </Card>
  );
}
