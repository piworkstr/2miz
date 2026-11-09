import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';
import { useEffect, type ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '../lib/session';
import { daysUntilYearly, nextMilestone } from '../lib/stats';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { daysTogether } from './CoupleInfoCard';
import { Card, Muted, T } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Special = { id: string; icon: IconName; color: string; title: string; today: string; days: number; remind?: (d: number) => string };

const WINDOW = 30; // ana sayfada kaç gün öncesinden görünsün

// Yaklaşan yıl dönümü, doğum günleri ve yuvarlak gün sayıları (1700. gün gibi).
function useSpecials(): Special[] {
  const { couple, profile, partnerProfile, partnerName } = useSession();
  const list: Special[] = [];
  if (couple?.startDate) {
    const a = daysUntilYearly(couple.startDate);
    if (a.years > 0) {
      list.push({
        id: 'anniversary',
        icon: 'heart-circle',
        color: '#E8516A',
        title: `${a.years}. yıl dönümünüz`,
        today: `Bugün ${a.years}. yıl dönümünüz! 🎉`,
        days: a.days,
        remind: (d) => (d === 0 ? `Bugün ${a.years}. yıl dönümünüz! 🎉` : `${a.years}. yıl dönümünüze ${d} gün kaldı 💝`),
      });
    }
    const together = daysTogether(couple.startDate);
    const ms = nextMilestone(together);
    list.push({
      id: 'milestone',
      icon: 'sparkles',
      color: '#8C6BC2',
      title: `Birlikteliğinizin ${ms.at}. günü`,
      today: `Bugün birlikteliğinizin ${ms.at}. günü! ✨`,
      days: ms.inDays,
    });
  }
  if (partnerProfile?.birthDate) {
    const b = daysUntilYearly(partnerProfile.birthDate);
    list.push({
      id: 'partner-birthday',
      icon: 'gift',
      color: '#E07A45',
      title: `${partnerName}'in doğum günü`,
      today: `Bugün ${partnerName}'in doğum günü! 🎂`,
      days: b.days,
      remind: (d) =>
        d === 0
          ? `Bugün ${partnerName}'in doğum günü! 🎂 Kutlamayı unutma.`
          : `${partnerName}'in doğum gününe ${d} gün kaldı 🎂 Hediye düşündün mü?`,
    });
  }
  if (profile?.birthDate) {
    const b = daysUntilYearly(profile.birthDate);
    list.push({
      id: 'my-birthday',
      icon: 'balloon',
      color: '#5B8DB8',
      title: 'Senin doğum günün',
      today: 'İyi ki doğdun! 🎈',
      days: b.days,
    });
  }
  return list.sort((x, y) => x.days - y.days);
}

// Yıl dönümü ve partnerin doğum günü için telefonun kendisi hatırlatır: 7 gün, 1 gün önce ve günün sabahı 09:00.
async function scheduleReminders(specials: Special[]) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const now = Date.now();
    for (const s of specials) {
      if (!s.remind) continue;
      for (const before of [7, 1, 0]) {
        const id = `special-${s.id}-${before}`;
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        const at = new Date();
        at.setHours(9, 0, 0, 0);
        at.setDate(at.getDate() + s.days - before);
        if (s.days < before || at.getTime() <= now) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: { title: '2miz', body: s.remind(before), data: { type: 'message', url: '/' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
      }
    }
  } catch {
    // Expo Go ya da izin yok
  }
}

export function SpecialDays() {
  const t = useTheme();
  const specials = useSpecials();
  const key = specials.map((s) => `${s.id}:${s.days}`).join(',');
  useEffect(() => {
    scheduleReminders(specials);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const todays = specials.filter((s) => s.days === 0);
  const soon = specials.filter((s) => s.days > 0 && s.days <= WINDOW);
  if (!todays.length && !soon.length) return null;

  return (
    <View style={{ gap: 10 }}>
      {todays.map((s) => (
        <View key={s.id} style={{ backgroundColor: s.color, borderRadius: t.radius.card, padding: 18, alignItems: 'center', gap: 6 }}>
          <Ionicons name={s.icon} size={34} color="#fff" />
          <Text
            maxFontSizeMultiplier={1.25}
            style={{ color: '#fff', fontSize: 20, fontWeight: '700', textAlign: 'center', fontFamily: t.fonts.button }}
          >
            {tx(t, s.today)}
          </Text>
        </View>
      ))}
      {soon.length > 0 && (
        <Card>
          <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Yaklaşan özel günler')}</T>
          {soon.map((s) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: s.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name={s.icon} size={18} color="#fff" />
              </View>
              <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontSize: 15, color: t.colors.text, fontFamily: t.fonts.body }}>
                {s.title}
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 20, fontWeight: '700', color: s.color }}>
                  {s.days}
                </Text>
                <Muted style={{ fontSize: 11 }}>{s.days === 1 ? 'yarın' : 'gün kaldı'}</Muted>
              </View>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}
