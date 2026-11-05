import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { db } from '../lib/firebase';
import { useSession, type Couple } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { DateInput, toDateKey, type DateParts } from './DateInput';
import { Button, Card, ErrorText, Muted, T } from './ui';

const STATUSES: { id: NonNullable<Couple['status']>; label: string }[] = [
  { id: 'sevgili', label: 'Sevgili' },
  { id: 'nisanli', label: 'Nişanlı' },
  { id: 'evli', label: 'Evli' },
  { id: 'uzak', label: 'Uzak mesafe' },
];

export function daysTogether(startDate: string): number {
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - start.getTime()) / 86400000) + 1;
}

// Eşleşmeden sonra "Bugün" ekranında çıkar; biriniz doldurur, ikiniz de görürsünüz.
export function CoupleInfoCard() {
  const t = useTheme();
  const { couple } = useSession();
  const [hidden, setHidden] = useState(false);
  const [start, setStart] = useState<DateParts>({ d: '', m: '', y: '' });
  const [status, setStatus] = useState<Couple['status']>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!couple || couple.startDate || hidden) return null;

  async function save() {
    if (!couple) return;
    setError('');
    const key = toDateKey(start);
    if (!key) return setError('Tarihi gün / ay / yıl olarak gir.');
    if (!status) return setError('İlişki durumunuzu seç.');
    setBusy(true);
    try {
      await updateDoc(doc(db, 'couples', couple.id), { startDate: key, status });
    } catch {
      setError('Kaydedilemedi, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card accent>
      <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Hikayenizi başlatalım')}</T>
      <Muted>Ne zamandan beri birliktesiniz? Gün sayacınız ve yıl dönümü hatırlatmanız buradan gelecek.</Muted>
      <DateInput value={start} onChange={setStart} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {STATUSES.map((s) => {
          const on = status === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => setStatus(s.id)}
              style={{
                paddingVertical: 9,
                paddingHorizontal: 13,
                borderRadius: t.radius.pill + 8,
                borderWidth: 1.5,
                borderColor: on ? t.colors.primary : t.colors.border,
                backgroundColor: on ? t.colors.primarySoft : 'transparent',
              }}
            >
              <Text style={{ color: on ? t.colors.primary : t.colors.text, fontFamily: t.fonts.body, fontSize: 14 }}>
                {tx(t, s.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ErrorText>{error}</ErrorText>
      <Button label="Kaydet" onPress={save} busy={busy} />
      <Pressable onPress={() => setHidden(true)} style={{ alignItems: 'center', padding: 4 }}>
        <Text style={{ color: t.colors.muted }}>Sonra</Text>
      </Pressable>
    </Card>
  );
}
