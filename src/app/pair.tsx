import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { Button, Card, ErrorText, Input, Muted, Screen, Title } from '../components/ui';
import { auth } from '../lib/firebase';
import { createInvite, joinInvite } from '../lib/pairing';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';

export default function Pair() {
  const { profile, user } = useSession();
  const { colors, fonts } = useTheme();
  const styles = {
    cardTitle: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
    code: { fontFamily: fonts.title, fontSize: 52, letterSpacing: 6, color: colors.primary, textAlign: 'center' as const },
    codeInput: { fontSize: 22, letterSpacing: 6, textAlign: 'center' as const },
    or: { textAlign: 'center' as const, color: colors.muted },
  };
  const myName = profile?.name || user?.displayName || 'Ben';
  const [code, setCode] = useState<string | null>(null);
  const [partnerCode, setPartnerCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');

  async function onCreate() {
    setError('');
    setBusy('create');
    try {
      setCode(await createInvite(myName));
    } catch {
      setError('Kod oluşturulamadı, tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  async function onJoin() {
    setError('');
    if (partnerCode.trim().length !== 6) return setError('Kod 6 karakter olmalı.');
    setBusy('join');
    try {
      await joinInvite(partnerCode, myName);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Eşleşme yapılamadı.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Title>Partnerini bağla</Title>
      <Muted>Biriniz davet kodu oluştursun, diğeriniz bu kodu girsin. Hepsi bu kadar.</Muted>

      <Card>
        <Text style={styles.cardTitle}>Davet kodu oluştur</Text>
        {code ? (
          <View style={{ gap: 12 }}>
            <Text style={styles.code}>{code}</Text>
            <Muted>Partnerin bu kodu girdiğinde otomatik olarak eşleşeceksiniz.</Muted>
            <Button
              label="Kodu paylaş"
              variant="secondary"
              onPress={() => Share.share({ message: `UsDaily'de eşleşelim! Davet kodum: ${code}` })}
            />
          </View>
        ) : (
          <Button label="Kod oluştur" onPress={onCreate} busy={busy === 'create'} />
        )}
      </Card>

      <Text style={styles.or}>ya da</Text>

      <Card>
        <Text style={styles.cardTitle}>Partnerinin kodunu gir</Text>
        <Input
          placeholder="ABC123"
          value={partnerCode}
          onChangeText={(t) => setPartnerCode(t.toUpperCase())}
          autoCapitalize="characters"
          maxLength={6}
          style={styles.codeInput}
        />
        <Button label="Eşleş" onPress={onJoin} busy={busy === 'join'} />
      </Card>

      <ErrorText>{error}</ErrorText>

      <Pressable onPress={() => signOut(auth)} style={{ alignItems: 'center', padding: 8 }}>
        <Text style={{ color: colors.muted }}>Çıkış yap</Text>
      </Pressable>
    </Screen>
  );
}
