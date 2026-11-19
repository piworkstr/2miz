import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { CROPS, MIN, RECIPES, farmOf, type Farm } from './farm';
import type { Couple } from './session';

// Hasat hatırlatması: çiftlikten çıkınca telefonda kurulan yerel bildirim. Sunucu yok; çiftlik her değiştiğinde yeniden kurulur.
// En çok iki bildirim: ekinlerin tamamı olgunlaşınca bir tane, mutfaktaki işler bitince bir tane (art arda bildirim yağmaz).
const KEY = 'biriz.farmRemind';
let on = true;
let loaded = false;
const listeners = new Set<(v: boolean) => void>();

async function load() {
  if (!loaded) {
    on = (await AsyncStorage.getItem(KEY).catch(() => null)) !== 'off';
    loaded = true;
  }
  return on;
}

async function clearAll() {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith('farm-'))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

export async function setFarmRemind(v: boolean) {
  on = v;
  loaded = true;
  await AsyncStorage.setItem(KEY, v ? 'on' : 'off').catch(() => {});
  if (!v) await clearAll();
  listeners.forEach((f) => f(v));
}

export function useFarmRemind(): boolean {
  const [v, setV] = useState(on);
  useEffect(() => {
    load().then(setV);
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}

const DAY = 24 * 60 * MIN;

// Kurulacak bildirimler (saf işlev; sınanabilir).
export function farmReminders(f: Farm, now: number): { id: string; at: number; title: string; body: string }[] {
  const out: { id: string; at: number; title: string; body: string }[] = [];
  const crops = f.tiles.flatMap((t) => (t.k === 'crop' && t.ready > now ? [t] : []));
  if (crops.length) {
    const at = Math.max(...crops.map((t) => t.ready));
    const kinds = [...new Set(crops.map((t) => CROPS[t.crop].name.toLowerCase()))];
    const what = kinds.length > 2 ? `${kinds.slice(0, 2).join(', ')} ve diğerleri` : kinds.join(' ve ');
    if (at - now > 2 * MIN && at - now < 2 * DAY)
      out.push({
        id: 'farm-crop',
        at,
        title: '🌾 Ekinlerin hazır',
        body: `Tarladaki ${what} olgunlaştı. Partnerin toplamadıysa seni bekliyor.`,
      });
  }
  const jobs = (f.prod ?? []).filter((j) => j.ready > now);
  if (jobs.length) {
    const at = Math.max(...jobs.map((j) => j.ready));
    const names = [...new Set(jobs.map((j) => RECIPES[j.recipe]?.name.toLowerCase()).filter(Boolean))];
    if (at - now > 2 * MIN && at - now < 2 * DAY)
      out.push({
        id: 'farm-prod',
        at,
        title: '🍞 Üretim bitti',
        body: `${names.slice(0, 2).join(' ve ') || 'Ürünlerin'} hazır. Partnerin almadıysa seni bekliyor.`,
      });
  }
  return out;
}

async function schedule(f: Farm) {
  try {
    await clearAll();
    if (!(await load())) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    const now = Date.now();
    for (const r of farmReminders(f, now)) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, data: { type: 'farm', url: '/garden' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.at) },
      });
    }
  } catch {
    // Expo Go ya da izin yok
  }
}

// Çiftlik her değiştiğinde (ben ya da partner) hatırlatma yeniden kurulur; kısa bir beklemeyle, art arda işlerde tek kez.
export function useFarmReminder(couple: Couple | null | undefined) {
  const enabled = useFarmRemind();
  const farm = couple ? farmOf(couple) : null;
  const sig = farm
    ? `${farm.tiles.reduce((a, t) => (t.k === 'crop' ? a + t.ready : a), 0)}:${(farm.prod ?? []).map((j) => j.ready).join(',')}`
    : '';
  useEffect(() => {
    if (!farm) return;
    const h = setTimeout(() => void schedule(farm), 3000);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, enabled]);
}
