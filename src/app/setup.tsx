import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, ErrorText, Muted, Screen, Title } from '../components/ui';
import { db } from '../lib/firebase';
import { INTERESTS } from '../lib/interests';
import { useSession, type Profile } from '../lib/session';
import { useTheme } from '../lib/useTheme';

const TIMES: { id: NonNullable<Profile['notifyTime']>; label: string; hint: string }[] = [
  { id: 'sabah', label: 'Sabah', hint: '09:00' },
  { id: 'ogle', label: 'Öğle', hint: '13:00' },
  { id: 'aksam', label: 'Akşam', hint: '19:00' },
];

export default function Setup() {
  const t = useTheme();
  const { user } = useSession();
  const [interests, setInterests] = useState<string[]>([]);
  const [time, setTime] = useState<Profile['notifyTime']>('aksam');
  const [busy, setBusy] = useState<'save' | 'skip' | null>(null);
  const [error, setError] = useState('');

  function toggle(i: string) {
    setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  }

  async function finish(skip: boolean) {
    if (!user) return;
    setError('');
    setBusy(skip ? 'skip' : 'save');
    try {
      await updateDoc(doc(db, 'users', user.uid), skip ? { onboarded: true } : { interests, notifyTime: time, onboarded: true });
    } catch {
      setError('Kaydedilemedi, tekrar dene.');
      setBusy(null);
    }
  }

  const chip = (selected: boolean) => ({
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: t.radius.pill + 8,
    borderWidth: 1.5,
    borderColor: selected ? t.colors.primary : t.colors.border,
    backgroundColor: selected ? t.colors.primarySoft : t.colors.card,
  });

  return (
    <Screen>
      <Title>Biraz daha tanışalım</Title>
      <Muted>Görevleri ve ileride date önerilerini sana göre seçmek için. İstersen sonra doldurabilirsin.</Muted>

      <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 17, fontWeight: '600', color: t.colors.text, marginTop: 8 }}>
        Nelerden hoşlanırsın?
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {INTERESTS.map((i) => {
          const on = interests.includes(i);
          return (
            <Pressable key={i} onPress={() => toggle(i)} style={chip(on)}>
              <Text
                maxFontSizeMultiplier={1.25}
                style={{ color: on ? t.colors.primary : t.colors.text, fontFamily: t.fonts.body, fontSize: 15 }}
              >
                {i}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 17, fontWeight: '600', color: t.colors.text, marginTop: 8 }}>
        Günün görevi ne zaman gelsin?
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {TIMES.map((o) => {
          const on = time === o.id;
          return (
            <Pressable key={o.id} onPress={() => setTime(o.id)} style={[chip(on), { flex: 1, alignItems: 'center' }]}>
              <Text maxFontSizeMultiplier={1.25} style={{ color: on ? t.colors.primary : t.colors.text, fontWeight: '600', fontSize: 15 }}>
                {o.label}
              </Text>
              <Muted style={{ fontSize: 12 }}>{o.hint}</Muted>
            </Pressable>
          );
        })}
      </View>

      <ErrorText>{error}</ErrorText>
      <View style={{ gap: 10, marginTop: 8 }}>
        <Button label="Devam et" onPress={() => finish(false)} busy={busy === 'save'} />
        <Button label="Sonra" variant="secondary" onPress={() => finish(true)} busy={busy === 'skip'} />
      </View>
    </Screen>
  );
}
