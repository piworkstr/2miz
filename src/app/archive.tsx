import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Loading, Muted, Screen, Title } from '../components/ui';
import { toggleFavorite, useDays } from '../lib/archive';
import { modeOf, type DayDoc } from '../lib/daily';
import { dayKey, prettyDate } from '../lib/date';
import { useSession } from '../lib/session';
import { categoryLabels, categoryStyle, taskById, TASKS } from '../lib/tasks';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Filter = 'all' | 'fav' | 'missed';

// Görev arşivi: geçmiş günlerin görevleri, kim yaptı, favoriler.
export default function Archive() {
  const t = useTheme();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const days = useDays(couple?.id);
  const [filter, setFilter] = useState<Filter>('all');

  if (!user || !couple || !partnerId || days === null) return <Loading />;
  const uid = user.uid;
  const favorites = couple.favorites ?? [];
  const today = dayKey();
  const bothDone = (d: DayDoc) => couple.members.every((m) => d.completions?.[m]);
  const list = filter === 'missed' ? days.filter((d) => d.key < today && !bothDone(d.day)) : days;
  const done = days.filter((d) => bothDone(d.day)).length;

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tüm günler' },
    { key: 'fav', label: `Favoriler (${favorites.length})` },
    { key: 'missed', label: 'Yapılmayanlar' },
  ];

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15, fontFamily: t.fonts.body }}>
          {tx(t, 'Bugün')}
        </Text>
      </Pressable>
      <Title>Görev arşivi</Title>
      <Muted>
        {days.length} gün · {done} gün ikiniz de tamamladınız. Kalbe dokunduğunuz görevler bonus çarkında "Favorilerimiz" olarak çıkar.
      </Muted>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {chips.map((c) => {
          const on = filter === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setFilter(c.key)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: on ? t.colors.primary : t.colors.border,
                backgroundColor: on ? t.colors.primary : t.colors.card,
              }}
            >
              <Text
                maxFontSizeMultiplier={1.25}
                style={{ color: on ? t.colors.onPrimary : t.colors.text, fontWeight: '600', fontFamily: t.fonts.button }}
              >
                {tx(t, c.label)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {filter === 'fav' ? (
        favorites.length === 0 ? (
          <Muted style={{ textAlign: 'center', paddingVertical: 24 }}>
            Henüz favori yok. Sevdiğiniz görevlerin yanındaki kalbe dokunun.
          </Muted>
        ) : (
          TASKS.filter((x) => favorites.includes(x.id)).map((task) => (
            <Card key={task.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <CategoryDot id={task.id} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 16, color: t.colors.text, fontFamily: t.fonts.body }}>
                  {task.title}
                </Text>
                <Muted style={{ fontSize: 12 }}>{tx(t, categoryLabels[task.category])}</Muted>
              </View>
              <Heart coupleId={couple.id} id={task.id} on />
            </Card>
          ))
        )
      ) : list.length === 0 ? (
        <Muted style={{ textAlign: 'center', paddingVertical: 24 }}>
          {filter === 'missed' ? 'Kaçırılan görev yok, harikasınız!' : 'Görev geçmişiniz burada birikecek.'}
        </Muted>
      ) : (
        list.map(({ key, day }) => {
          const mode = modeOf(day, couple.members);
          const rows =
            mode === 'separate'
              ? [
                  { who: profile?.name ?? 'Sen', id: day.separate[uid], done: !!day.completions?.[uid] },
                  { who: partnerName, id: day.separate[partnerId], done: !!day.completions?.[partnerId] },
                ]
              : [{ who: null, id: day.sharedTaskId, done: bothDone(day) }];
          return (
            <Card key={key} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '600', color: t.colors.text, fontFamily: t.fonts.button }}>
                  {key === today ? tx(t, 'Bugün') : prettyDate(key)}
                </Text>
                <Status
                  me={!!day.completions?.[uid]}
                  them={!!day.completions?.[partnerId]}
                  myName={profile?.name ?? 'Sen'}
                  partnerName={partnerName}
                />
              </View>
              {rows.map((r) =>
                r.id ? (
                  <View key={`${r.who}-${r.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <CategoryDot id={r.id} />
                    <View style={{ flex: 1 }}>
                      {r.who && <Muted style={{ fontSize: 11 }}>{r.who}</Muted>}
                      <Text
                        maxFontSizeMultiplier={1.25}
                        style={{
                          fontSize: 15,
                          color: t.colors.text,
                          fontFamily: t.fonts.body,
                          opacity: r.done || key === today ? 1 : 0.6,
                        }}
                      >
                        {taskById(r.id).title}
                      </Text>
                    </View>
                    <Heart coupleId={couple.id} id={r.id} on={favorites.includes(r.id)} />
                  </View>
                ) : null,
              )}
              {day.bonus && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingTop: 8,
                    borderTopWidth: 1,
                    borderTopColor: t.colors.border,
                  }}
                >
                  <Ionicons name="color-wand-outline" size={16} color={t.colors.primary} />
                  <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontSize: 14, color: t.colors.text, fontFamily: t.fonts.body }}>
                    {tx(t, t.copy.surpriseLabel)}: {taskById(day.bonus.taskId).title}
                  </Text>
                  <Heart coupleId={couple.id} id={day.bonus.taskId} on={favorites.includes(day.bonus.taskId)} />
                </View>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

function CategoryDot({ id }: { id: string }) {
  const s = categoryStyle[taskById(id).category];
  return (
    <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: s.color, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={s.icon as IconName} size={15} color="#fff" />
    </View>
  );
}

function Heart({ coupleId, id, on }: { coupleId: string; id: string; on: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => toggleFavorite(coupleId, id, !on).catch(() => {})} hitSlop={10} accessibilityLabel="Favori">
      <Ionicons name={on ? 'heart' : 'heart-outline'} size={22} color={t.colors.primary} />
    </Pressable>
  );
}

function Status({ me, them, myName, partnerName }: { me: boolean; them: boolean; myName: string; partnerName: string }) {
  const t = useTheme();
  const item = (name: string, ok: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={ok ? '#4FA37E' : t.colors.muted} />
      <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 12, color: t.colors.muted }}>
        {name}
      </Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {item(myName, me)}
      {item(partnerName, them)}
    </View>
  );
}
