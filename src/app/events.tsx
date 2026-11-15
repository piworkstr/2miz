import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, Loading, Muted, Screen, T, Title } from '../components/ui';
import { addEvent } from '../lib/calendar';
import { trMonth } from '../lib/date';
import { planDateFor, useUpcomingDates } from '../lib/dates';
import { CITIES, EVENT_CATS, loadCityEvents, safeUrl, type CityEvent, type EventCat } from '../lib/events';
import { db } from '../lib/firebase';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { usageFields } from '../lib/usage';
import { useTheme } from '../lib/useTheme';

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const dayLabel = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${trMonth(m - 1)} ${DAYS[new Date(y, m - 1, d).getDay()]}`;
};

// Şehrinizde bu ay: seçilen ildeki etkinlikler. Biri seçilip tek dokunuşla date olarak planlanır ya da ortak takvime eklenir;
// bilet sayfası dışarıda açılır.
export default function Events() {
  const t = useTheme();
  const { user, couple, profile, partnerId } = useSession();
  const [items, setItems] = useState<CityEvent[] | null>(null);
  const [cat, setCat] = useState<EventCat | 'hepsi'>('hepsi');
  const [pick, setPick] = useState(false);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [dated, setDated] = useState<Record<string, boolean>>({});
  // Daha önce date olarak planlananlar ekrana yeniden girince de işaretli gelsin (ana ekranla aynı dinleme).
  const dates = useUpcomingDates(couple?.id);
  const isDated = (e: CityEvent) => !!dated[e.id] || dates.some((d) => d.id === e.day && !!d.what?.startsWith(e.title));
  const city = couple?.city;

  useEffect(() => {
    if (!city) return;
    setItems(null);
    loadCityEvents(city)
      .then(setItems)
      .catch(() => setItems([]));
  }, [city]);

  // Tür bilgisi eklenmeden önce planlanmış date'lere türü sonradan yaz (takvimde simge çıksın).
  useEffect(() => {
    if (!couple?.id || !items) return;
    for (const d of dates) {
      if (d.cat || !d.what) continue;
      const e = items.find((x) => x.day === d.id && d.what!.startsWith(x.title));
      if (e) updateDoc(doc(db, 'couples', couple.id, 'dates', d.id), { cat: e.cat }).catch(() => {});
    }
  }, [dates, items, couple?.id]);

  const cats = useMemo(() => [...new Set((items ?? []).map((e) => e.cat))], [items]);
  const shown = (items ?? []).filter((e) => cat === 'hepsi' || e.cat === cat);
  const days = [...new Set(shown.map((e) => e.day))];

  if (!user || !couple) return <Loading />;

  const choose = (name: string) => {
    setPick(false);
    setCat('hepsi');
    updateDoc(doc(db, 'couples', couple.id), { city: name, ...usageFields(['etkinlik']) }).catch(() => {});
  };
  const plan = async (e: CityEvent) => {
    if (added[e.id]) return;
    setAdded((m) => ({ ...m, [e.id]: true }));
    try {
      await addEvent(
        couple.id,
        { day: e.day, ...(e.time ? { time: e.time } : {}), title: e.title, owner: 'both', by: user.uid },
        { to: partnerId, fromName: profile?.name ?? '' },
      );
    } catch {
      setAdded((m) => ({ ...m, [e.id]: false }));
    }
  };

  // Date olarak planla: o güne date önerisi açılır (partner onaylar), etkinliğin adı date'in üstünde görünür.
  const date = async (e: CityEvent) => {
    if (isDated(e)) return;
    setDated((m) => ({ ...m, [e.id]: true }));
    try {
      await planDateFor(couple.id, e.day, user.uid, [e.title, e.time, e.venue].filter(Boolean).join(' · '), e.cat);
    } catch {
      setDated((m) => ({ ...m, [e.id]: false }));
    }
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15, fontFamily: t.fonts.body }}>
          {tx(t, 'Bugün')}
        </Text>
      </Pressable>
      <Title>Şehrinizde bu ay</Title>

      <Pressable onPress={() => setPick(true)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="location" size={20} color={t.colors.primary} />
          <T style={{ flex: 1, fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>{city ?? 'Şehrinizi seçin'}</T>
          <Muted>{city ? 'Değiştir' : 'Seç'}</Muted>
        </Card>
      </Pressable>

      {!city ? (
        <Muted>İkiniz için tek bir il seçilir. Konser, tiyatro ve gösterileri görür, beğendiğinizi ortak takvime eklersiniz.</Muted>
      ) : items === null ? (
        <Muted>Etkinlikler yükleniyor…</Muted>
      ) : !items.length ? (
        <Muted>{`${city} için liste henüz hazır değil. Yakında eklenecek; bu arada başka bir ile bakabilirsiniz.`}</Muted>
      ) : (
        <>
          {cats.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, flexShrink: 0 }}
              contentContainerStyle={{ gap: 8, alignItems: 'center' }}
            >
              {(['hepsi', ...cats] as const).map((c) => {
                const on = cat === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCat(c)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      alignSelf: 'flex-start',
                      borderRadius: t.radius.pill,
                      backgroundColor: on ? t.colors.primary : t.colors.primarySoft,
                    }}
                  >
                    <Text
                      maxFontSizeMultiplier={1.25}
                      style={{ color: on ? '#fff' : t.colors.primary, fontSize: 13, fontWeight: '600', fontFamily: t.fonts.button }}
                    >
                      {c === 'hepsi' ? 'Hepsi' : EVENT_CATS[c].label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {days.map((d) => (
            <View key={d} style={{ gap: 8 }}>
              <Muted style={{ fontWeight: '600' }}>{dayLabel(d)}</Muted>
              {shown
                .filter((e) => e.day === d)
                .map((e) => {
                  const url = safeUrl(e.url);
                  const c = EVENT_CATS[e.cat] ?? EVENT_CATS.diger;
                  return (
                    <Card key={e.id} style={{ gap: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                        <MaterialCommunityIcons
                          name={c.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                          size={22}
                          color={t.colors.primary}
                          style={{ marginTop: 1 }}
                        />
                        <View style={{ flex: 1, gap: 2 }}>
                          <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>{e.title}</T>
                          <Muted>{[c.label, e.time, e.venue].filter(Boolean).join(' · ')}</Muted>
                          {!!e.price && <Muted>{e.price}</Muted>}
                        </View>
                      </View>
                      {!!e.deal && (
                        <View
                          style={{ backgroundColor: t.colors.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}
                        >
                          <Text
                            maxFontSizeMultiplier={1.25}
                            style={{ color: t.colors.primary, fontSize: 13, fontWeight: '600', fontFamily: t.fonts.button }}
                          >
                            {`2miz'e özel: ${e.deal}`}
                          </Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Button
                          style={{ flex: 1 }}
                          variant={isDated(e) ? 'secondary' : 'primary'}
                          label={isDated(e) ? 'Date planlandı ✓' : 'Date planla'}
                          onPress={() => date(e)}
                        />
                        {!!url && (
                          <Button
                            style={{ flex: 1 }}
                            variant="secondary"
                            label="Bilet sayfası"
                            onPress={() => Linking.openURL(url).catch(() => {})}
                          />
                        )}
                      </View>
                      <Pressable onPress={() => plan(e)} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 2 }}>
                        <Muted style={{ fontSize: 13 }}>{added[e.id] ? 'Takvime eklendi ✓' : 'Yalnızca takvime ekle'}</Muted>
                      </Pressable>
                    </Card>
                  );
                })}
            </View>
          ))}
          <Muted style={{ fontSize: 12 }}>
            Tarih, saat ve fiyatlar değişebilir; bilet almadan önce satış sayfasından doğrulayın. Bilet satışı 2miz üzerinden yapılmaz.
          </Muted>
        </>
      )}

      <Modal visible={pick} animationType="slide" transparent onRequestClose={() => setPick(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={() => setPick(false)} />
        <View
          style={{ maxHeight: '70%', backgroundColor: t.colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 8 }}
        >
          <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>İl seçin</T>
          <ScrollView>
            {CITIES.map((name) => (
              <Pressable
                key={name}
                onPress={() => choose(name)}
                style={{ paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <T style={{ fontSize: 16 }}>{name}</T>
                {name === city && <Ionicons name="checkmark" size={20} color={t.colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </Screen>
  );
}
