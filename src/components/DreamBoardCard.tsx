import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { dateLabel, dreamUri, useDreams } from '../lib/board';
import { useL } from '../lib/i18n';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Card, Muted } from './ui';

// Ana ekranda Hayal panomuz: kaç hayal var, sıradaki hangisi. Dokununca pano açılır.
export function DreamBoardCard() {
  const t = useTheme();
  const l = useL();
  const { user, couple } = useSession();
  const dreams = useDreams(couple?.id);
  if (!user || !couple) return null;
  const all = dreams ?? [];
  const open = all.filter((d) => !d.done);
  const done = all.length - open.length;
  // Sıradaki: hedef tarihi en yakın olan bekleyen hayal (tarihsizler sona).
  const next = [...open].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'))[0];
  const hasNote = !!couple.dreamNote?.trim();
  const line = next
    ? `${l('Sıradaki', 'Next')}: ${next.title}${next.date ? ` · ${dateLabel(next.date)}` : ''}`
    : all.length
      ? l('Hepsi gerçekleşti. Yeni bir hayal ekleyin.', 'All done. Add a new dream.')
      : hasNote
        ? l('Hayaliniz panoya taşındı; dokunup yenilerini ekleyin.', 'Your dream moved to the board; tap to add more.')
        : l('Birlikte gerçekleştirmek istediklerinizi ekleyin.', 'Add the things you want to make happen together.');
  const pics = all.filter((d) => d.photo || d.donePhoto).slice(0, 3);
  return (
    <Pressable onPress={() => router.push('/dreams')} accessibilityLabel={l('Hayal panomuz', 'Our dream board')}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <View
          style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FDE7EA', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="sparkles" size={22} color={t.colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '700', fontSize: 16, color: t.colors.text }}>
              {l('Hayal panomuz', 'Our dream board')}
            </Text>
            {all.length > 0 && (
              <Muted style={{ fontSize: 12 }}>
                {done} / {all.length}
              </Muted>
            )}
          </View>
          <Muted style={{ fontSize: 13, lineHeight: 17 }}>{line}</Muted>
        </View>
        {pics.length > 0 && (
          <View style={{ flexDirection: 'row' }}>
            {pics.map((d, k) => (
              <Image
                key={d.id}
                source={{ uri: dreamUri((d.done ? d.donePhoto : undefined) ?? d.photo ?? d.donePhoto!) }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  marginLeft: k ? -10 : 0,
                  borderWidth: 2,
                  borderColor: t.colors.card,
                }}
              />
            ))}
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={t.colors.muted} />
      </Card>
    </Pressable>
  );
}
