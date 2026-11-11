import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  addEvent,
  deleteEvent,
  stopCalendarShare,
  syncPhoneCalendar,
  useBusy,
  useMonthDocs,
  useMonthEvents,
  type Busy,
  type CalEvent,
} from '../lib/calendar';
import type { DayDoc } from '../lib/daily';
import type { DatePlan } from '../lib/dates';
import { dayKey, trDate } from '../lib/date';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

const ME = '#5B8DB8';
const BOTH = '#8C6BC2';
const SPECIAL = '#E0A43A';
const WEEK = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Ortak aylık takvim: herkesin planları, ortak planlar, date'ler, özel günler ve
// birlikte tamamlanan görev günleri. Bir güne dokununca o günün listesi açılır.
export function SharedCalendar() {
  const t = useTheme();
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const events = useMonthEvents(couple?.id, ym.y, ym.m);
  const dates = useMonthDocs<DatePlan>(couple?.id, 'dates', ym.y, ym.m);
  const days = useMonthDocs<DayDoc>(couple?.id, 'days', ym.y, ym.m);
  const myBusy = useBusy(couple?.id, user?.uid);
  const theirBusy = useBusy(couple?.id, partnerId);

  // Paylaşım açıksa takvimi 6 saatte bir sessizce tazele.
  useEffect(() => {
    if (!couple || !user || !profile?.calendarShare) return;
    if (myBusy && Date.now() - myBusy.syncedAtMs < 6 * 3600_000) return;
    syncPhoneCalendar(couple.id, user.uid, profile.calendarShare).catch(() => {});
  }, [couple?.id, user?.uid, profile?.calendarShare, myBusy?.syncedAtMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const specials = useMemo(() => {
    const out: Record<string, { icon: string; text: string }[]> = {};
    const add = (k: string, icon: string, text: string) => (out[k] = [...(out[k] ?? []), { icon, text }]);
    const mmdd = (s?: string) => s?.slice(5);
    for (let d = 1; d <= 31; d++) {
      const k = key(ym.y, ym.m, d);
      if (couple?.startDate && mmdd(couple.startDate) === k.slice(5) && k > couple.startDate)
        add(k, '💝', `${ym.y - Number(couple.startDate.slice(0, 4))}. yıl dönümünüz`);
      if (partnerProfile?.birthDate && mmdd(partnerProfile.birthDate) === k.slice(5)) add(k, '🎂', `${partnerName}'in doğum günü`);
      if (profile?.birthDate && mmdd(profile.birthDate) === k.slice(5)) add(k, '🎈', 'Senin doğum günün');
      if (couple?.startDate) {
        const [sy, sm, sd] = couple.startDate.split('-').map(Number);
        const n = Math.round((new Date(ym.y, ym.m, d).getTime() - new Date(sy, sm - 1, sd).getTime()) / 86400000) + 1;
        if (n > 0 && n % 100 === 0) add(k, '✨', `Birlikteliğinizin ${n}. günü`);
      }
    }
    return out;
  }, [ym.y, ym.m, couple?.startDate, profile?.birthDate, partnerProfile?.birthDate, partnerName]);

  if (!user || !couple || !partnerId) return null;
  const uid = user.uid;
  const today = dayKey();
  const first = new Date(ym.y, ym.m, 1);
  const lead = (first.getDay() + 6) % 7; // pazartesi başlangıç
  const count = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  const colorOf = (owner: string) => (owner === 'both' ? BOTH : owner === uid ? ME : t.colors.primary);
  const dotsFor = (k: string) => {
    const dots: string[] = [];
    for (const e of events) if (e.day === k && !dots.includes(colorOf(e.owner))) dots.push(colorOf(e.owner));
    if (myBusy?.items.some((b) => b.day === k) && !dots.includes(ME)) dots.push(ME);
    if (theirBusy?.items.some((b) => b.day === k) && !dots.includes(t.colors.primary)) dots.push(t.colors.primary);
    if (dates[k] && !dots.includes(BOTH)) dots.push(BOTH);
    if (specials[k]) dots.push(SPECIAL);
    return dots.slice(0, 4);
  };
  const move = (d: number) => setYm(({ y, m }) => (m + d < 0 ? { y: y - 1, m: 11 } : m + d > 11 ? { y: y + 1, m: 0 } : { y, m: m + d }));

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Ortak takviminiz')}</T>
        <Pressable onPress={() => setShareOpen(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name={profile?.calendarShare ? 'sync' : 'phone-portrait-outline'} size={16} color={t.colors.primary} />
          <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 12, color: t.colors.primary, fontWeight: '600' }}>
            Telefon takvimi
          </Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable onPress={() => move(-1)} hitSlop={10} accessibilityLabel="Önceki ay">
          <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        </Pressable>
        <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 16, fontWeight: '700', color: t.colors.text }}>
          {MONTHS[ym.m]} {ym.y}
        </Text>
        <Pressable onPress={() => move(1)} hitSlop={10} accessibilityLabel="Sonraki ay">
          <Ionicons name="chevron-forward" size={22} color={t.colors.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row' }}>
        {WEEK.map((w) => (
          <Text maxFontSizeMultiplier={1.25} key={w} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: t.colors.muted }}>
            {w}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={{ width: `${100 / 7}%`, height: 46 }} />;
          const k = key(ym.y, ym.m, d);
          const isToday = k === today;
          const day = days[k];
          const bothDone = !!day && couple.members.every((m) => day.completions?.[m]);
          return (
            <Pressable
              key={i}
              onPress={() => setSelected(k)}
              style={{ width: `${100 / 7}%`, height: 46, alignItems: 'center', paddingTop: 4 }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isToday ? t.colors.primary : 'transparent',
                }}
              >
                <Text
                  maxFontSizeMultiplier={1.25}
                  style={{
                    fontSize: 14,
                    fontWeight: isToday ? '700' : '400',
                    color: isToday ? t.colors.onPrimary : k < today ? t.colors.muted : t.colors.text,
                  }}
                >
                  {d}
                </Text>
              </View>
              {bothDone && <Ionicons name="heart" size={8} color={t.colors.primary} style={{ position: 'absolute', top: 2, right: 6 }} />}
              <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
                {dotsFor(k).map((c, j) => (
                  <View key={j} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c }} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[
          [ME, 'Sen'],
          [t.colors.primary, partnerName],
          [BOTH, 'Birlikte / date'],
          [SPECIAL, 'Özel gün'],
        ].map(([c, l]) => (
          <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c }} />
            <Muted style={{ fontSize: 11 }}>{l}</Muted>
          </View>
        ))}
      </View>

      <DaySheet
        k={selected}
        onClose={() => setSelected(null)}
        events={events.filter((e) => e.day === selected)}
        date={selected ? dates[selected] : undefined}
        day={selected ? days[selected] : undefined}
        specials={selected ? (specials[selected] ?? []) : []}
        myBusy={myBusy}
        theirBusy={theirBusy}
        colorOf={colorOf}
      />
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} />
    </Card>
  );
}

