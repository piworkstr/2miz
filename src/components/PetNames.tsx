import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PET_MAX, savePetNames } from '../lib/greeting';
import { useL } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

const IDEAS_EN = ['babe', 'baby', 'honey', 'sweetheart', 'love', 'darling', 'sweetie', 'angel', 'handsome', 'beautiful', 'cutie', 'my one'];
const IDEAS = [
  'aşkım',
  'bebeğim',
  'hayatım',
  'canım',
  'sevgilim',
  'tatlım',
  'balım',
  'prensesim',
  'kralım',
  'yakışıklım',
  'güzelim',
  'bir tanem',
];

// Birbirinize nasıl hitap ediyorsunuz? Senin yazdıkların partnerinin ana ekranındaki selamlamada çıkar.
export function PetNames() {
  const t = useTheme();
  const l = useL();
  const { user, profile, partnerProfile, partnerName } = useSession();
  const mine = profile?.petNames ?? [];
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  if (!user) return null;

  const save = (names: string[]) => savePetNames(user.uid, names).catch(() => {});
  const add = (n: string) => {
    const v = n.trim();
    if (!v || mine.includes(v) || mine.length >= PET_MAX) return;
    save([...mine, v]);
    setText('');
  };

  const chip = (label: string, onRemove?: () => void) => (
    <View
      key={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 7,
        paddingLeft: 12,
        paddingRight: onRemove ? 8 : 12,
        borderRadius: 18,
        backgroundColor: t.colors.primarySoft,
      }}
    >
      <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 14 }}>
        {label}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={l(`${label} hitabını kaldır`, `Remove ${label}`)}>
          <Ionicons name="close-circle" size={18} color={t.colors.muted} />
        </Pressable>
      )}
    </View>
  );

  // Kısa özet: kim kime nasıl hitap ediyor. Düzenle'ye basınca ekleme alanı açılır.
  if (!editing) {
    return (
      <Pressable onPress={() => setEditing(true)}>
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={t.colors.primary} />
            <T style={{ flex: 1, fontWeight: '600' }}>{l('Hitaplarınız', 'Pet names')}</T>
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600' }}>
              {mine.length ? l('Düzenle', 'Edit') : l('Ekle', 'Add')}
            </Text>
          </View>
          <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 14, color: t.colors.text }}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted }}>
              {l('Sen', 'You')} → {partnerName}:{' '}
            </Text>
            {mine.length ? mine.join(', ') : l('henüz yok', 'none yet')}
          </Text>
          <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 14, color: t.colors.text }}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted }}>
              {partnerName} → {l('sen', 'you')}:{' '}
            </Text>
            {partnerProfile?.petNames?.length ? partnerProfile.petNames.join(', ') : l('henüz yok', 'none yet')}
          </Text>
        </Card>
      </Pressable>
    );
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <T style={{ flex: 1, fontWeight: '600' }}>{l(`${partnerName}'e nasıl hitap edersin?`, `What do you call ${partnerName}?`)}</T>
        <Pressable onPress={() => setEditing(false)} hitSlop={10}>
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600' }}>
            {l('Bitti', 'Done')}
          </Text>
        </Pressable>
      </View>
      <Muted style={{ fontSize: 13 }}>
        {l(
          `Yazdıkların ${partnerName}'in ana ekranında "Günaydın aşkım" gibi selamlamada çıkar. En fazla ${PET_MAX} tane.`,
          `What you write shows up in ${partnerName}'s greeting on the home screen, like "Good morning, babe". Up to ${PET_MAX}.`,
        )}
      </Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {mine.map((n) => chip(n, () => save(mine.filter((x) => x !== n))))}
      </View>
      {mine.length < PET_MAX && (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={l('Örn. aşkım', 'e.g. babe')}
              placeholderTextColor={t.colors.muted}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={() => add(text)}
              style={{
                flex: 1,
                backgroundColor: t.colors.bg,
                borderWidth: 1,
                borderColor: t.colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 16,
                color: t.colors.text,
              }}
            />
            <Pressable
              onPress={() => add(text)}
              style={{ paddingHorizontal: 16, borderRadius: 12, backgroundColor: t.colors.primary, justifyContent: 'center' }}
            >
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.onPrimary, fontWeight: '600' }}>
                {l('Ekle', 'Add')}
              </Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(t.lang === 'en' ? IDEAS_EN : IDEAS)
              .filter((i) => !mine.includes(i))
              .slice(0, 8)
              .map((i) => (
                <Pressable
                  key={i}
                  onPress={() => add(i)}
                  style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: t.colors.border }}
                >
                  <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 13, color: t.colors.muted }}>
                    + {i}
                  </Text>
                </Pressable>
              ))}
          </View>
        </>
      )}
    </Card>
  );
}
