import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';
import { activeMood, MOODS, moodLabel, setMood, type MoodKey } from '../lib/avatar';
import { useL, useLang } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Avatar } from './Avatar';

// Kendi avatarına dokununca: ruh halini seç (partnerine görünür ve bildirim gider) ya da avatarını düzenle.
export function MoodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const l = useL();
  const { lang } = useLang();
  const { user, couple, profile, partnerId } = useSession();
  const current = activeMood(profile?.mood);

  function choose(k: MoodKey | null) {
    if (!user) return;
    setMood(couple?.id, user.uid, k, { to: partnerId, fromName: profile?.name ?? 'Partnerin' }).catch(() => {});
    onClose();
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable
          style={{
            backgroundColor: t.colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: 36,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar p={profile} name={profile?.name ?? ''} size={56} />
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 18, fontWeight: '700', color: t.colors.text }}>
                {l('Bugün nasılsın?', 'How are you today?')}
              </Text>
              <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 13, color: t.colors.muted }}>
                {l('Partnerin görür; 24 saat sonra kendiliğinden kalkar.', 'Your partner sees it; it clears itself after 24 hours.')}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(Object.keys(MOODS) as MoodKey[]).map((k) => {
              const on = current === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => choose(k)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 9,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: on ? t.colors.primary : t.colors.border,
                    backgroundColor: on ? t.colors.primarySoft : t.colors.bg,
                  }}
                >
                  <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 18 }}>
                    {MOODS[k].emoji}
                  </Text>
                  <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 14, color: t.colors.text }}>
                    {moodLabel(k, lang)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {current ? (
              <Pressable onPress={() => choose(null)} hitSlop={8}>
                <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted }}>
                  {l('Ruh halini kaldır', 'Clear mood')}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
            <Pressable
              onPress={() => {
                onClose();
                router.push('/avatar');
              }}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Ionicons name="color-palette-outline" size={16} color={t.colors.primary} />
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600' }}>
                {profile?.avatar ? l('Avatarımı düzenle', 'Edit my avatar') : l('Avatarımı oluştur', 'Create my avatar')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
