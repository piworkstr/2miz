import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { prettyDate } from '../lib/date';
import {
  BUDGETS,
  clock,
  coupleAge,
  costLabel,
  DATE_DURS,
  DATE_TYPES,
  makePlan,
  minsLabel,
  planQuestions,
  planSummary,
  planTitle,
  stepTimes,
  swapStep,
  type DateDur,
  type DateType,
  type Plan,
  type Step,
} from '../lib/datePlan';
import { nextDays, planDateWith, toggleDateStep, useUpcomingDates, type DatePlan } from '../lib/dates';
import { usePartners, type Partner } from '../lib/perks';
import { notifyPartner } from '../lib/push';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Button, Card, ErrorText, Muted, T } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Date planlayıcı: bütçe, tür ve süre seçilir; adım adım bir program çıkar. Program bir güne eklenince
// mevcut date önerisine dönüşür (partner onaylar) ve date günü adımlar işaretlenir.
export function DatePlanner() {
  const t = useTheme();
  const { user, couple, partnerName, partnerId, profile, partnerProfile } = useSession();
  const all = usePartners();
  // Kampanyalar: çiftin şehrindeki mekanlar önce; şehir seçilmemişse hepsi.
  const partners = sameCity(all ?? [], couple?.city);
  const dates = useUpcomingDates(couple?.id);
  const [budget, setBudget] = useState(1000);
  const [custom, setCustom] = useState<string | null>(null); // null: hazır tutarlardan biri seçili
  const [type, setType] = useState<DateType>('romantik');
  const [dur, setDur] = useState<DateDur>('half');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [added, setAdded] = useState('');
  const days = useMemo(() => nextDays(14), []);
  // Son gösterilen planların adımları: "Başka plan oluştur" aynı adımları yeniden getirmesin.
  const seen = useRef<string[][]>([]);
  const age = coupleAge([profile?.birthDate, partnerProfile?.birthDate]);
  if (!user || !couple) return null;

  const money = custom !== null ? parseInt(custom, 10) || 0 : budget;
  const create = () => {
    setError('');
    setAdded('');
    if (money < 100) return setError('Bütçe en az 100 TL olmalı.');
    setPicking(false);
    const next = makePlan(type, dur, Math.min(money, 100000), Date.now() % 2147483647, Date.now(), { avoid: seen.current.flat(), age });
    seen.current = [...seen.current, next.steps.map((s) => s.id)].slice(-2);
    setPlan(next);
  };
  const chip = (key: string, label: string, on: boolean, onPress: () => void, icon?: IconName) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: on ? t.colors.primary : t.colors.border,
        backgroundColor: on ? t.colors.primary : 'transparent',
      }}
    >
      {icon && <Ionicons name={icon} size={14} color={on ? t.colors.onPrimary : t.colors.muted} />}
      <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 13, fontWeight: '700', color: on ? t.colors.onPrimary : t.colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
  const label = (s: string) => (
    <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 12, fontWeight: '700', color: t.colors.muted }}>
      {s}
    </Text>
  );

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="sparkles" size={18} color={t.colors.primary} />
        <T style={{ fontWeight: '700', fontSize: 16 }}>Date planı oluştur</T>
      </View>
      {label('Bütçe (iki kişi)')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {BUDGETS.map((b) =>
          chip(String(b), `${b.toLocaleString('tr-TR')} TL`, custom === null && budget === b, () => {
            setCustom(null);
            setBudget(b);
          }),
        )}
        {chip('ozel', 'Özel', custom !== null, () => setCustom(custom ?? ''))}
      </View>
      {custom !== null && (
        <TextInput
          value={custom}
          onChangeText={(v) => setCustom(v.replace(/[^\d]/g, ''))}
          placeholder="Bütçeni yaz (TL)"
          placeholderTextColor={t.colors.muted}
          keyboardType="number-pad"
          maxLength={6}
          style={{
            minHeight: 44,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.colors.border,
            paddingHorizontal: 12,
            fontSize: 15,
            color: t.colors.text,
          }}
        />
      )}
      {label('Nasıl bir date')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(Object.keys(DATE_TYPES) as DateType[]).map((k) =>
          chip(k, DATE_TYPES[k].label, type === k, () => setType(k), DATE_TYPES[k].icon as IconName),
        )}
      </View>
      {label('Süre')}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(Object.keys(DATE_DURS) as DateDur[]).map((k) => chip(k, DATE_DURS[k].label, dur === k, () => setDur(k)))}
      </View>
      <ErrorText>{error}</ErrorText>
      <Button label={plan ? 'Başka plan oluştur' : 'Plan oluştur'} variant={plan ? 'secondary' : 'primary'} onPress={create} />

      {plan && (
        <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <T style={{ flex: 1, fontWeight: '700', fontSize: 16 }}>{planTitle(plan.type, plan.dur)}</T>
            <Muted style={{ fontSize: 12 }}>{plan.total ? `yaklaşık ${costLabel(plan.total)}` : 'ücretsiz'}</Muted>
          </View>
          <StepList
            steps={plan.steps}
            start={plan.start}
            seed={plan.seed}
            partners={partners}
            onSwap={(i) => setPlan(swapStep(plan, i, Date.now() % 2147483647, age))}
          />
          <Muted style={{ fontSize: 12 }}>Tutarlar iki kişi için yaklaşık değerdir; saatler öneridir.</Muted>
          {added ? (
            <Text maxFontSizeMultiplier={1.2} style={{ color: t.colors.success, fontWeight: '700', fontSize: 14 }}>
              {added}
            </Text>
          ) : picking ? (
            <>
              {label('Hangi gün?')}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {days.map((d) => {
                  const has = dates.some((x) => x.id === d.key);
                  return (
                    <Pressable
                      key={d.key}
                      disabled={!!busy}
                      onPress={async () => {
                        setBusy(d.key);
                        setError('');
                        try {
                          await planDateWith(couple.id, d.key, user.uid, plan, planTitle(plan.type, plan.dur), planSummary(plan));
                          if (partnerId)
                            void notifyPartner(
                              partnerId,
                              `${profile?.name ?? 'Partnerin'} bir date planladı 💛`,
                              `${prettyDate(d.key)} · ${planTitle(plan.type, plan.dur)}`,
                              { type: 'date', url: '/' },
                            );
                          setAdded(
                            has
                              ? `${prettyDate(d.key)} günündeki date’e program eklendi.`
                              : `${prettyDate(d.key)} için ${partnerName}’e önerildi; onaylayınca kesinleşir.`,
                          );
                          setPicking(false);
                        } catch {
                          setError('Kaydedilemedi. Bağlantını kontrol edip yeniden dene.');
                        } finally {
                          setBusy('');
                        }
                      }}
                      style={{
                        width: 62,
                        paddingVertical: 7,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: has ? t.colors.primary : t.colors.border,
                        alignItems: 'center',
                        opacity: busy && busy !== d.key ? 0.5 : 1,
                      }}
                    >
                      <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 11, color: t.colors.muted }}>
                        {d.weekday}
                      </Text>
                      <Text maxFontSizeMultiplier={1.1} style={{ fontSize: 13, fontWeight: '700', color: t.colors.text }}>
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Muted style={{ fontSize: 12 }}>Çerçevesi renkli günlerde zaten date var; program o date’e eklenir.</Muted>
            </>
          ) : (
            <Button label="Takvime ekle" onPress={() => setPicking(true)} />
          )}
        </View>
      )}
    </Card>
  );
}

