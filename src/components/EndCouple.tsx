import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { endCouple } from '../lib/account';
import { useL } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Button, Card, ErrorText, Input, Muted, T } from './ui';

// App Store kuralı 1.2: kullanıcı karşı tarafı engelleyebilmeli. Eşleşmeyi bitirmek bağlantıyı tamamen keser.
export function EndCouple() {
  const t = useTheme();
  const l = useL();
  const { couple, partnerName } = useSession();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!couple) return null;

  async function confirm() {
    if (!couple) return;
    setError('');
    if (!password) return setError(l('Devam etmek için şifreni gir.', 'Enter your password to continue.'));
    setBusy(true);
    try {
      await endCouple(password, couple.id);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? l('Şifre hatalı.', 'Wrong password.')
          : l('İşlem tamamlanamadı, tekrar dene.', "Couldn't finish, please try again."),
      );
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={{ alignItems: 'center', padding: 10 }}>
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted, fontSize: 14 }}>
          {l('Eşleşmeyi bitir ve engelle', 'End pairing and block')}
        </Text>
      </Pressable>
    );
  }

  return (
    <Card style={{ borderColor: '#D9534F' }}>
      <T style={{ fontSize: 17, fontWeight: '600' }}>{l(`${partnerName} ile eşleşmeyi bitir`, `End your pairing with ${partnerName}`)}</T>
      <Muted>
        {l(
          `Ortak albümünüz, mesajlarınız, görev geçmişiniz, date'leriniz, kuponlarınız ve oyunlarınız ikiniz için de kalıcı olarak silinir. ${partnerName} sana bir daha mesaj gönderemez ve sen yeni bir davet kodu paylaşmadıkça seninle eşleşemez. Hesabın açık kalır.`,
          `Your shared album, messages, task history, dates, coupons and games are permanently deleted for both of you. ${partnerName} can't message you again and can't pair with you unless you share a new invite code. Your account stays open.`,
        )}
      </Muted>
      <Input placeholder={l('Şifren', 'Your password')} secureTextEntry value={password} onChangeText={setPassword} />
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} label={l('Vazgeç', 'Cancel')} variant="secondary" onPress={() => setOpen(false)} />
        <Button style={{ flex: 1, backgroundColor: '#D9534F' }} label={l('Bitir', 'End')} onPress={confirm} busy={busy} />
      </View>
    </Card>
  );
}
