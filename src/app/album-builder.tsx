import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Button, Muted } from '../components/ui';
import { loadAlbumInput, saveAlbumRequest } from '../lib/albumData';
import { albumPreviewHtml } from '../lib/albumHtml';
import { buildAlbum, PAGE_STEP, type AlbumInput, type AlbumOptions, type AlbumSize } from '../lib/albumLayout';
import { dayKey } from '../lib/date';
import { useSession } from '../lib/session';
import { useTrips } from '../lib/trips';
import { useTheme } from '../lib/useTheme';

type Period = '3m' | '6m' | '1y' | 'all' | `trip:${string}`;
const PERIODS: { key: Period; label: string; months?: number }[] = [
  { key: '3m', label: 'Son 3 ay', months: 3 },
  { key: '6m', label: 'Son 6 ay', months: 6 },
  { key: '1y', label: 'Son 1 yıl', months: 12 },
  { key: 'all', label: 'Tümü' },
];
const THEMES = [
  { key: 'polaroid', label: 'Polaroid Klasik', ready: true },
  { key: 'kraft', label: 'Kraft', ready: false },
  { key: 'minimal', label: 'Minimal', ready: false },
  { key: 'ask', label: 'Aşk Mektubu', ready: false },
];
// Bu sayfalar albümün iskeleti; çıkarılamaz.
const FIXED = new Set(['cover', 'opening', 'stats', 'end']);

