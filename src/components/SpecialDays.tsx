import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { enDate, trDate } from '../lib/date';
import { useL, useLang } from '../lib/i18n';
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
  const l = useL();
  const list: Special[] = [];
  if (couple?.startDate) {
    const a = daysUntilYearly(couple.startDate);
    if (a.years > 0) {
      list.push({
        id: 'anniversary',
        icon: 'heart-circle',
        color: '#E8516A',
        title: l(`${a.years}. yıl dönümünüz`, `Your ${ordinal(a.years)} anniversary`),
        today: l(`Bugün ${a.years}. yıl dönümünüz! 🎉`, `Happy ${ordinal(a.years)} anniversary! 🎉`),
        days: a.days,
        remind: (d) =>
          d === 0
            ? l(`Bugün ${a.years}. yıl dönümünüz! 🎉`, `Happy ${ordinal(a.years)} anniversary! 🎉`)
            : l(
                `${a.years}. yıl dönümünüze ${d} gün kaldı 💝`,
                `${d} ${d === 1 ? 'day' : 'days'} until your ${ordinal(a.years)} anniversary 💝`,
              ),
      });
    }
    const together = daysTogether(couple.startDate);
    const ms = nextMilestone(together);
    list.push({
      id: 'milestone',
      icon: 'sparkles',
      color: '#8C6BC2',
      title: l(`Birlikteliğinizin ${ms.at}. günü`, `Day ${ms.at} together`),
      today: l(`Bugün birlikteliğinizin ${ms.at}. günü! ✨`, `Today is day ${ms.at} together! ✨`),
      days: ms.inDays,
    });
  }
  if (partnerProfile?.birthDate) {
    const b = daysUntilYearly(partnerProfile.birthDate);
    list.push({
      id: 'partner-birthday',
      icon: 'gift',
      color: '#E07A45',
      title: l(`${partnerName}'in doğum günü`, `${partnerName}'s birthday`),
      today: l(`Bugün ${partnerName}'in doğum günü! 🎂`, `It's ${partnerName}'s birthday today! 🎂`),
      days: b.days,
      remind: (d) =>
        d === 0
          ? l(
              `Bugün ${partnerName}'in doğum günü! 🎂 Kutlamayı unutma.`,
              `It's ${partnerName}'s birthday today! 🎂 Don't forget to celebrate.`,
            )
          : l(
              `${partnerName}'in doğum gününe ${d} gün kaldı 🎂 Hediye düşündün mü?`,
              `${d} ${d === 1 ? 'day' : 'days'} until ${partnerName}'s birthday 🎂 Thought of a gift yet?`,
            ),
    });
  }
  if (profile?.birthDate) {
    const b = daysUntilYearly(profile.birthDate);
    list.push({
      id: 'my-birthday',
      icon: 'balloon',
      color: '#5B8DB8',
      title: l('Senin doğum günün', 'Your birthday'),
      today: l('İyi ki doğdun! 🎈', 'Happy birthday! 🎈'),
      days: b.days,
    });
  }
  return list.sort((x, y) => x.days - y.days);
}

// Hatırlatma tercihi telefonda tutulur (Profil'den açılıp kapatılır).
const REMIND_KEY = 'biriz.remind';
const OFFSETS = [3, 1, 0];
const OLD_OFFSETS = [7]; // eski sürümün kurduğu, artık kullanılmayan hatırlatma
let remindOn = true;
let remindLoaded = false;
const listeners = new Set<(on: boolean) => void>();

async function loadRemind(): Promise<boolean> {
  if (!remindLoaded) {
    remindOn = (await AsyncStorage.getItem(REMIND_KEY).catch(() => null)) !== 'off';
    remindLoaded = true;
  }
  return remindOn;
}

export async function setRemind(on: boolean) {
  remindOn = on;
  remindLoaded = true;
  await AsyncStorage.setItem(REMIND_KEY, on ? 'on' : 'off').catch(() => {});
  if (!on) {
    const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    await Promise.all(
      all
        .filter((n) => n.identifier.startsWith('special-'))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
    );
  }
  listeners.forEach((f) => f(on));
}

