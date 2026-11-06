import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { DateInput, type DateParts } from '../../components/DateInput';
import { Button, ErrorText, Input, Muted, Screen, T, Title } from '../../components/ui';
import { useSession } from '../../lib/session';
import { createTrip } from '../../lib/trips';

const empty: DateParts = { d: '', m: '', y: '' };

// Seyahat tarihleri geçmişte ya da devam ediyor olabilir; en fazla bir yıl ileri.
function key({ d, m, y }: DateParts): string | null {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!day || !month || y.length !== 4) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (date.getTime() > Date.now() + 366 * 86400000 || year < 1950) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function NewTrip() {
  const { user, couple } = useSession();
  const [name, setName] = useState('');
  const [place, setPlace] = useState('');
  const [start, setStart] = useState<DateParts>(empty);
  const [end, setEnd] = useState<DateParts>(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!user || !couple) return;
    const s = key(start);
    const e = key(end.d || end.m || end.y ? end : start);
    if (!name.trim()) return setError('Seyahate bir ad ver, örn. "Kaş tatili".');
    if (!s) return setError('Başlangıç tarihini kontrol et.');
    if (!e) return setError('Bitiş tarihini kontrol et.');
    if (e < s) return setError('Bitiş tarihi başlangıçtan önce olamaz.');
    setBusy(true);
    try {
      const id = await createTrip(couple.id, user.uid, name, place, s, e);
      router.replace({ pathname: '/trip/[id]', params: { id } });
    } catch {
      setError('Kaydedilemedi, tekrar dene.');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Yeni seyahat</Title>
      <Muted>Tatilde çektiğiniz fotoğrafları galeriden seçip bu seyahatin sayfasına ekleyeceksiniz.</Muted>
      <View style={{ gap: 8 }}>
        <T style={{ fontWeight: '600' }}>Seyahatin adı</T>
        <Input value={name} onChangeText={setName} placeholder="Kaş tatili" maxLength={40} />
      </View>
      <View style={{ gap: 8 }}>
        <T style={{ fontWeight: '600' }}>Nereye?</T>
        <Input value={place} onChangeText={setPlace} placeholder="Kaş, Antalya" maxLength={40} />
      </View>
      <View style={{ gap: 8 }}>
        <T style={{ fontWeight: '600' }}>Başlangıç</T>
        <DateInput value={start} onChange={setStart} />
      </View>
      <View style={{ gap: 8 }}>
        <T style={{ fontWeight: '600' }}>Bitiş</T>
        <DateInput value={end} onChange={setEnd} />
        <Muted style={{ fontSize: 12 }}>Tek günlük bir gezi ise boş bırakabilirsin.</Muted>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button label="Seyahati oluştur" onPress={save} busy={busy} />
      <Button label="Vazgeç" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
