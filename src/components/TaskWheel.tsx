import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Animated, Easing, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BONUS_POINTS, completeBonus, toggleFavorite } from '../lib/archive';
import { handFont } from './Polaroid';
import { answerSpin, decideSpin, saveSpin, useToday, type WheelSpin } from '../lib/daily';
import { ANSWER_TASKS } from '../lib/taskKinds';
import { dayKey } from '../lib/date';
import { notifyPartner } from '../lib/push';
import { FREE, openPlus, usePlus } from '../lib/plus';
import { useSession } from '../lib/session';
import { CATEGORIES, categoryLabels, categoryStyle, taskById, TASKS, type Category, type Task } from '../lib/tasks';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Button, Card, Display, Muted, Pill, T } from './ui';

type IconName = ComponentProps<typeof Ionicons>['name'];
const SIZE = 270;
const R = SIZE / 2;

// Dilim yolu: tepe 0°, saat yönünde.
function slicePath(i: number, n: number) {
  const a0 = ((i / n) * 360 - 90) * (Math.PI / 180);
  const a1 = (((i + 1) / n) * 360 - 90) * (Math.PI / 180);
  const x0 = R + R * Math.cos(a0);
  const y0 = R + R * Math.sin(a0);
  const x1 = R + R * Math.cos(a1);
  const y1 = R + R * Math.sin(a1);
  return `M${R},${R} L${x0},${y0} A${R},${R} 0 ${360 / n > 180 ? 1 : 0} 1 ${x1},${y1} Z`;
}

