import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { Card, Muted, Screen, T } from '../../components/ui';
import { photoUri, usePhotos } from '../../lib/photos';
import { attachPhoto, usePages, type Scene } from '../../lib/scenes';
import { useSession } from '../../lib/session';
import { useTheme } from '../../lib/useTheme';

// Hayal defteri: birlikte yaşanan her sahne bir sayfa. Tarih, yer, iki avatar, cevaplar, istenirse albümden fotoğraf.
// Sayfalar baskı albüme "Hayalimizin hikâyesi" bölümü olarak girer.

const WORLD = {
  farm: { name: 'Bizim Çiftlik', color: '#8BC34F' },
  sea: { name: 'Mavi Yolculuk', color: '#4FA8D8' },
  home: { name: 'Sahilde Ev', color: '#E99AB8' },
};
export const SCENE_NAMES: Record<string, string> = {
  swim: 'Yüzme',
  dinner: 'Akşam yemeği',
  camp: 'Kamp',
  sunset: 'Gün batımı',
  coffee_sea: 'Sabah kahvesi',
  coffee: 'Sabah kahvesi',
  beach: 'Deniz günü',
  bike: 'Bisiklet turu',
  bbq: 'Mangal akşamı',
  stars: 'Yıldızlar',
  harvest: 'Hasat günü',
  market: 'Pazar',
};

export default function BookScreen() {
  const t = useTheme();
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const pages = usePages(couple?.id);
  const photos = usePhotos(couple?.id, 30);
  const [picking, setPicking] = useState<string | null>(null);
  const byId = useMemo(() => new Map((photos ?? []).map((p) => [p.id, p])), [photos]);
  if (!user || !couple || !partnerId) return null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/dreams'));
  const fmt = (ms: number) => new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Geri">
          <Ionicons name="chevron-back" size={28} color={t.colors.text} />
        </Pressable>
        <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontFamily: t.fonts.title, fontSize: 30, color: t.colors.text }}>
          Hayal defteri
        </Text>
        <Muted>{pages?.length ?? 0} sayfa</Muted>
      </View>
      {pages === null && <Muted>Yükleniyor…</Muted>}
      {pages?.length === 0 && (
        <Card>
          <T>Henüz sayfa yok.</T>
          <Muted>Birlikte yaşadığınız ilk sahne (bir gün batımı, bir sabah kahvesi) burada ilk sayfa olacak.</Muted>
        </Card>
      )}
      {pages?.map((s: Scene) => {
        const w = WORLD[s.world];
        const photo = s.photo ? byId.get(s.photo) : undefined;
        return (
          <Card key={s.id} style={{ gap: 8, borderLeftWidth: 4, borderLeftColor: w.color }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <T style={{ fontWeight: '700' }}>
                  {SCENE_NAMES[s.kind] ?? s.kind} · {s.place}
                </T>
                <Muted style={{ fontSize: 12 }}>
                  {w.name} · {fmt(s.startedAt)}
                </Muted>
              </View>
              <Avatar p={profile} name="" size={28} showMood={false} />
              <View style={{ marginLeft: -10 }}>
                <Avatar p={partnerProfile} name={partnerName} size={28} showMood={false} />
              </View>
            </View>
            {photo && <Image source={{ uri: photoUri(photo) }} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} />}
            {s.question && (
              <View style={{ gap: 4 }}>
                <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: t.fonts.note, fontSize: 20, color: t.colors.text }}>
                  {s.question}
                </Text>
                {[user.uid, partnerId].map((id) =>
                  s.answers?.[id] ? (
                    <Text maxFontSizeMultiplier={1.25} key={id} style={{ color: t.colors.text, fontSize: 14 }}>
                      <Text maxFontSizeMultiplier={1.25} style={{ fontWeight: '700' }}>
                        {id === user.uid ? (profile?.name ?? 'Sen') : partnerName}:
                      </Text>{' '}
                      {s.answers[id]}
                    </Text>
                  ) : null,
                )}
              </View>
            )}
            {picking === s.id ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                <Pressable
                  onPress={() => {
                    attachPhoto(couple.id, s.id, null).catch(() => {});
                    setPicking(null);
                  }}
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    backgroundColor: t.colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="close" size={22} color={t.colors.muted} />
                </Pressable>
                {(photos ?? []).map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      attachPhoto(couple.id, s.id, p.id).catch(() => {});
                      setPicking(null);
                    }}
                  >
                    <Image source={{ uri: photoUri(p) }} style={{ width: 64, height: 64, borderRadius: 10 }} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Pressable onPress={() => setPicking(s.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="image-outline" size={16} color={t.colors.primary} />
                <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontSize: 13, fontWeight: '600' }}>
                  {photo ? 'Fotoğrafı değiştir' : 'Albümden fotoğraf ekle'}
                </Text>
              </Pressable>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
