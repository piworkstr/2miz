import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useMemo, useRef, useState, type ComponentProps } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BONUS_POINTS, completeBonus, toggleFavorite } from '../lib/archive';
import { dayKey } from '../lib/date';
import { useSession } from '../lib/session';
import { CATEGORIES, categoryLabels, categoryStyle, TASKS, type Category, type Task } from '../lib/tasks';
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

// Bonus görev çarkı: kategori dilimleri döner, durduğu kategoriden bir görev çıkar.
// "Favorilerimiz" seçiliyse sadece favori görevler arasından seçer.
export function TaskWheel() {
  const t = useTheme();
  const { user, couple } = useSession();
  const [mode, setMode] = useState<'all' | 'fav'>('all');
  const [task, setTask] = useState<Task | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [busy, setBusy] = useState(false);
  const rot = useRef(new Animated.Value(0)).current;
  const angle = useRef(0);

  const favorites = couple?.favorites ?? [];
  const favTasks = useMemo(() => TASKS.filter((x) => favorites.includes(x.id)), [favorites.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const slices: Category[] = mode === 'fav' ? CATEGORIES.filter((c) => favTasks.some((x) => x.category === c)) : CATEGORIES;
  const canFav = favTasks.length >= 2;
  const doneToday = couple?.lastBonusDay === dayKey();

  if (!user || !couple) return null;
  const coupleId = couple.id;

  function pickFrom(cat: Category): Task {
    const seen = couple?.seenTasks ?? [];
    const pool = mode === 'fav' ? favTasks.filter((x) => x.category === cat) : TASKS.filter((x) => x.category === cat);
    const fresh = pool.filter((x) => x.id !== task?.id && (mode === 'fav' || !seen.includes(x.id)));
    const list = fresh.length ? fresh : pool;
    return list[Math.floor(Math.random() * list.length)];
  }

  function spin() {
    if (spinning || slices.length < 1) return;
    const n = slices.length;
    const k = Math.floor(Math.random() * n);
    const seg = 360 / n;
    const center = (k + 0.5) * seg;
    const jitter = (Math.random() - 0.5) * seg * 0.6;
    const cur = angle.current;
    const target = cur + 360 * 5 + ((((360 - center + jitter - cur) % 360) + 360) % 360);
    angle.current = target;
    setSpinning(true);
    setTask(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    Animated.timing(rot, { toValue: target, duration: 3200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(() => {
      setSpinning(false);
      setTask(pickFrom(slices[k]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });
  }

  async function done() {
    if (!task || busy || !user) return;
    setBusy(true);
    await completeBonus(coupleId, task.id, user.uid).catch(() => false);
    setBusy(false);
  }

  const spinDeg = rot.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });
  const isFav = !!task && favorites.includes(task.id);

  return (
    <Card>
      <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, t.copy.surpriseTitle)}</T>
      <Muted>
        {doneToday
          ? 'Bugünün bonus puanını aldınız. Yine de çevirip bir görev daha yapabilirsiniz.'
          : `Çarkı çevirin, çıkan görevi yapın: +${BONUS_POINTS} puan (günde bir kez).`}
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
                setTask(null);
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: t.colors.text, fontFamily: t.fonts.button }}>
                {m === 'all' ? tx(t, 'Tüm görevler') : tx(t, `Favorilerimiz (${favTasks.length})`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {!canFav && <Muted style={{ fontSize: 12 }}>Görevlerdeki kalbe dokunarak favori ekleyin; 2 favoriden sonra favori çarkı açılır.</Muted>}

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
          <Animated.View style={{ width: SIZE, height: SIZE, transform: [{ rotate: spinDeg }] }}>
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
                    {categoryLabels[c]}
                  </Text>
                </View>
              );
            })}
          </Animated.View>
          <Pressable
            onPress={spin}
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
            <Text style={{ fontWeight: '800', fontSize: 14, color: t.colors.primary, fontFamily: t.fonts.button }}>
              {spinning ? '…' : tx(t, 'ÇEVİR')}
            </Text>
          </Pressable>
        </View>
      </View>

      {task && (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pill>{t.copy.surpriseLabel}</Pill>
            <Muted style={{ fontSize: 12, flex: 1 }}>{tx(t, categoryLabels[task.category])}</Muted>
            <Pressable onPress={() => toggleFavorite(coupleId, task.id, !isFav).catch(() => {})} hitSlop={10} accessibilityLabel="Favori">
              <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={24} color={t.colors.primary} />
            </Pressable>
          </View>
          <Display>{task.title}</Display>
          {!doneToday && <Button label={`Yaptık! +${BONUS_POINTS} puan`} onPress={done} busy={busy} />}
          {doneToday && <Muted style={{ fontSize: 13 }}>Bugünün bonusu tamam 🎉</Muted>}
        </View>
      )}
    </Card>
  );
}
