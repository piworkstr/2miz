import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { acceptInvite, declineInvite, GAMES, JOIN_HOURS, passesLeft, useIncomingInvite } from '../lib/games';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Button, ErrorText, Muted } from './ui';

// Uygulama açıkken partnerden gelen oyun daveti hangi sekmede olursan ol açılır.
// (Telefon kilitliyken gelen bildirim, Apple hesabı onaylanınca eklenecek.)
export function InviteModal() {
  const t = useTheme();
  const { user, couple, partnerName } = useSession();
  const invite = useIncomingInvite(couple?.id, user?.uid);
  const [busy, setBusy] = useState<'go' | 'no' | null>(null);
  const [error, setError] = useState('');
  const [later, setLater] = useState<string | null>(null); // "sonra bakarım": bu açılışta bir daha çıkmaz, hak düşmez

  if (!invite || !user || !couple || later === invite.id) return null;
  const left = passesLeft(couple, user.uid);
  const game = GAMES[invite.type];

  async function go() {
    if (!invite || !couple) return;
    setBusy('go');
    try {
      await acceptInvite(couple.id, invite.id, user?.uid);
      router.push({ pathname: '/game/[id]', params: { id: invite.id } });
    } finally {
      setBusy(null);
    }
  }

  async function no() {
    if (!invite || !couple || !user) return;
    setError('');
    setBusy('no');
    try {
      await declineInvite(couple.id, invite.id, user.uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Olmadı, tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal transparent animationType="fade" visible>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 }}>
        <View
          style={{ backgroundColor: t.colors.card, borderRadius: Math.max(t.radius.card, 8), padding: 22, gap: 14, alignItems: 'center' }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: t.colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={game.icon as ComponentProps<typeof Ionicons>['name']} size={32} color={t.colors.primary} />
          </View>
          <Text
            maxFontSizeMultiplier={1.25}
            style={{ fontFamily: t.fonts.title, fontSize: 30, lineHeight: 36, color: t.colors.text, textAlign: 'center' }}
          >
            {partnerName} {game.name} oynuyor
          </Text>
          <Muted style={{ textAlign: 'center' }}>{game.blurb} · Katılınca sıra sana da gelir; oyun seni bekliyor.</Muted>
          <Button style={{ alignSelf: 'stretch' }} label="Katıl" onPress={go} busy={busy === 'go'} />
          {left > 0 ? (
            <Button
              style={{ alignSelf: 'stretch' }}
              variant="secondary"
              label={`Şimdi olmaz (bu hafta ${left} hak)`}
              onPress={no}
              busy={busy === 'no'}
            />
          ) : (
            <Muted style={{ textAlign: 'center', fontSize: 13 }}>
              Bu haftaki "şimdi olmaz" hakların bitti. Çağrı {JOIN_HOURS} saat açık kalır; müsait olunca katıl 😉
            </Muted>
          )}
          <ErrorText>{error}</ErrorText>
          <Pressable onPress={() => setLater(invite.id)} hitSlop={8} style={{ padding: 6 }}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted, fontSize: 13 }}>
              Sonra bakarım (ana ekranda "Katıl" olarak kalır)
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
