import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { PET_MAX, savePetNames } from '../lib/greeting';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

const IDEAS = ['aşkım', 'bebeğim', 'hayatım', 'canım', 'sevgilim', 'tatlım', 'balım', 'prensesim', 'kralım', 'yakışıklım', 'güzelim', 'bir tanem'];

// Birbirinize nasıl hitap ediyorsunuz? Senin yazdıkların partnerinin ana ekranındaki selamlamada çıkar.
export function PetNames() {
  const t = useTheme();
  const { user, profile, partnerProfile, partnerName } = useSession();
  const mine = profile?.petNames ?? [];
  const [text, setText] = useState('');
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
      <Text style={{ color: t.colors.text, fontSize: 14 }}>{label}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`${label} hitabını kaldır`}>
          <Ionicons name="close-circle" size={18} color={t.colors.muted} />
        </Pressable>
      )}
    </View>
  );

  return (
    <Card>
      <T style={{ fontWeight: '600' }}>{partnerName}'e nasıl hitap edersin?</T>
      <Muted style={{ fontSize: 13 }}>
        Yazdıkların {partnerName}'in ana ekranında "Günaydın aşkım" gibi selamlamada çıkar. En fazla {PET_MAX} tane.
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
              placeholder="Örn. aşkım"
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
              <Text style={{ color: t.colors.onPrimary, fontWeight: '600' }}>Ekle</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {IDEAS.filter((i) => !mine.includes(i))
              .slice(0, 8)
              .map((i) => (
                <Pressable key={i} onPress={() => add(i)} style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: t.colors.border }}>
                  <Text style={{ fontSize: 13, color: t.colors.muted }}>+ {i}</Text>
                </Pressable>
              ))}
          </View>
        </>
      )}
      <View style={{ gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.colors.border }}>
        <Muted style={{ fontSize: 13 }}>{partnerName} sana nasıl hitap ediyor:</Muted>
        {partnerProfile?.petNames?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{partnerProfile.petNames.map((n) => chip(n))}</View>
        ) : (
          <Muted style={{ fontSize: 13, fontStyle: 'italic' }}>Henüz eklemedi.</Muted>
        )}
      </View>
    </Card>
  );
}
