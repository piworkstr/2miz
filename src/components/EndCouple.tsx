import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { endCouple } from '../lib/account';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Button, Card, ErrorText, Input, Muted, T } from './ui';

// App Store kuralı 1.2: kullanıcı karşı tarafı engelleyebilmeli. Eşleşmeyi bitirmek bağlantıyı tamamen keser.
export function EndCouple() {
  const t = useTheme();
  const { couple, partnerName } = useSession();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!couple) return null;

  async function confirm() {
    if (!couple) return;
    setError('');
    if (!password) return setError('Devam etmek için şifreni gir.');
    setBusy(true);
    try {
      await endCouple(password, couple.id);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      setError(code === 'auth/invalid-credential' || code === 'auth/wrong-password' ? 'Şifre hatalı.' : 'İşlem tamamlanamadı, tekrar dene.');
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Pressable onPress={() => setOpen(true)} style={{ alignItems: 'center', padding: 10 }}>
        <Text style={{ color: t.colors.muted, fontSize: 14 }}>Eşleşmeyi bitir ve engelle</Text>
      </Pressable>
    );
  }

  return (
    <Card style={{ borderColor: '#D9534F' }}>
      <T style={{ fontSize: 17, fontWeight: '600' }}>{partnerName} ile eşleşmeyi bitir</T>
      <Muted>
        Ortak albümünüz, mesajlarınız, görev geçmişiniz, date'leriniz, kuponlarınız ve oyunlarınız ikiniz için de kalıcı
        olarak silinir. {partnerName} sana bir daha mesaj gönderemez ve sen yeni bir davet kodu paylaşmadıkça seninle
        eşleşemez. Hesabın açık kalır.
      </Muted>
      <Input placeholder="Şifren" secureTextEntry value={password} onChangeText={setPassword} />
      <ErrorText>{error}</ErrorText>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button style={{ flex: 1 }} label="Vazgeç" variant="secondary" onPress={() => setOpen(false)} />
        <Button style={{ flex: 1, backgroundColor: '#D9534F' }} label="Bitir" onPress={confirm} busy={busy} />
      </View>
    </Card>
  );
}
