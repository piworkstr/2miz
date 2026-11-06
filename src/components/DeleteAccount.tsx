import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { deleteAccount } from '../lib/account';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Button, Card, ErrorText, Input, Muted, T } from './ui';

export function DeleteAccount() {
  const t = useTheme();
  const { couple, partnerName } = useSession();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    setError('');
    if (!password) return setError('Devam etmek için şifreni gir.');
    setBusy(true);
    try {
      await deleteAccount(password, couple?.id ?? null);
      // Oturum kapanınca uygulama kendiliğinden hoş geldin ekranına döner.
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      setError(
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? 'Şifre hatalı.'
          : code === 'auth/network-request-failed'
            ? 'İnternet bağlantını kontrol et.'
            : 'Hesap silinemedi, tekrar dene.',
      );
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={{ alignItems: 'center', padding: 10 }}>
        <Text style={{ color: t.colors.muted, fontSize: 14 }}>Hesabımı sil</Text>
      </Pressable>
    );
  }

  return (
    <Card style={{ borderColor: '#D9534F' }}>
      <T style={{ fontSize: 17, fontWeight: '600' }}>Hesabını silmek üzeresin</T>
      <Muted>
        Hesabın, profilin ve {partnerName} ile ortak albümünüz, görev geçmişiniz, date'leriniz ve kuponlarınız kalıcı
        olarak silinir. Bu işlem geri alınamaz. {partnerName}'in hesabı açık kalır ama eşleşmeniz sona erer.
      </Muted>
      <Muted>
        İleride premium aboneliğin olursa, faturalandırma Apple veya Google üzerinden devam eder; önce telefonunun
        abonelik ayarlarından iptal etmelisin.
      </Muted>
      <Input placeholder="Şifren" secureTextEntry value={password} onChangeText={setPassword} />
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} label="Vazgeç" variant="secondary" onPress={() => setOpen(false)} />
        <Button style={{ flex: 1, backgroundColor: '#D9534F' }} label="Kalıcı olarak sil" onPress={confirm} busy={busy} />
      </View>
    </Card>
  );
}
