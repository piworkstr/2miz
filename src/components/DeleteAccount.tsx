import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { deleteAccount } from '../lib/account';
import { useL } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Button, Card, ErrorText, Input, Muted, T } from './ui';

export function DeleteAccount() {
  const t = useTheme();
  const l = useL();
  const { couple, partnerName } = useSession();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setError('');
    if (!password) return setError(l('Devam etmek için şifreni gir.', 'Enter your password to continue.'));
    setBusy(true);
    try {
      await deleteAccount(password, couple?.id ?? null);
      // Oturum kapanınca uygulama kendiliğinden hoş geldin ekranına döner.
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? l('Şifre hatalı.', 'Wrong password.')
          : code === 'auth/network-request-failed'
            ? l('İnternet bağlantını kontrol et.', 'Check your internet connection.')
            : l('Hesap silinemedi, tekrar dene.', "Couldn't delete the account, please try again."),
      );
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={{ alignItems: 'center', padding: 10 }}>
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted, fontSize: 14 }}>
          {l('Hesabımı sil', 'Delete my account')}
        </Text>
      </Pressable>
    );
  }

  return (
    <Card style={{ borderColor: '#D9534F' }}>
      <T style={{ fontSize: 17, fontWeight: '600' }}>{l('Hesabını silmek üzeresin', "You're about to delete your account")}</T>
      <Muted>
        {l(
          `Hesabın, profilin ve ${partnerName} ile ortak albümünüz, görev geçmişiniz, date'leriniz ve kuponlarınız kalıcı olarak silinir. Bu işlem geri alınamaz. ${partnerName}'in hesabı açık kalır ama eşleşmeniz sona erer.`,
          `Your account, your profile and the album, task history, dates and coupons you share with ${partnerName} will be permanently deleted. This can't be undone. ${partnerName}'s account stays open, but your pairing ends.`,
        )}
      </Muted>
      <Muted>
        {l(
          'İleride premium aboneliğin olursa, faturalandırma Apple veya Google üzerinden devam eder; önce telefonunun abonelik ayarlarından iptal etmelisin.',
          "If you have a subscription, billing continues through Apple or Google; cancel it first in your phone's subscription settings.",
        )}
      </Muted>
      <Input placeholder={l('Şifren', 'Your password')} secureTextEntry value={password} onChangeText={setPassword} />
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} label={l('Vazgeç', 'Cancel')} variant="secondary" onPress={() => setOpen(false)} />
        <Button
          style={{ flex: 1, backgroundColor: '#D9534F' }}
          label={l('Kalıcı olarak sil', 'Delete permanently')}
          onPress={confirm}
          busy={busy}
        />
      </View>
    </Card>
  );
}
