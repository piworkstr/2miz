import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { useUpcomingDates } from '../lib/dates';
import { citySlug, loadCityEvents, loadIndex, type EventIndex } from '../lib/events';
import { db } from '../lib/firebase';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

// Ana ekranda "Şehrinizde bu ay": herhangi bir ilde etkinlik varsa görünür. Tek okuma (dizin), canlı dinleme yok.
export function EventsCard() {
  const t = useTheme();
  const { couple } = useSession();
  const [index, setIndex] = useState<EventIndex | null>(null);
  useEffect(() => {
    if (!couple?.id) return;
    loadIndex()
      .then(setIndex)
      .catch(() => setIndex({}));
  }, [couple?.id]);
  // Tür bilgisi eklenmeden önce etkinlikten planlanmış date'lere türü bir kez sonradan yazar (takvimde doğru simge çıksın).
  const dates = useUpcomingDates(couple?.id);
  const missing = dates
    .filter((d) => d.what && !d.cat)
    .map((d) => d.id)
    .join(',');
  useEffect(() => {
    if (!couple?.id || !couple.city || !missing) return;
    loadCityEvents(couple.city)
      .then((items) => {
        for (const d of dates) {
          if (d.cat || !d.what) continue;
          const e = items.find((x) => x.day === d.id && d.what!.startsWith(x.title));
          if (e) updateDoc(doc(db, 'couples', couple.id, 'dates', d.id), { cat: e.cat }).catch(() => {});
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, couple?.city, missing]);
  const cities = index?.cities ?? {};
  const total = (c?: { n?: number; auto?: number }) => (c?.n ?? 0) + (c?.auto ?? 0);
  const films = index?.films ?? 0;
  const any = films > 0 || Object.values(cities).some((c) => total(c) > 0);
  if (!couple || !any) return null;

  const mine = couple.city ? total(cities[citySlug(couple.city)]) : 0;
  const line = !couple.city
    ? 'Şehrinizi seçin; konser, tiyatro ve gösterileri birlikte date planlayın'
    : mine
      ? `${couple.city}: ${mine} etkinlik · birini seçip date planlayın`
      : films
        ? `Vizyonda ${films} film · birini seçip sinema date'i planlayın`
        : `${couple.city} için liste hazırlanıyor · başka bir ile de bakabilirsiniz`;

  return (
    <Pressable onPress={() => router.push('/events')} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: t.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="ticket" size={22} color={t.colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>Şehrinizde bu ay</T>
          <Muted>{line}</Muted>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.colors.muted} />
      </Card>
    </Pressable>
  );
}
