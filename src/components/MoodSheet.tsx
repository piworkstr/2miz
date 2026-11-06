import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Modal, Pressable, Text, View } from 'react-native';
import { activeMood, MOODS, setMood, type MoodKey } from '../lib/avatar';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Avatar } from './Avatar';

// Kendi avatarına dokununca: ruh halini seç (partnerine görünür ve bildirim gider) ya da avatarını düzenle.
export function MoodSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
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
        <Pressable style={{ backgroundColor: t.colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar p={profile} name={profile?.name ?? ''} size={56} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: t.colors.text }}>Bugün nasılsın?</Text>
              <Text style={{ fontSize: 13, color: t.colors.muted }}>Partnerin görür; 24 saat sonra kendiliğinden kalkar.</Text>
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
                  <Text style={{ fontSize: 18 }}>{MOODS[k].emoji}</Text>
                  <Text style={{ fontSize: 14, color: t.colors.text }}>{MOODS[k].label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {current ? (
              <Pressable onPress={() => choose(null)} hitSlop={8}>
                <Text style={{ color: t.colors.muted }}>Ruh halini kaldır</Text>
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
              <Text style={{ color: t.colors.primary, fontWeight: '600' }}>{profile?.avatar ? 'Avatarımı düzenle' : 'Avatarımı oluştur'}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
