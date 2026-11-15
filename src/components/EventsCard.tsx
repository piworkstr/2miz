import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { citySlug, loadIndex, type EventIndex } from '../lib/events';
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
  const cities = index?.cities ?? {};
  const total = (c?: { n?: number; auto?: number }) => (c?.n ?? 0) + (c?.auto ?? 0);
  const any = Object.values(cities).some((c) => total(c) > 0);
  if (!couple || !any) return null;

  const mine = couple.city ? total(cities[citySlug(couple.city)]) : 0;
  const line = !couple.city
    ? 'Şehrinizi seçin; konser, tiyatro ve gösterileri birlikte date planlayın'
    : mine
      ? `${couple.city}: ${mine} etkinlik · birini seçip date planlayın`
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
