import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Modal, Text, View } from 'react-native';
import { acceptInvite, declineInvite, GAMES, INVITE_MINUTES, passesLeft, useIncomingInvite } from '../lib/games';
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

  if (!invite || !user || !couple) return null;
  const left = passesLeft(couple, user.uid);
  const game = GAMES[invite.type];

  async function go() {
    if (!invite || !couple) return;
    setBusy('go');
    try {
      await acceptInvite(couple.id, invite.id);
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
        <View style={{ backgroundColor: t.colors.card, borderRadius: Math.max(t.radius.card, 8), padding: 22, gap: 14, alignItems: 'center' }}>
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
          <Text style={{ fontFamily: t.fonts.title, fontSize: 30, lineHeight: 36, color: t.colors.text, textAlign: 'center' }}>
            {partnerName} seni oyuna çağırıyor
          </Text>
          <Muted style={{ textAlign: 'center' }}>
            {game.name} · {game.blurb}
          </Muted>
          <Button style={{ alignSelf: 'stretch' }} label="Hadi oynayalım" onPress={go} busy={busy === 'go'} />
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
              Bu haftaki "şimdi olmaz" hakların bitti. Davet {INVITE_MINUTES} dakika içinde kendiliğinden kapanır ama seri
              için oynamak iyi olur 😉
            </Muted>
          )}
          <ErrorText>{error}</ErrorText>
        </View>
      </View>
    </Modal>
  );
}
