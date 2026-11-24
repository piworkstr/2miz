import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, ErrorText, Muted, Screen, Title } from '../components/ui';
import { db } from '../lib/firebase';
import { GENDER_OPTIONS, type Gender } from '../lib/gender';
import { useL } from '../lib/i18n';
import { INTERESTS, interestLabel } from '../lib/interests';
import { useSession, type Profile } from '../lib/session';
import { useTheme } from '../lib/useTheme';

const TIMES: { id: NonNullable<Profile['notifyTime']>; label: string; en: string; hint: string }[] = [
  { id: 'sabah', label: 'Sabah', en: 'Morning', hint: '09:00' },
  { id: 'ogle', label: 'Öğle', en: 'Noon', hint: '13:00' },
  { id: 'aksam', label: 'Akşam', en: 'Evening', hint: '19:00' },
];

export default function Setup() {
  const t = useTheme();
  const l = useL();
  const { user } = useSession();
  const [interests, setInterests] = useState<string[]>([]);
  const [gender, setGender] = useState<Gender | ''>('');
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
      await updateDoc(
        doc(db, 'users', user.uid),
        skip ? { onboarded: true } : { interests, notifyTime: time, onboarded: true, ...(gender ? { gender } : {}) },
      );
    } catch {
      setError(l('Kaydedilemedi, tekrar dene.', "Couldn't save, please try again."));
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
      <Title>{l('Biraz daha tanışalım', "Let's get to know you a bit more")}</Title>
      <Muted>
        {l(
          'Görevleri ve ileride date önerilerini sana göre seçmek için. İstersen sonra doldurabilirsin.',
          'So we can pick tasks and, later on, date ideas for you. You can fill this in later if you like.',
        )}
      </Muted>

      <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 17, fontWeight: '600', color: t.colors.text, marginTop: 8 }}>
        {l('Nelerden hoşlanırsın?', 'What do you enjoy?')}
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
                {interestLabel(i, t.lang)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 17, fontWeight: '600', color: t.colors.text, marginTop: 8 }}>
        {l('Cinsiyetin (isteğe bağlı)', 'Your gender (optional)')}
      </Text>
      <Muted>
        {l(
          'Yalnızca önerileri sana göre sıralamak için. Partnerinle eşleşmeni etkilemez.',
          "Only used to sort suggestions for you. It doesn't affect pairing with your partner.",
        )}
      </Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {GENDER_OPTIONS.map((o) => {
          const on = gender === o.id;
          return (
            <Pressable key={o.id || 'yok'} onPress={() => setGender(o.id)} style={chip(on)}>
              <Text
                maxFontSizeMultiplier={1.25}
                style={{ color: on ? t.colors.primary : t.colors.text, fontFamily: t.fonts.body, fontSize: 15 }}
              >
                {l(o.label, o.en)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 17, fontWeight: '600', color: t.colors.text, marginTop: 8 }}>
        {l('Günün görevi ne zaman gelsin?', "When should today's task arrive?")}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {TIMES.map((o) => {
          const on = time === o.id;
          return (
            <Pressable key={o.id} onPress={() => setTime(o.id)} style={[chip(on), { flex: 1, alignItems: 'center' }]}>
              <Text maxFontSizeMultiplier={1.25} style={{ color: on ? t.colors.primary : t.colors.text, fontWeight: '600', fontSize: 15 }}>
                {l(o.label, o.en)}
              </Text>
              <Muted style={{ fontSize: 12 }}>{o.hint}</Muted>
            </Pressable>
          );
        })}
      </View>

      <ErrorText>{error}</ErrorText>
      <View style={{ gap: 10, marginTop: 8 }}>
        <Button label={l('Devam et', 'Continue')} onPress={() => finish(false)} busy={busy === 'save'} />
        <Button label={l('Sonra', 'Later')} variant="secondary" onPress={() => finish(true)} busy={busy === 'skip'} />
      </View>
    </Screen>
  );
}
