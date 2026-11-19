import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useL } from '../lib/i18n';
import { useTheme } from '../lib/useTheme';
import { setFarmRemind, useFarmRemind } from '../lib/farmRemind';
import { setRemind, useRemind } from './SpecialDays';
import { Tour, type TourId } from './Tour';
import { Card, Muted, T } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Profil'de: tanıtım kartlarını yeniden izleme ve özel gün hatırlatmalarını açıp kapatma.
export function GuideCard() {
  const t = useTheme();
  const l = useL();
  const remind = useRemind();
  const farmRemind = useFarmRemind();
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
      <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>{l('Rehber ve hatırlatmalar', 'Guide and reminders')}</T>
      {row('compass-outline', l('Uygulama turunu izle', 'Watch the app tour'), () => setTour('app'))}
      {row('leaf-outline', l('Çiftlik rehberi', 'Farm guide'), () => setTour('farm'))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}>
        <Ionicons name="notifications-outline" size={20} color={t.colors.primary} />
        <View style={{ flex: 1 }}>
          <T>{l('Özel gün hatırlatmaları', 'Special day reminders')}</T>
          <Muted style={{ fontSize: 12 }}>
            {l(
              'Yıl dönümü ve doğum günü: 3 gün önce, 1 gün önce ve günü 09:00',
              'Anniversary and birthday: 3 days, 1 day before and on the day at 09:00',
            )}
          </Muted>
        </View>
        <Switch value={remind} onValueChange={(v) => setRemind(v)} trackColor={{ true: t.colors.primary }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}>
        <Ionicons name="leaf-outline" size={20} color={t.colors.primary} />
        <View style={{ flex: 1 }}>
          <T>{l('Hasat hatırlatması', 'Harvest reminder')}</T>
          <Muted style={{ fontSize: 12 }}>
            {l('Ekinler olgunlaşınca ve üretim bitince birer bildirim', 'One notification when crops are ripe and when production is done')}
          </Muted>
        </View>
        <Switch value={farmRemind} onValueChange={(v) => setFarmRemind(v)} trackColor={{ true: t.colors.primary }} />
      </View>
      <Tour id={tour ?? 'app'} visible={!!tour} onClose={() => setTour(null)} />
    </Card>
  );
}
