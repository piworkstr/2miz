import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { dayKey } from '../lib/date';
import { gardenOf, liveStreak, moodOf, stageOf, waterGarden } from '../lib/garden';
import { notifyPartner } from '../lib/push';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';
import { Button, Card, Muted, T } from './ui';

// Bizim Bahçe: ikiniz de her gün bir kez sularsınız; ikiniz de suladığınız her gün bitki büyür.
export function GardenCard() {
  const t = useTheme();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const pop = useRef(new Animated.Value(1)).current;
  if (!user || !couple || !partnerId) return null;

  const g = gardenOf(couple);
  const today = dayKey();
  const me = g.water[user.uid] === today;
  const them = g.water[partnerId] === today;
  const { stage, next, toNext } = stageOf(g.growth);
  const mood = me && them ? 'ok' : moodOf(g);
  const streak = liveStreak(g);

  async function water() {
    if (busy || me || !user || !couple || !partnerId) return;
    setBusy(true);
    try {
      const r = await waterGarden(couple.id, user.uid, partnerId);
      if (r) {
        Animated.sequence([
          Animated.spring(pop, { toValue: 1.25, useNativeDriver: true, speed: 30 }),
          Animated.spring(pop, { toValue: 1, useNativeDriver: true }),
        ]).start();
        const name = profile?.name ?? 'Partnerin';
        if (r.both) {
          const s = stageOf(r.garden.growth).stage;
          setMsg(r.grew ? `Yeni aşama: ${s.name}!` : 'Bugün birlikte suladınız, bahçe büyüdü.');
          notifyPartner(partnerId, r.grew ? `Bahçeniz büyüdü: ${s.name} ${s.art}` : 'Bahçeniz bugün büyüdü 🌱', `${name} da suladı.`, {
            type: 'mood',
            url: '/',
          });
        } else {
          setMsg(`Sıra ${partnerName}'de.`);
          notifyPartner(partnerId, `${name} bahçeyi suladı 💧`, 'Sen de sula, bugün birlikte büyüsün.', { type: 'mood', url: '/' });
        }
      }
    } catch {
      setMsg('Sulanamadı, tekrar dene.');
    }
    setBusy(false);
  }

  const status =
    me && them
      ? 'Bugün ikiniz de suladınız 💚'
      : me
        ? `${partnerName} henüz sulamadı`
        : them
          ? `${partnerName} suladı, sıra sende`
          : mood === 'wilted'
            ? 'Bahçeniz soldu, birlikte sularsanız canlanır'
            : mood === 'thirsty'
              ? 'Bahçeniz susadı'
              : 'Bugün henüz kimse sulamadı';

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="leaf-outline" size={22} color={t.colors.primary} />
        <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Bizim Bahçe')}</T>
        {streak > 1 && <Muted style={{ fontSize: 13 }}>{streak} gün üst üste</Muted>}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: mood === 'ok' ? t.colors.successSoft : t.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Animated.Text
            style={{
              fontSize: 54,
              transform: [{ scale: pop }, { rotate: mood === 'wilted' ? '-25deg' : mood === 'thirsty' ? '-10deg' : '0deg' }],
              opacity: mood === 'wilted' ? 0.45 : mood === 'thirsty' ? 0.75 : 1,
            }}
          >
            {stage.art}
          </Animated.Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: t.colors.text, fontSize: 20, fontWeight: '700', fontFamily: t.fonts.display }}>{stage.name}</Text>
          <Muted style={{ fontSize: 13 }}>{stage.line}</Muted>
          {next && (
            <>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.border, overflow: 'hidden', marginTop: 4 }}>
                <View
                  style={{
                    width: `${Math.round(((g.growth - stageOf(g.growth).stage.at) / (next.at - stageOf(g.growth).stage.at)) * 100)}%`,
                    height: 6,
                    backgroundColor: t.colors.primary,
                  }}
                />
              </View>
              <Muted style={{ fontSize: 12 }}>
                {next.name} için {toNext} gün birlikte sulama
              </Muted>
            </>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Drop label="Sen" done={me} />
        <Drop label={partnerName} done={them} />
      </View>
      <Muted style={{ textAlign: 'center' }}>{msg || status}</Muted>
      {!me && <Button label="Sula 💧" busy={busy} onPress={water} />}
    </Card>
  );
}

function Drop({ label, done }: { label: string; done: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: done ? t.colors.primarySoft : t.colors.card,
        borderWidth: 1,
        borderColor: done ? t.colors.primary : t.colors.border,
      }}
    >
      <Ionicons name={done ? 'water' : 'water-outline'} size={16} color={done ? t.colors.primary : t.colors.muted} />
      <Text style={{ color: done ? t.colors.primary : t.colors.muted, fontFamily: t.fonts.body, fontSize: 13 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
