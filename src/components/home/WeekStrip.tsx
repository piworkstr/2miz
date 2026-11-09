import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMonthEvents, type CalEvent } from '../../lib/calendar';
import { useUpcomingDates } from '../../lib/dates';
import { dayKey } from '../../lib/date';
import { useSession } from '../../lib/session';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';
import { SharedCalendar } from '../SharedCalendar';
import { Card, T } from '../ui';

// Ana ekranda bu hafta: 7 gün, noktalar (planlar, date), en yakın plan. "Takvimi aç" tam ayı altına açar.
const ME = '#5B8DB8';
const BOTH = '#8C6BC2';
const DATE = '#E8516A';
const WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function WeekStrip() {
  const t = useTheme();
  const { user, couple, partnerName } = useSession();
  const [open, setOpen] = useState(false);
  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
  const last = days[6];
  const ev1 = useMonthEvents(couple?.id, monday.getFullYear(), monday.getMonth());
  const ev2 = useMonthEvents(last.getMonth() !== monday.getMonth() ? couple?.id : undefined, last.getFullYear(), last.getMonth());
  const events: CalEvent[] = [...ev1, ...ev2];
  const dates = useUpcomingDates(couple?.id);
  if (!user || !couple) return null;
  const uid = user.uid;
  const today = dayKey();

  const dotsFor = (k: string) => {
    const out: string[] = [];
    for (const e of events) {
      const c = e.owner === 'both' ? BOTH : e.owner === uid ? ME : t.colors.primary;
      if (e.day === k && !out.includes(c)) out.push(c);
    }
    if (dates.some((d) => d.id === k)) out.push(DATE);
    return out.slice(0, 3);
  };
  // En yakın plan: date ya da bu haftaki ilk etkinlik
  const upcomingDate = dates.find((d) => d.id >= today);
  const nextEvent = events.filter((e) => e.day >= today).sort((a, b) => a.day.localeCompare(b.day))[0];
  const daysTo = (k: string) => Math.round((new Date(k).getTime() - new Date(today).getTime()) / 86400000);
  const dayName = (k: string) => WEEK[(new Date(k).getDay() + 6) % 7];
  const next = upcomingDate
    ? {
        icon: '🍷',
        text: upcomingDate.status === 'confirmed' ? `${dayName(upcomingDate.id)} · Date` : `${dayName(upcomingDate.id)} · Date önerisi`,
        when: daysTo(upcomingDate.id),
      }
    : nextEvent
      ? {
          icon: nextEvent.owner === 'both' ? '📌' : nextEvent.owner === uid ? '🙂' : '💛',
          text: `${dayName(nextEvent.day)} · ${nextEvent.title}`,
          when: daysTo(nextEvent.day),
        }
      : null;

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Bu hafta')}</T>
          <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 12, color: t.colors.primary, fontWeight: '700' }}>
              {open ? 'Haftayı göster' : 'Takvimi aç'}
            </Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-forward'} size={14} color={t.colors.primary} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {days.map((d, i) => {
            const k = key(d);
            const isToday = k === today;
            const dots = dotsFor(k);
            return (
              <View key={k} style={{ alignItems: 'center', width: 40 }}>
                <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 11, color: t.colors.muted, fontFamily: t.fonts.body }}>
                  {WEEK[i]}
                </Text>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    marginTop: 4,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isToday ? t.colors.primary : 'transparent',
                    shadowColor: t.colors.primary,
                    shadowOpacity: isToday ? 0.4 : 0,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 4 },
                  }}
                >
                  <Text
                    maxFontSizeMultiplier={1.25}
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: isToday ? t.colors.onPrimary : k < today ? t.colors.muted : t.colors.text,
                    }}
                  >
                    {d.getDate()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 2, height: 6, marginTop: 3 }}>
                  {dots.map((c, j) => (
                    <View key={j} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
        {next && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: t.colors.primarySoft,
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 14 }}>
              {next.icon}
            </Text>
            <Text maxFontSizeMultiplier={1.25} numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: t.colors.text }}>
              {next.text}
            </Text>
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 12, color: t.colors.muted }}>
              {next.when === 0 ? 'bugün' : next.when === 1 ? 'yarın' : `${next.when} gün kaldı`}
            </Text>
          </View>
        )}
        {!next && (
          <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 12, color: t.colors.muted, fontFamily: t.fonts.body }}>
            Bu hafta plan yok. Takvimi açıp bir şey ekleyin; {partnerName} da görür.
          </Text>
        )}
      </Card>
      {open && <SharedCalendar />}
    </View>
  );
}