// Çiftin şehrindeki mekanlar (şehir yoksa ya da o şehirde mekan yoksa boş: başka şehrin kampanyası gösterilmez).
export const sameCity = (list: Partner[], city?: string | null) =>
  city ? list.filter((p) => p.city.trim().toLocaleLowerCase('tr-TR') === city.trim().toLocaleLowerCase('tr-TR')) : list;

// Programın adımları: saat, ad, süre ve tutar. onSwap varsa adım değiştirilebilir; onToggle varsa işaretlenebilir.
export function StepList({
  steps,
  start,
  seed,
  partners,
  done,
  onSwap,
  onToggle,
}: {
  steps: Step[];
  start: number;
  seed?: number;
  partners?: Partner[];
  done?: number[];
  onSwap?: (index: number) => void;
  onToggle?: (index: number, on: boolean) => void;
}) {
  const t = useTheme();
  const times = stepTimes({ start, steps });
  const [openQ, setOpenQ] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      {steps.map((s, i) => {
        const venue = s.cat ? partners?.find((p) => p.active && p.cat === s.cat) : undefined;
        const isDone = !!done?.includes(i);
        return (
          <View key={`${s.id}-${i}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            {onToggle ? (
              <Pressable
                onPress={() => onToggle(i, !isDone)}
                hitSlop={8}
                accessibilityLabel={isDone ? 'Yapıldı işaretini kaldır' : 'Yapıldı işaretle'}
              >
                <Ionicons
                  name={isDone ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={isDone ? t.colors.success : t.colors.muted}
                />
              </Pressable>
            ) : (
              <Text maxFontSizeMultiplier={1.1} style={{ width: 40, fontSize: 12, color: t.colors.muted, paddingTop: 2 }}>
                {clock(times[i])}
              </Text>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                maxFontSizeMultiplier={1.2}
                style={{ fontSize: 15, fontWeight: '700', color: t.colors.text, opacity: isDone ? 0.55 : 1 }}
              >
                {s.n}
              </Text>
              <Muted style={{ fontSize: 12 }}>
                {onToggle ? `${clock(times[i])} · ` : ''}
                {minsLabel(s.m)} · {costLabel(s.c)}
              </Muted>
              {s.k === 'question' && seed !== undefined && (
                <>
                  <Pressable onPress={() => setOpenQ(!openQ)}>
                    <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 12, fontWeight: '700', color: t.colors.primary }}>
                      {openQ ? 'Soruları gizle' : 'Soruları gör'}
                    </Text>
                  </Pressable>
                  {openQ &&
                    planQuestions(seed).map((q, k) => <Muted key={q} style={{ fontSize: 13, lineHeight: 18 }}>{`${k + 1}. ${q}`}</Muted>)}
                </>
              )}
              {s.k === 'photo' && <Muted style={{ fontSize: 12 }}>Date günü ortak selfieniz albüme girer.</Muted>}
              {venue && (
                <Pressable
                  onPress={() => router.push(`/perks/${venue.id}`)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#FAEEDA',
                    borderRadius: 10,
                    padding: 7,
                    marginTop: 2,
                  }}
                >
                  <Ionicons name="gift" size={14} color="#854F0B" />
                  <Text maxFontSizeMultiplier={1.2} style={{ flex: 1, fontSize: 12, color: '#633806' }}>
                    {venue.name}
                    {venue.area ? ` (${venue.area})` : ''}: {venue.offer}
                  </Text>
                </Pressable>
              )}
            </View>
            {onSwap && (
              <Pressable onPress={() => onSwap(i)} hitSlop={10} accessibilityLabel="Bu adımı değiştir">
                <Ionicons name="refresh" size={18} color={t.colors.muted} />
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

// Planlanmış bir date'in programı (yaklaşan listede salt okunur, date günü işaretlenebilir).
export function DateProgram({ plan, coupleId, checkable }: { plan: DatePlan; coupleId: string; checkable?: boolean }) {
  const { couple } = useSession();
  const partners = sameCity(usePartners() ?? [], couple?.city);
  const [open, setOpen] = useState(!!checkable);
  const t = useTheme();
  if (!plan.steps?.length) return null;
  return (
    <View style={{ gap: 8 }}>
      {!checkable && (
        <Pressable onPress={() => setOpen(!open)}>
          <Text maxFontSizeMultiplier={1.2} style={{ fontSize: 13, fontWeight: '700', color: t.colors.primary }}>
            {open ? 'Programı gizle' : `Programı gör (${plan.steps.length} adım${plan.total ? `, yaklaşık ${costLabel(plan.total)}` : ''})`}
          </Text>
        </Pressable>
      )}
      {open && (
        <StepList
          steps={plan.steps}
          start={plan.start ?? 14 * 60}
          seed={plan.seed}
          partners={partners}
          done={checkable ? (plan.done ?? []) : undefined}
          onToggle={checkable ? (i, on) => void toggleDateStep(coupleId, plan.id, i, on).catch(() => {}) : undefined}
        />
      )}
    </View>
  );
}