// Albüm oluşturucu: dönem, boyut, tema seç; sayfa sayfa önizle, istemediğini çıkar, baskı talebi bırak.
// Önizlemede indirme ya da paylaşma yok: baskı yalnızca biz üzerinden yapılır.
export default function AlbumBuilder() {
  const t = useTheme();
  const { user, couple, profile, partnerProfile, partnerId, partnerName } = useSession();
  const trips = useTrips(couple?.id);
  const [period, setPeriod] = useState<Period>('3m');
  const [size, setSize] = useState<AlbumSize>('21x21');
  const [exclude, setExclude] = useState<string[]>([]);
  const [input, setInput] = useState<AlbumInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [tapped, setTapped] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const range = useMemo(() => {
    if (period.startsWith('trip:')) return { kind: 'trip' as const, tripId: period.slice(5) };
    const months = PERIODS.find((p) => p.key === period)?.months;
    const from = new Date();
    if (months) from.setMonth(from.getMonth() - months);
    return { kind: 'period' as const, from: months ? dayKey(from) : couple?.startDate ?? '2000-01-01', to: dayKey() };
  }, [period, couple?.startDate]);

  useEffect(() => {
    if (!couple || !user || !partnerId) return;
    let alive = true;
    setLoading(true);
    setExclude([]);
    const people: AlbumInput['people'] = [
      { uid: user.uid, name: profile?.name ?? 'Sen', avatar: profile?.avatar },
      { uid: partnerId, name: partnerName, avatar: partnerProfile?.avatar },
    ];
    const from = range.kind === 'period' ? range.from : '0000';
    const to = range.kind === 'period' ? range.to : '9999';
    loadAlbumInput(couple.id, people, couple.startDate, from, to, range.kind === 'trip' ? range.tripId : undefined)
      .then((i) => alive && setInput(i))
      .catch(() => alive && setInput(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [couple?.id, user?.uid, partnerId, JSON.stringify(range)]); // eslint-disable-line react-hooks/exhaustive-deps

  const opts: AlbumOptions = { size, theme: 'polaroid', range, exclude };
  const plan = useMemo(() => (input ? buildAlbum(input, opts) : null), [input, size, exclude.join(','), JSON.stringify(range)]); // eslint-disable-line react-hooks/exhaustive-deps
  const html = useMemo(() => (plan && input ? albumPreviewHtml(plan, input, size) : ''), [plan, input, size]);

  async function request() {
    if (!couple || !user || !plan || busy) return;
    setBusy(true);
    try {
      await saveAlbumRequest(couple.id, user.uid, opts, plan.pages.length);
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean, disabled = false) => ({
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: on ? t.colors.primary : t.colors.border,
    backgroundColor: on ? t.colors.primary : t.colors.card,
    opacity: disabled ? 0.45 : 1,
  });
  const chipText = (on: boolean) => ({ fontSize: 13, fontWeight: '600' as const, color: on ? t.colors.onPrimary : t.colors.text });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={t.colors.text} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: t.colors.text }}>Albümünü oluştur</Text>
      </View>

      <View style={{ gap: 8, paddingBottom: 6 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {PERIODS.map((p) => (
            <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={chip(period === p.key)}>
              <Text style={chipText(period === p.key)}>{p.label}</Text>
            </Pressable>
          ))}
          {(trips ?? []).map((tr) => {
            const k = `trip:${tr.id}` as Period;
            return (
              <Pressable key={k} onPress={() => setPeriod(k)} style={chip(period === k)}>
                <Text style={chipText(period === k)}>✈ {tr.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {(['21x21', 'A4'] as AlbumSize[]).map((s) => (
            <Pressable key={s} onPress={() => setSize(s)} style={chip(size === s)}>
              <Text style={chipText(size === s)}>{s === '21x21' ? '21×21 cm kare' : 'A4 dikey'}</Text>
            </Pressable>
          ))}
          <View style={{ width: 1, backgroundColor: t.colors.border, marginHorizontal: 4 }} />
          {THEMES.map((th) => (
            <View key={th.key} style={chip(th.key === 'polaroid', !th.ready)}>
              <Text style={chipText(th.key === 'polaroid')}>
                {th.label}
                {th.ready ? '' : ' · yakında'}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {loading || !plan ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <ActivityIndicator color={t.colors.primary} />
            <Muted>Albümünüz diziliyor…</Muted>
          </View>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={{ flex: 1, backgroundColor: 'transparent' }}
            scrollEnabled={false}
            allowsLinkPreview={false}
            textInteractionEnabled={false}
            onMessage={(e) => {
              try {
                const m = JSON.parse(e.nativeEvent.data) as { type: string; id?: string; index?: number };
                if (m.type === 'tap' && m.id && !FIXED.has(m.id) && !m.id.startsWith('notes-')) setTapped(m.id);
                if (m.type === 'page' && typeof m.index === 'number') setPage(m.index);
              } catch {
                // yok say
              }
            }}
          />
        )}
      </View>

      {plan && (
        <View style={{ padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: t.colors.border, backgroundColor: t.colors.card }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '700', color: t.colors.text }}>
              {plan.pages.length} sayfa
              <Text style={{ fontWeight: '400', color: t.colors.muted }}>
                {' '}
                · {page === 0 ? 'kapak' : `${page}. sayfa`}
              </Text>
            </Text>
            {exclude.length > 0 && (
              <Pressable onPress={() => setExclude([])} hitSlop={8}>
                <Text style={{ color: t.colors.primary, fontWeight: '600', fontSize: 13 }}>{exclude.length} sayfayı geri al</Text>
              </Pressable>
            )}
          </View>
          <Muted style={{ fontSize: 12 }}>
            {plan.contentPages} anı sayfası
            {plan.fillers > 0 ? ` · ${plan.fillers} not sayfası (baskı ${PAGE_STEP}'ün katı olduğu için)` : ''}. Çıkarmak istediğin sayfaya dokun.
          </Muted>
          {plan.tooFew && (
            <Muted style={{ fontSize: 12, color: t.colors.primary }}>
              Bu dönemde anı az; albüm çoğunlukla not sayfalarından oluşur. Daha uzun bir dönem seç ya da birkaç gün daha görev yapın.
            </Muted>
          )}
          {plan.tooMany && (
            <Muted style={{ fontSize: 12, color: t.colors.primary }}>Albüm en fazla 100 sayfa olabilir; son anılar sığmadı. Dönemi kısalt.</Muted>
          )}
          {sent ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: t.colors.successSoft }}>
              <Ionicons name="checkmark-circle" size={22} color={t.colors.success} />
              <Text style={{ flex: 1, color: t.colors.text }}>Baskı talebin alındı. Sipariş ve ödeme çok yakında; hazır olunca haber vereceğiz.</Text>
            </View>
          ) : (
            <Button label="Baskı talebi bırak" onPress={request} busy={busy} />
          )}
        </View>
      )}

      <Modal visible={!!tapped} transparent animationType="fade" onRequestClose={() => setTapped(null)}>
        <Pressable onPress={() => setTapped(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: t.colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 10 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: t.colors.text }}>Bu sayfa albümde olmasın mı?</Text>
            <Muted style={{ fontSize: 13 }}>Sayfa sadece bu albümden çıkar, fotoğraflar silinmez. Sayfa sayısı yine 4'ün katına tamamlanır.</Muted>
            <Button
              label="Albümden çıkar"
              onPress={() => {
                if (tapped) setExclude((x) => [...x, tapped]);
                setTapped(null);
              }}
            />
            <Button label="Vazgeç" variant="secondary" onPress={() => setTapped(null)} />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
