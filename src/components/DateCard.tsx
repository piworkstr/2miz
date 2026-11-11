import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { dayKey, prettyDate, trMonth } from '../lib/date';
import { cancelDate, confirmDate, markDateSelfie, proposeDate, useUpcomingDates, type DatePlan } from '../lib/dates';
import { saveDatePhoto } from '../lib/photos';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { SelfieCamera } from './SelfieCamera';
import { Button, Card, Display, ErrorText, Input, Muted, T } from './ui';

// mode "banner": ana ekranın üstünde, sadece yapılacak bir şey varken görünür
// (bugünün onayı, bugünün ortak selfiesi, partnerin önerdiği bir date'i onaylamak).
// mode "planner": "Date" kısayolunun açtığı planlama alanı.
export function DateCard({ mode }: { mode: 'banner' | 'planner' }) {
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

  if (mode === 'banner') {
    const toConfirm = later.filter((d) => d.status === 'proposed' && d.by !== uid);
    return (
      <>
        {todayPlan?.status === 'confirmed' && !todayPlan.selfie && <DateToday plan={todayPlan} coupleId={couple.id} uid={uid} />}
        {todayPlan?.status === 'proposed' && todayPlan.by !== uid && (
          <Card accent style={{ borderColor: t.colors.primary }}>
            <T>{t.copy.date.partnerSaysToday(partnerName)}</T>
            <Button
              label={t.copy.date.confirmToday}
              busy={busy === 'today'}
              onPress={() => run('today', () => confirmDate(couple.id, today))}
            />
          </Card>
        )}
        {toConfirm.map((d) => (
          <Card key={d.id} accent style={{ borderColor: t.colors.primary }}>
            <T>{t.copy.date.partnerPlanned(partnerName, prettyDate(d.id))}</T>
            <Button label={t.copy.date.confirm} busy={busy === d.id} onPress={() => run(d.id, () => confirmDate(couple.id, d.id))} />
          </Card>
        ))}
      </>
    );
  }

  return (
    <>
      {todayPlan?.status === 'confirmed' ? (
        <Muted>
          {todayPlan.selfie
            ? 'Bugünkü date anınız albüme eklendi. Bir sonrakini planlayın:'
            : 'Bugün date gününüz! Ortak selfie kartı yukarıda.'}
        </Muted>
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

      {todayPlan?.status === 'confirmed' && <Button label={t.copy.date.plan} variant="secondary" onPress={() => setPicking(!picking)} />}

      {picking && (
        <Card>
          <T style={{ fontWeight: '600' }}>{tx(t, t.copy.date.pickDay)}</T>
          <MonthPicker
            taken={new Set(dates.map((x) => x.id))}
            busy={busy}
            onPick={(key) =>
              run(key, async () => {
                await proposeDate(couple.id, key, uid, false);
                setPicking(false);
              })
            }
          />
        </Card>
      )}

      {later.length > 0 && (
        <Card style={{ gap: 10 }}>
          <T style={{ fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, t.copy.date.upcoming)}</T>
          {later.map((d) => (
            <UpcomingRow
              key={d.id}
              plan={d}
              uid={uid}
              busy={busy === d.id}
              onConfirm={() => run(d.id, () => confirmDate(couple.id, d.id))}
              onCancel={() => cancelDate(couple.id, d.id)}
            />
          ))}
        </Card>
      )}
    </>
  );
}

function UpcomingRow({
  plan,
  uid,
  busy,
  onConfirm,
  onCancel,
}: {
  plan: DatePlan;
  uid: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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

// Date günü kesinleştiğinde çıkan özel kart. İkinizin aynı karede olduğu tek bir selfie zorunlu.
function DateToday({ plan, coupleId, uid }: { plan: DatePlan; coupleId: string; uid: string }) {
  const t = useTheme();
  const { partnerName } = useSession();
  const [selfie, setSelfie] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const on = t.colors.onPrimary;

  async function save() {
    setError('');
    if (!selfie) return setError('Önce birlikte bir selfie çekin.');
    if (!note.trim()) return setError('Bu date için küçük bir not yaz.');
    setBusy(true);
    try {
      await saveDatePhoto(coupleId, plan.id, uid, note, selfie);
      await markDateSelfie(coupleId, plan.id, uid);
    } catch {
      setError('Kaydedilemedi, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ backgroundColor: t.colors.primary, borderRadius: t.radius.card, padding: 18, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={t.id === 'agir' ? 'flash' : 'heart'} size={22} color={on} />
        <Text
          maxFontSizeMultiplier={1.25}
          style={{
            color: on,
            fontFamily: t.fonts.button,
            fontWeight: t.fonts.button ? undefined : '600',
            letterSpacing: t.upper ? 1.5 : 0,
          }}
        >
          {tx(t, 'Date günü')}
        </Text>
      </View>
      <Display style={{ color: on }}>{t.copy.date.today}</Display>

      {plan.selfie ? (
        <View style={{ backgroundColor: t.colors.card, borderRadius: Math.min(t.radius.card, 14), padding: 14, gap: 4 }}>
          <T style={{ color: t.colors.success, fontWeight: '600' }}>Ortak selfieniz albüme eklendi</T>
          <Muted>Albüm sekmesinde bu güne özel geniş bir polaroid olarak duruyor.</Muted>
        </View>
      ) : (
        <View style={{ backgroundColor: t.colors.card, borderRadius: Math.min(t.radius.card, 14), padding: 14, gap: 10 }}>
          <Muted>
            {t.copy.date.selfieHint} Biriniz çekmesi yeterli, {partnerName} da görecek.
          </Muted>
          <SelfieCamera value={selfie} onChange={setSelfie} aspect={4 / 3} />
          <Input placeholder="Bu date'ten bir not..." value={note} onChangeText={setNote} maxLength={80} />
          <ErrorText>{error}</ErrorText>
          <Button label="Albüme ekle" onPress={save} busy={busy} />
        </View>
      )}
    </View>
  );
}

// Aylık takvim: bugünden itibaren 12 ay ileri; geçmiş günler kapalı, planlı günler işaretli.
const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
function MonthPicker({ taken, busy, onPick }: { taken: Set<string>; busy: string | null; onPick: (key: string) => void }) {
  const t = useTheme();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const first = new Date(ym.y, ym.m, 1);
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Pazartesi başlangıç
  const today = dayKey(now);
  const isFirst = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const isLast = ym.y * 12 + ym.m >= now.getFullYear() * 12 + now.getMonth() + 11;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const arrow = (dir: -1 | 1, off: boolean) => (
    <Pressable
      disabled={off}
      hitSlop={10}
      onPress={() => setYm(({ y, m }) => ({ y: y + Math.floor((m + dir) / 12), m: (m + dir + 12) % 12 }))}
      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.25 : 1 }}
    >
      <Ionicons name={dir < 0 ? 'chevron-back' : 'chevron-forward'} size={20} color={t.colors.text} />
    </Pressable>
  );
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {arrow(-1, isFirst)}
        <T style={{ flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16 }}>
          {trMonth(ym.m)} {ym.y}
        </T>
        {arrow(1, isLast)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w) => (
          <Muted key={w} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>
            {w}
          </Muted>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, c) => {
            if (!d) return <View key={c} style={{ flex: 1, aspectRatio: 1 }} />;
            const key = dayKey(new Date(ym.y, ym.m, d));
            const past = key <= today; // bugün için "Şu an date'teyiz" düğmesi var
            const on = taken.has(key);
            const off = past || on || busy === key;
            return (
              <Pressable
                key={c}
                disabled={off}
                onPress={() => onPick(key)}
                style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 }}
              >
                <View
                  style={{
                    width: '100%',
                    maxWidth: 40,
                    aspectRatio: 1,
                    borderRadius: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? t.colors.primary : key === today ? t.colors.primarySoft : 'transparent',
                    borderWidth: past && !on ? 0 : 1,
                    borderColor: t.colors.border,
                    opacity: past && !on ? 0.3 : 1,
                  }}
                >
                  <T style={{ fontWeight: on || key === today ? '700' : '500', color: on ? t.colors.onPrimary : t.colors.text }}>{d}</T>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <Muted style={{ fontSize: 11, textAlign: 'center' }}>Dolu günler renkli. Dokunduğun gün partnerine önerilir.</Muted>
    </View>
  );
}
