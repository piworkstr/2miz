import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { dayKey, prettyDate } from '../lib/date';
import { cancelDate, confirmDate, nextDays, proposeDate, useUpcomingDates, type DatePlan } from '../lib/dates';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Button, Card, Display, Muted, T } from './ui';

export function DateCard() {
  const { user, couple, partnerName } = useSession();
  const t = useTheme();
  const dates = useUpcomingDates(couple?.id);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!user || !couple) return null;
  const uid = user.uid;
  const today = dayKey();
  const todayPlan = dates.find((d) => d.id === today);
  const later = dates.filter((d) => d.id !== today);

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {todayPlan?.status === 'confirmed' ? (
        <DateToday />
      ) : todayPlan && todayPlan.by !== uid ? (
        <Card accent style={{ borderColor: t.colors.primary }}>
          <T>{t.copy.date.partnerSaysToday(partnerName)}</T>
          <Button
            label={t.copy.date.confirmToday}
            busy={busy === 'today'}
            onPress={() => run('today', () => confirmDate(couple.id, today))}
          />
        </Card>
      ) : todayPlan ? (
        <Card>
          <Muted>{t.copy.date.waiting(partnerName)}</Muted>
          <Button label={t.copy.date.cancel} variant="secondary" onPress={() => cancelDate(couple.id, today)} />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button
            style={{ flex: 1 }}
            label={t.copy.date.weAreOnDate}
            busy={busy === 'instant'}
            onPress={() => run('instant', () => proposeDate(couple.id, today, uid, true))}
          />
          <Button style={{ flex: 1 }} label={t.copy.date.plan} variant="secondary" onPress={() => setPicking(!picking)} />
        </View>
      )}

      {picking && (
        <Card>
          <T style={{ fontWeight: '600' }}>{tx(t, t.copy.date.pickDay)}</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {nextDays()
              .slice(1)
              .map((d) => {
                const taken = dates.some((x) => x.id === d.key);
                return (
                  <Pressable
                    key={d.key}
                    disabled={taken}
                    onPress={() =>
                      run(d.key, async () => {
                        await proposeDate(couple.id, d.key, uid, false);
                        setPicking(false);
                      })
                    }
                    style={{
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: Math.min(t.radius.card, 14),
                      borderWidth: 1,
                      borderColor: t.colors.border,
                      backgroundColor: taken ? t.colors.primarySoft : t.colors.bg,
                      opacity: taken ? 0.5 : 1,
                    }}
                  >
                    <Muted style={{ fontSize: 12 }}>{d.weekday}</Muted>
                    <T style={{ fontWeight: '600' }}>{d.label}</T>
                  </Pressable>
                );
              })}
          </ScrollView>
        </Card>
      )}

      {later.length > 0 && (
        <Card style={{ gap: 10 }}>
          <T style={{ fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, t.copy.date.upcoming)}</T>
          {later.map((d) => (
            <UpcomingRow key={d.id} plan={d} uid={uid} busy={busy === d.id} onConfirm={() => run(d.id, () => confirmDate(couple.id, d.id))} onCancel={() => cancelDate(couple.id, d.id)} />
          ))}
        </Card>
      )}
    </>
  );
}

function UpcomingRow({ plan, uid, busy, onConfirm, onCancel }: { plan: DatePlan; uid: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  const t = useTheme();
  const { partnerName } = useSession();
  const day = prettyDate(plan.id);
  const needsMyOk = plan.status === 'proposed' && plan.by !== uid;

  return (
    <View style={{ gap: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons
          name={plan.status === 'confirmed' ? 'calendar' : 'calendar-outline'}
          size={20}
          color={plan.status === 'confirmed' ? t.colors.primary : t.colors.muted}
        />
        <T style={{ flex: 1 }}>{needsMyOk ? t.copy.date.partnerPlanned(partnerName, day) : day}</T>
        {!needsMyOk && (
          <Pressable onPress={onCancel} hitSlop={10}>
            <Ionicons name="close" size={18} color={t.colors.muted} />
          </Pressable>
        )}
      </View>
      {plan.status === 'proposed' && !needsMyOk && <Muted style={{ fontSize: 13 }}>{t.copy.date.waiting(partnerName)}</Muted>}
      {needsMyOk && <Button label={t.copy.date.confirm} onPress={onConfirm} busy={busy} />}
    </View>
  );
}

// Date günü kesinleştiğinde çıkan özel kart.
function DateToday() {
  const t = useTheme();
  return (
    <View
      style={{
        backgroundColor: t.colors.primary,
        borderRadius: t.radius.card,
        padding: 18,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={t.id === 'agir' ? 'flash' : 'heart'} size={22} color={t.colors.onPrimary} />
        <Text style={{ color: t.colors.onPrimary, fontFamily: t.fonts.button, fontWeight: t.fonts.button ? undefined : '600', letterSpacing: t.upper ? 1.5 : 0 }}>
          {tx(t, 'Date günü')}
        </Text>
      </View>
      <Display style={{ color: t.colors.onPrimary }}>{t.copy.date.today}</Display>
      <Text style={{ color: t.colors.onPrimary, fontFamily: t.fonts.body, fontSize: 14, lineHeight: 20, opacity: 0.9 }}>
        {t.copy.date.selfieHint}
      </Text>
      <View
        style={{
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: t.colors.onPrimary,
          borderRadius: Math.min(t.radius.card, 14),
          padding: 18,
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Ionicons name="people-outline" size={28} color={t.colors.onPrimary} />
        <Text style={{ color: t.colors.onPrimary, fontFamily: t.fonts.body, fontSize: 13, textAlign: 'center' }}>
          Ortak selfie çekimi selfie güncellemesiyle burada açılacak.
        </Text>
      </View>
    </View>
  );
}