function DaySheet({
  k,
  onClose,
  events,
  date,
  day,
  specials,
  myBusy,
  theirBusy,
  colorOf,
}: {
  k: string | null;
  onClose: () => void;
  events: CalEvent[];
  date?: DatePlan;
  day?: DayDoc;
  specials: { icon: string; text: string }[];
  myBusy: Busy | null;
  theirBusy: Busy | null;
  colorOf: (owner: string) => string;
}) {
  const t = useTheme();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [owner, setOwner] = useState<'me' | 'partner' | 'both'>('both');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user || !couple || !partnerId) return null;
  const uid = user.uid;

  const label = k
    ? (() => {
        const [y, m, d] = k.split('-').map(Number);
        return trDate(new Date(y, m - 1, d), { weekday: 'long' });
      })()
    : '';
  const bothDone = !!day && couple.members.every((m) => day.completions?.[m]);
  const busyLines = [
    ...(myBusy?.items.filter((b) => b.day === k).map((b) => ({ who: 'Sen', color: ME, b })) ?? []),
    ...(theirBusy?.items.filter((b) => b.day === k).map((b) => ({ who: partnerName, color: t.colors.primary, b })) ?? []),
  ];

  function onTime(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    setTime(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
  }

  async function save() {
    if (!k || !couple || busy) return;
    setError('');
    if (!title.trim()) return setError('Ne yapacaksınız? Bir başlık yaz.');
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setError('Saati 20:30 gibi yaz ya da boş bırak.');
    setBusy(true);
    try {
      await addEvent(
        couple.id,
        { day: k, title, ...(time ? { time } : {}), owner: owner === 'both' ? 'both' : owner === 'me' ? uid : partnerId!, by: uid },
        { to: partnerId, fromName: profile?.name ?? 'Partnerin' },
      );
      setTitle('');
      setTime('');
    } catch {
      setError('Kaydedilemedi, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  const line = (key: string, color: string, left: string, text: string, onLong?: () => void) => (
    <Pressable
      key={key}
      onLongPress={onLong}
      delayLongPress={400}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
    >
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: color }} />
      <Text maxFontSizeMultiplier={1.25} style={{ width: 48, fontSize: 13, color: t.colors.muted }}>
        {left}
      </Text>
      <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontSize: 15, color: t.colors.text }}>
        {text}
      </Text>
    </Pressable>
  );

  const empty = !events.length && !busyLines.length && !specials.length && !date && !bothDone;

  return (
    <Modal visible={!!k} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: t.colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 6 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontSize: 19, fontWeight: '700', color: t.colors.text }}>
                  {label}
                </Text>
                <Pressable onPress={onClose} hitSlop={10}>
                  <Ionicons name="close" size={24} color={t.colors.muted} />
                </Pressable>
              </View>

              {specials.map((s) => line(s.text, SPECIAL, s.icon, s.text))}
              {date && line('date', BOTH, '💑', date.status === 'confirmed' ? 'Date günü' : 'Date önerildi, onay bekliyor')}
              {bothDone && line('task', t.colors.primary, '❤️', 'Günün görevini birlikte tamamladınız')}
              {events.map((e) =>
                line(
                  e.id,
                  colorOf(e.owner),
                  e.time ?? 'gün',
                  `${e.title} · ${e.owner === 'both' ? 'Birlikte' : e.owner === uid ? 'Sen' : partnerName}`,
                  e.by === uid || e.owner === 'both' || e.owner === uid ? () => deleteEvent(couple.id, e.id).catch(() => {}) : undefined,
                ),
              )}
              {busyLines.map(({ who, color, b }, i) =>
                line(
                  `b${i}`,
                  color,
                  b.allDay ? 'gün' : (b.start ?? ''),
                  `${b.title ?? 'Meşgul'}${b.end && !b.allDay ? ` (–${b.end})` : ''} · ${who}`,
                ),
              )}
              {empty && <Muted style={{ paddingVertical: 8 }}>Bu gün boş. Birlikte bir şey planlayın!</Muted>}
              {!!events.length && <Muted style={{ fontSize: 11 }}>Silmek için plana uzun bas.</Muted>}

              <View style={{ gap: 10, marginTop: 10, paddingTop: 14, borderTopWidth: 1, borderTopColor: t.colors.border }}>
                <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 15, fontWeight: '600', color: t.colors.text }}>
                  Plan ekle
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(
                    [
                      ['both', 'Birlikte', BOTH],
                      ['me', 'Ben', ME],
                      ['partner', partnerName, t.colors.primary],
                    ] as const
                  ).map(([v, l, c]) => (
                    <Pressable
                      key={v}
                      onPress={() => setOwner(v)}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 8,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: owner === v ? c : t.colors.border,
                        backgroundColor: owner === v ? `${c}22` : 'transparent',
                      }}
                    >
                      <Text
                        maxFontSizeMultiplier={1.25}
                        numberOfLines={1}
                        style={{ fontWeight: '600', color: owner === v ? c : t.colors.text }}
                      >
                        {l}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Örn. Sinema, annemlere yemek"
                    placeholderTextColor={t.colors.muted}
                    maxLength={60}
                    style={{
                      flex: 1,
                      backgroundColor: t.colors.bg,
                      borderWidth: 1,
                      borderColor: t.colors.border,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      fontSize: 15,
                      color: t.colors.text,
                    }}
                  />
                  <TextInput
                    value={time}
                    onChangeText={onTime}
                    placeholder="Saat"
                    placeholderTextColor={t.colors.muted}
                    keyboardType="number-pad"
                    maxLength={5}
                    style={{
                      width: 72,
                      textAlign: 'center',
                      backgroundColor: t.colors.bg,
                      borderWidth: 1,
                      borderColor: t.colors.border,
                      borderRadius: 12,
                      paddingVertical: 10,
                      fontSize: 15,
                      color: t.colors.text,
                    }}
                  />
                </View>
                {!!error && (
                  <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary }}>
                    {error}
                  </Text>
                )}
                <Pressable
                  onPress={save}
                  style={{ backgroundColor: t.colors.primary, borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}
                >
                  {busy ? (
                    <ActivityIndicator color={t.colors.onPrimary} />
                  ) : (
                    <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.onPrimary, fontWeight: '700', fontSize: 15 }}>
                      Ekle
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Telefon takvimini paylaşma ayarı: başlıklarıyla, sadece "Meşgul" ya da kapalı.
function ShareSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTheme();
  const { user, couple, partnerName, profile } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  if (!user || !couple) return null;
  const current = profile?.calendarShare ?? null;

  async function pick(mode: 'titles' | 'busy' | null) {
    if (!user || !couple) return;
    setError('');
    setBusy(mode ?? 'off');
    try {
      if (mode) await syncPhoneCalendar(couple.id, user.uid, mode);
      else await stopCalendarShare(couple.id, user.uid);
      onClose();
    } catch (e) {
      setError(
        (e as Error).message === 'permission'
          ? 'Takvim izni verilmedi. Ayarlar > 2miz > Takvimler bölümünden açabilirsin.'
          : 'Olmadı, tekrar dene.',
      );
    } finally {
      setBusy(null);
    }
  }

  const opt = (mode: 'titles' | 'busy' | null, title: string, desc: string) => (
    <Pressable
      onPress={() => pick(mode)}
      style={{
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: current === mode ? t.colors.primary : t.colors.border,
        backgroundColor: current === mode ? t.colors.primarySoft : 'transparent',
        gap: 2,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontSize: 15, fontWeight: '600', color: t.colors.text }}>
          {title}
        </Text>
        {busy === (mode ?? 'off') && <ActivityIndicator color={t.colors.primary} />}
        {current === mode && !busy && <Ionicons name="checkmark-circle" size={20} color={t.colors.primary} />}
      </View>
      <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 13, color: t.colors.muted }}>
        {desc}
      </Text>
    </Pressable>
  );

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
            gap: 10,
          }}
        >
          <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 18, fontWeight: '700', color: t.colors.text }}>
            Telefon takvimini paylaş
          </Text>
          <Muted style={{ fontSize: 13 }}>
            iPhone takvimindeki önümüzdeki 5 haftan ortak takvimde {partnerName}'e görünür. Uygulama açıldıkça güncellenir. Takvimine hiçbir
            şey yazılmaz.
          </Muted>
          {opt('titles', 'Başlıklarıyla paylaş', '"Diş hekimi 14:00" gibi görünür.')}
          {opt('busy', 'Sadece "Meşgul" olarak', 'Başlıklar gizli kalır, sadece dolu saatlerin görünür.')}
          {opt(null, 'Paylaşma', 'Telefon takvimin görünmez; paylaşılmış olanlar silinir.')}
          {!!error && (
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary }}>
              {error}
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