// Bonus görev çarkı (ortak): kim çevirirse çevirsin sonuç günün belgesine yazılır,
// iki telefonda da aynı görev görünür; sayfa açıksa partner çarkın döndüğünü canlı izler.
// "Favorilerimiz" seçiliyse sadece favori görevler arasından seçer.
export function TaskWheel() {
  const t = useTheme();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const { day, key } = useToday(couple?.id, couple?.members);
  const plus = usePlus();
  const [mode, setMode] = useState<'all' | 'fav'>('all');
  const [shown, setShown] = useState<WheelSpin | null>(null); // dönmesi bitmiş, ekranda gösterilen sonuç
  const [display, setDisplay] = useState<Category[] | null>(null); // çarkta çizili dilimler
  const [spinning, setSpinning] = useState(false);
  const [busy, setBusy] = useState(false);
  const rot = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);
  const lastSpin = useRef<string | null>(null);

  const favorites = couple?.favorites ?? [];
  const favTasks = useMemo(() => TASKS.filter((x) => favorites.includes(x.id)), [favorites.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const modeSlices: Category[] = mode === 'fav' ? CATEGORIES.filter((c) => favTasks.some((x) => x.category === c)) : CATEGORIES;
  const slices = display ?? modeSlices;
  const canFav = favTasks.length >= 2;
  const doneToday = couple?.lastBonusDay === dayKey();

  function animateTo(n: number, k: number, jitter: number, done: () => void) {
    const seg = 360 / n;
    const center = (k + 0.5) * seg;
    const cur = angle.current;
    const target = cur + 360 * 5 + ((((360 - center + jitter - cur) % 360) + 360) % 360);
    angle.current = target;
    setSpinning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(rot, {
      toValue: target,
      duration: 3200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      done();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
  }

  // Ortak sonucu izler: ilk açılışta son çevirmeyi direkt gösterir,
  // partner az önce çevirdiyse çarkı onunla aynı yere döndürür.
  const remote = day?.wheel;
  useEffect(() => {
    if (!remote || remote.spinId === lastSpin.current) return;
    const first = lastSpin.current === null;
    lastSpin.current = remote.spinId;
    const fresh = Date.now() - remote.atMs < 60_000;
    if (!first && remote.by !== user?.uid && fresh) {
      setShown(null);
      setDisplay(remote.slices as Category[]);
      animateTo(remote.slices.length, remote.k, remote.jitter, () => setShown(remote));
    } else if (first) {
      setShown(remote);
      setDisplay(remote.slices as Category[]);
      const seg = 360 / remote.slices.length;
      angle.current = 360 - (remote.k + 0.5) * seg + remote.jitter;
      rot.setValue(angle.current);
    }
  }, [remote?.spinId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !couple) return null;
  const coupleId = couple.id;
  const uid = user.uid;

  function pickFrom(cat: Category): Task {
    const seen = couple?.seenTasks ?? [];
    const pool = mode === 'fav' ? favTasks.filter((x) => x.category === cat) : TASKS.filter((x) => x.category === cat);
    const fresh = pool.filter((x) => x.id !== shown?.taskId && (mode === 'fav' || !seen.includes(x.id)));
    const list = fresh.length ? fresh : pool;
    return list[Math.floor(Math.random() * list.length)];
  }

  // Ücretsizde günde bir çevirme; reddedilen görevin yeniden çevrilmesi sayılmaz.
  function spin(reroll = false) {
    if (spinning || modeSlices.length < 1 || !day) return;
    if (!reroll && !plus.active && (day.spins ?? (day.wheel ? 1 : 0)) >= FREE.spinsPerDay) return openPlus('wheel');
    const n = modeSlices.length;
    const k = Math.floor(Math.random() * n);
    const jitter = (Math.random() - 0.5) * (360 / n) * 0.6;
    const task = pickFrom(modeSlices[k]);
    const s: WheelSpin = {
      spinId: `${uid}-${Date.now()}`,
      by: uid,
      atMs: Date.now(),
      taskId: task.id,
      slices: modeSlices,
      k,
      jitter,
    };
    lastSpin.current = s.spinId;
    setShown(null);
    setDisplay(modeSlices);
    saveSpin(coupleId, key, s, !reroll).catch(() => {});
    if (partnerId) {
      notifyPartner(partnerId, `${profile?.name ?? 'Partnerin'} bonus çarkını çevirdi 🎡`, task.title, { type: 'wheel', url: '/wheel' });
    }
    animateTo(n, k, jitter, () => setShown(s));
  }

  // Yapılacak görev: kabul edilirse görev listenize eklenir, reddedilirse yeniden çevrilir.
  async function decide(accept: boolean) {
    if (!shown || busy) return;
    setBusy(true);
    try {
      const ok = await decideSpin(coupleId, key, shown.spinId, uid, accept);
      if (ok && accept && partnerId) {
        notifyPartner(partnerId, `${profile?.name ?? 'Partnerin'} bonus görevi kabul etti 🎯`, taskById(shown.taskId).title, {
          type: 'wheel',
          url: '/',
        });
      }
      if (ok && !accept) spin(true);
    } finally {
      setBusy(false);
    }
  }

  // Cevap yaz: partner cevapladıysa ikisi açılır ve bonus puanı (günde bir kez) gelir.
  async function sendAnswer(text: string) {
    if (!shown || busy || !text.trim()) return;
    setBusy(true);
    try {
      const res = await answerSpin(coupleId, key, shown.spinId, uid, text);
      if (res.ok && res.both) await completeBonus(coupleId, shown.taskId, uid).catch(() => false);
      if (res.ok && !res.both && partnerId) {
        notifyPartner(partnerId, `${profile?.name ?? 'Partnerin'} bonus göreve cevap verdi ✍️`, 'Görmek için sen de cevabını yaz.', {
          type: 'wheel',
          url: '/wheel',
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const task = shown ? taskById(shown.taskId) : null;
  // Cevaplar canlı gelsin diye gösterilen çevirmenin güncel hali.
  const live = shown && remote?.spinId === shown.spinId ? remote : null;
  const spinDeg = rot.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });
  const isFav = !!task && favorites.includes(task.id);

  return (
    <Card>
      <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, t.copy.surpriseTitle)}</T>
      <Muted>
        {doneToday
          ? 'Bugünün bonus puanını aldınız. Yine de çevirip bir görev daha yapabilirsiniz.'
          : `Biriniz çevirir, çıkan görev ikinizin ekranına da gelir. Tamamlayınca +${BONUS_POINTS} puan (günde bir kez).`}
      </Muted>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['all', 'fav'] as const).map((m) => {
          const on = mode === m;
          const disabled = m === 'fav' && !canFav;
          return (
            <Pressable
              key={m}
              disabled={disabled || spinning}
              onPress={() => {
                setMode(m);
                setDisplay(null);
              }}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 12,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: on ? t.colors.primary : t.colors.border,
                backgroundColor: on ? t.colors.primarySoft : 'transparent',
                opacity: disabled ? 0.45 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: t.colors.text,
                  fontFamily: t.fonts.button,
                }}
              >
                {m === 'all' ? tx(t, 'Tüm görevler') : tx(t, `Favorilerimiz (${favTasks.length})`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!canFav && (
        <Muted style={{ fontSize: 12 }}>Görevlerdeki kalbe dokunarak favori ekleyin; 2 favoriden sonra favori çarkı açılır.</Muted>
      )}

      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        {/* Üstteki ok */}
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 13,
            borderRightWidth: 13,
            borderTopWidth: 22,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: t.colors.text,
            marginBottom: -10,
            zIndex: 2,
          }}
        />
        <View style={{ width: SIZE, height: SIZE }}>
          <Animated.View
            style={{
              width: SIZE,
              height: SIZE,
              transform: [{ rotate: spinDeg }],
            }}
          >
            <Svg width={SIZE} height={SIZE}>
              {slices.length === 1 ? (
                <Circle cx={R} cy={R} r={R} fill={categoryStyle[slices[0]].color} />
              ) : (
                slices.map((c, i) => (
                  <Path key={c} d={slicePath(i, slices.length)} fill={categoryStyle[c].color} stroke="#fff" strokeWidth={2} />
                ))
              )}
            </Svg>
            {slices.map((c, i) => {
              const mid = ((i + 0.5) / slices.length) * 360;
              const rad = (mid - 90) * (Math.PI / 180);
              const x = R + R * 0.64 * Math.cos(rad);
              const y = R + R * 0.64 * Math.sin(rad);
              return (
                <View
                  key={c}
                  style={{
                    position: 'absolute',
                    left: x - 40,
                    top: y - 22,
                    width: 80,
                    alignItems: 'center',
                    transform: [{ rotate: `${mid}deg` }],
                  }}
                >
                  <Ionicons name={categoryStyle[c].icon as IconName} size={22} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
                    {c === 'yeni' ? 'Yeni' : categoryLabels[c]}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
          <Pressable
            onPress={() => spin()}
            style={({ pressed }) => ({
              position: 'absolute',
              left: R - 38,
              top: R - 38,
              width: 76,
              height: 76,
              borderRadius: 38,
              backgroundColor: t.colors.card,
              borderWidth: 4,
              borderColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
              opacity: pressed || spinning ? 0.8 : 1,
            })}
          >
            <Text
              style={{
                fontWeight: '800',
                fontSize: 14,
                color: t.colors.primary,
                fontFamily: t.fonts.button,
              }}
            >
              {spinning ? '…' : tx(t, 'ÇEVİR')}
            </Text>
          </Pressable>
        </View>
      </View>

      {task && shown && (
        <View style={{ gap: 10 }}>
          <Muted style={{ fontSize: 12 }}>
            {shown.by === uid ? 'Sen çevirdin' : `${partnerName} çevirdi`} · ikinizde de bu görev görünüyor
          </Muted>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pill>{t.copy.surpriseLabel}</Pill>
            <Muted style={{ fontSize: 12, flex: 1 }}>{tx(t, categoryLabels[task.category])}</Muted>
            <Pressable onPress={() => toggleFavorite(coupleId, task.id, !isFav).catch(() => {})} hitSlop={10} accessibilityLabel="Favori">
              <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={24} color={t.colors.primary} />
            </Pressable>
          </View>
          <Display>{task.title}</Display>
          {!ANSWER_TASKS.has(task.id) ? (
            <DecideBox spin={live ?? shown} uid={uid} partnerName={partnerName} onDecide={decide} busy={busy} />
          ) : (
            <Answers
              key={shown.spinId}
              spin={live ?? shown}
              uid={uid}
              partnerName={partnerName}
              myName={profile?.name ?? 'Sen'}
              doneToday={doneToday}
              onSend={sendAnswer}
              busy={busy}
            />
          )}
        </View>
      )}
    </Card>
  );
}

// Bonus görev cevapları: kendi cevabını yazmadan partnerinkini göremezsin.
function Answers({
  spin,
  uid,
  myName,
  partnerName,
  doneToday,
  onSend,
  busy,
}: {
  spin: WheelSpin;
  uid: string;
  myName: string;
  partnerName: string;
  doneToday: boolean;
  onSend: (text: string) => void;
  busy: boolean;
}) {
  const t = useTheme();
  const [text, setText] = useState('');
  const answers = spin.answers ?? {};
  const mine = answers[uid];
  const theirs = Object.entries(answers).find(([k]) => k !== uid)?.[1];

  const bubble = (name: string, body: string) => (
    <View
      style={{
        backgroundColor: t.colors.primarySoft,
        borderRadius: 14,
        padding: 12,
        gap: 4,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          color: t.colors.muted,
          fontFamily: t.fonts.button,
        }}
      >
        {name}
      </Text>
      <Text
        style={{
          fontSize: 21,
          lineHeight: 25,
          color: t.colors.text,
          fontFamily: handFont,
        }}
      >
        {body}
      </Text>
    </View>
  );

  if (mine && theirs) {
    return (
      <View style={{ gap: 8 }}>
        {bubble(myName, mine.text)}
        {bubble(partnerName, theirs.text)}
        <Muted style={{ fontSize: 13 }}>
          {doneToday ? 'İkiniz de cevapladınız, bugünün bonusu tamam 🎉' : 'İkiniz de cevapladınız 🎉'}
        </Muted>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {mine ? (
        bubble(myName, mine.text)
      ) : (
        <>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Cevabını ya da nasıl geçtiğini yaz…"
            placeholderTextColor={t.colors.muted}
            multiline
            maxLength={500}
            style={{
              minHeight: 70,
              backgroundColor: t.colors.bg,
              borderWidth: 1,
              borderColor: t.colors.border,
              borderRadius: 14,
              padding: 12,
              fontSize: 20,
              color: t.colors.text,
              fontFamily: handFont,
              textAlignVertical: 'top',
            }}
          />
          <Button
            label={doneToday ? 'Cevabımı gönder' : `Cevabımı gönder · +${BONUS_POINTS} puan`}
            onPress={() => onSend(text)}
            busy={busy}
          />
        </>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={theirs ? 'lock-closed' : 'time-outline'} size={14} color={t.colors.muted} />
        <Muted style={{ fontSize: 12, flex: 1 }}>
          {theirs
            ? `${partnerName} cevapladı. Görmek için sen de yaz.`
            : mine
              ? `${partnerName}'in cevabı bekleniyor. O da yazınca ikiniz de görürsünüz.`
              : `${partnerName} da cevap yazacak; ikiniz de yazınca cevaplar açılır.`}
        </Muted>
      </View>
    </View>
  );
}

// Yapılacak bonus görev: cevap yazılmaz. Kabul edilirse ana sayfadaki görevlere eklenir,
// yapınca orada "Tamamladım" denir.
function DecideBox({
  spin,
  uid,
  partnerName,
  onDecide,
  busy,
}: {
  spin: WheelSpin;
  uid: string;
  partnerName: string;
  onDecide: (accept: boolean) => void;
  busy: boolean;
}) {
  const t = useTheme();
  if (spin.decision === 'accepted') {
    return (
      <View style={{ gap: 8 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: t.colors.primarySoft,
            borderRadius: 14,
            padding: 12,
          }}
        >
          <Ionicons name="checkmark-circle" size={22} color="#4FA37E" />
          <Text style={{ flex: 1, color: t.colors.text, fontFamily: t.fonts.body }}>
            {spin.decidedBy === uid ? 'Kabul ettin' : `${partnerName} kabul etti`}. Görev ana sayfadaki görevlerinize eklendi; yapınca orada
            "Tamamladım" deyin.
          </Text>
        </View>
        <Button label="Ana sayfaya dön" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Kabul et" onPress={() => onDecide(true)} busy={busy} style={{ flex: 1 }} />
        <Button label="Reddet" variant="secondary" onPress={() => onDecide(false)} style={{ flex: 1 }} />
      </View>
      <Muted style={{ fontSize: 12 }}>Reddedersen çark yeniden döner. Kabul edilen görev ikinizin görev listesine eklenir.</Muted>
    </View>
  );
}