export function useRemind(): boolean {
  const [on, setOn] = useState(remindOn);
  useEffect(() => {
    loadRemind().then(setOn);
    listeners.add(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return on;
}

// Yıl dönümü ve partnerin doğum günü için telefonun kendisi hatırlatır: 3 gün, 1 gün önce ve günün sabahı 09:00.
async function scheduleReminders(specials: Special[]) {
  try {
    if (!(await loadRemind())) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const now = Date.now();
    for (const s of specials) {
      if (!s.remind) continue;
      for (const old of OLD_OFFSETS) await Notifications.cancelScheduledNotificationAsync(`special-${s.id}-${old}`).catch(() => {});
      for (const before of OFFSETS) {
        const id = `special-${s.id}-${before}`;
        await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
        const at = new Date();
        at.setHours(9, 0, 0, 0);
        at.setDate(at.getDate() + s.days - before);
        if (s.days < before || at.getTime() <= now) continue;
        await Notifications.scheduleNotificationAsync({
          identifier: id,
          content: { title: 'bir iz', body: s.remind(before), data: { type: 'message', url: '/' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
      }
    }
  } catch {
    // Expo Go ya da izin yok
  }
}

// 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st
function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

export function SpecialDays({ onPlanDate }: { onPlanDate?: () => void }) {
  const t = useTheme();
  const l = useL();
  const { lang } = useLang();
  const remind = useRemind();
  const specials = useSpecials();
  const key = specials.map((s) => `${s.id}:${s.days}`).join(',');
  useEffect(() => {
    scheduleReminders(specials);
  }, [key, remind]); // eslint-disable-line react-hooks/exhaustive-deps

  const todays = specials.filter((s) => s.days === 0);
  const upcoming = specials.filter((s) => s.days > 0 && s.days <= WINDOW);
  // En yakın yıl dönümü / partner doğum günü büyük geri sayım kartı olur; diğerleri altta liste.
  const hero = upcoming.find((s) => !!s.remind);
  const soon = upcoming.filter((s) => s !== hero);
  if (!todays.length && !upcoming.length) return null;

  const heroDate = () => {
    if (!hero) return '';
    const d = new Date();
    d.setDate(d.getDate() + hero.days);
    return lang === 'en' ? enDate(d, { weekday: 'long' }) : trDate(d, { weekday: 'long' });
  };
  const pill = (label: string, icon: IconName, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 42,
        borderRadius: 21,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.card,
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={16} color={t.colors.primary} />
      <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 14, fontWeight: '600', color: t.colors.primary, fontFamily: t.fonts.button }}>
        {tx(t, label)}
      </Text>
    </Pressable>
  );

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
      {hero && (
        <View style={{ gap: 8 }}>
          <View
            style={{
              backgroundColor: hero.color,
              borderRadius: t.radius.card,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <View
              style={{ width: 58, height: 62, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 26, fontWeight: '700', color: hero.color, lineHeight: 28 }}>
                {hero.days}
              </Text>
              <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 12, color: hero.color }}>
                {l('gün', hero.days === 1 ? 'day' : 'days')}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={1.2} style={{ color: '#fff', fontSize: 18, fontWeight: '700', fontFamily: t.fonts.button }}>
                {tx(t, hero.title)}
              </Text>
              <Text maxFontSizeMultiplier={1.2} style={{ color: '#fff', opacity: 0.9, fontSize: 14, marginTop: 2 }}>
                {heroDate()}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {pill(l('Kupon yaz', 'Write a coupon'), 'gift-outline', () => router.push(`/coupons?new=${Date.now()}`))}
            {onPlanDate && pill(l('Date planla', 'Plan a date'), 'calendar-outline', onPlanDate)}
          </View>
          <Muted style={{ fontSize: 12, textAlign: 'center' }}>
            {remind
              ? l(
                  'Hatırlatma: 3 gün önce, 1 gün önce ve günü saat 09:00. Profil’den kapatabilirsin.',
                  'Reminders: 3 days before, 1 day before and on the day at 09:00. Turn off in Profile.',
                )
              : l('Hatırlatmalar kapalı. Profil’den açabilirsin.', 'Reminders are off. Turn on in Profile.')}
          </Muted>
        </View>
      )}
      {soon.length > 0 && (
        <Card>
          <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, l('Yaklaşan özel günler', 'Coming up'))}</T>
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
                <Muted style={{ fontSize: 11 }}>{s.days === 1 ? l('yarın', 'tomorrow') : l('gün kaldı', 'days left')}</Muted>
              </View>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}
