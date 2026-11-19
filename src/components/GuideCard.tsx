import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps } from 'react';
import { Pressable } from 'react-native';
import { useL } from '../lib/i18n';
import { useTheme } from '../lib/useTheme';
import { Tour, type TourId } from './Tour';
import { Card, T } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Profil'de: tanıtım kartlarını yeniden izleme. (Hatırlatma anahtarları Bildirimler kartına taşındı.)
export function GuideCard() {
  const t = useTheme();
  const l = useL();
  const [tour, setTour] = useState<TourId | null>(null);
  const row = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
      <Ionicons name={icon} size={20} color={t.colors.primary} />
      <T style={{ flex: 1 }}>{label}</T>
      <Ionicons name="chevron-forward" size={18} color={t.colors.muted} />
    </Pressable>
  );
  return (
    <Card style={{ gap: 6 }}>
      <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>{l('Rehber', 'Guide')}</T>
      {row('compass-outline', l('Uygulama turunu izle', 'Watch the app tour'), () => setTour('app'))}
      {row('leaf-outline', l('Çiftlik rehberi', 'Farm guide'), () => setTour('farm'))}
      <Tour id={tour ?? 'app'} visible={!!tour} onClose={() => setTour(null)} />
    </Card>
  );
}
