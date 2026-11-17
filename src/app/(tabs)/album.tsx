import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { handFont, inkColor, Polaroid } from '../../components/Polaroid';
import { Card, Loading, Muted, Screen, Title } from '../../components/ui';
import { dayKey, prettyDate } from '../../lib/date';
import { AddTaskPhoto, EditPhotoNote, MissingPhotoDays } from '../../components/AddTaskPhoto';
import { useDays } from '../../lib/archive';
import { DeleteRequest } from '../../components/DeleteRequest';
import { removeFromAlbum } from '../../lib/chat';
import { useMyOrders } from '../../lib/orders';
import { usePhotos, type Photo } from '../../lib/photos';
import { FREE, openPlus, usePlus } from '../../lib/plus';
import { useTrips, type Trip } from '../../lib/trips';
import { TripCover } from '../../components/TripCover';
import { router } from 'expo-router';
import { useSession } from '../../lib/session';
import { taskById, taskTitle } from '../../lib/tasks';
import type { Lang } from '../../lib/i18n';
import { useTheme } from '../../lib/useTheme';

type Page =
  | { kind: 'date'; day: string; photo: Photo }
  | { kind: 'task'; day: string; mine?: Photo; theirs?: Photo }
  | { kind: 'moment'; day: string; photo: Photo }
  | { kind: 'trip'; day: string; trip: Trip };

type Filter = 'all' | 'tasks' | 'moments' | 'trips';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'tasks', label: 'Görevler' },
  { key: 'moments', label: 'Anılar' },
  { key: 'trips', label: 'Seyahatler' },
];
const ORDER = { trip: -1, date: 0, task: 1, moment: 2 };

export default function Album() {
  const t = useTheme();
  const { user, couple, partnerName, profile } = useSession();
  const photos = usePhotos(couple?.id);
  const trips = useTrips(couple?.id);
  const plus = usePlus();
  const [filter, setFilter] = useState<Filter>('all');
  const [removing, setRemoving] = useState<string | null>(null);
  // Geçmiş bir günde kendi fotoğrafını eklememiş kişi, boş polaroidine basılı tutarak sonradan ekler.
  const [adding, setAdding] = useState<{ day: string; taskId: string } | null>(null);
  const [editing, setEditing] = useState<Photo | null>(null);
  // Fotoğrafsız günler listesi yalnızca açılınca yüklenir.
  const [showMissing, setShowMissing] = useState(false);
  const days = useDays(showMissing ? couple?.id : undefined, 60);

  // Fotoğrafları günlere göre sayfalara ayırır: date selfiesi kendi sayfası, görev selfieleri yan yana.
  const pages = useMemo<Page[]>(() => {
    if (!photos || !user) return [];
    const out: Page[] = [];
    const byDay = new Map<string, { mine?: Photo; theirs?: Photo }>();
    for (const p of photos) {
      if (p.kind === 'date' || p.kind === 'moment') {
        out.push({ kind: p.kind, day: p.day, photo: p });
        continue;
      }
      const slot = byDay.get(p.day) ?? {};
      if (p.uid === user.uid) slot.mine = p;
      else slot.theirs = p;
      byDay.set(p.day, slot);
    }
    byDay.forEach((v, day) => out.push({ kind: 'task', day, ...v }));
    for (const trip of trips ?? []) out.push({ kind: 'trip', day: trip.end, trip });
    // Aynı gün önce date, sonra görev, sonra anılar.
    return out.sort((a, b) => (a.day === b.day ? ORDER[a.kind] - ORDER[b.kind] : a.day < b.day ? 1 : -1));
  }, [photos, trips, user]);

  const shown = pages.filter((p) =>
    filter === 'all'
      ? true
      : filter === 'moments'
        ? p.kind === 'moment'
        : filter === 'trips'
          ? p.kind === 'trip'
          : p.kind === 'task' || p.kind === 'date',
  );

  if (photos === null) return <Loading />;
  const myName = profile?.name ?? 'Sen';
  const nameOf = (uid?: string) => (uid === user?.uid ? myName : partnerName);

  return (
    <Screen>
      <Title>{t.copy.tabs.album}</Title>
      <Muted>
        {pages.length > 0
          ? `${photos.length} anı · ${partnerName} ile hikayeniz`
          : 'Görevleri selfieyle tamamladıkça anılarınız burada polaroid olarak birikecek.'}
      </Muted>

      {pages.length === 0 && filter === 'all' && (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="images-outline" size={34} color={t.colors.primary} />
          <Muted style={{ textAlign: 'center' }}>İlk polaroidiniz bugünün görevinden gelecek.</Muted>
        </Card>
      )}

      {
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderRadius: 20,
                backgroundColor: filter === f.key ? t.colors.primary : t.colors.card,
                borderWidth: 1,
                borderColor: filter === f.key ? t.colors.primary : t.colors.border,
              }}
            >
              <Text
                maxFontSizeMultiplier={1.25}
                style={{ color: filter === f.key ? t.colors.onPrimary : t.colors.text, fontWeight: '600', fontFamily: t.fonts.button }}
              >
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      }

      <Pressable
        onPress={() => router.push('/album-builder')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderRadius: t.radius.card,
          backgroundColor: t.colors.primary,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name="book" size={26} color={t.colors.onPrimary} />
        <View style={{ flex: 1 }}>
          <Text
            maxFontSizeMultiplier={1.25}
            style={{ color: t.colors.onPrimary, fontSize: 16, fontWeight: '700', fontFamily: t.fonts.button }}
          >
            Albümünü bastır
          </Text>
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.onPrimary, opacity: 0.9, fontSize: 13 }}>
            Anılarınız gerçek bir albüm olsun: 21×21 ya da A4
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={t.colors.onPrimary} />
      </Pressable>
      <OrdersLink />
      <Pressable
        onPress={() => setShowMissing((v) => !v)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 2 }}
      >
        <Ionicons name={showMissing ? 'chevron-up' : 'camera-outline'} size={16} color={t.colors.primary} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600', fontFamily: t.fonts.button }}>
          {showMissing ? 'Fotoğrafsız günleri gizle' : 'Geçmiş günlere fotoğraf ekle'}
        </Text>
      </Pressable>
      {showMissing && couple && user && (
        <MissingPhotoDays
          coupleId={couple.id}
          uid={user.uid}
          days={days}
          havePhoto={new Set((photos ?? []).filter((p) => p.kind === 'task' && p.uid === user.uid).map((p) => p.day))}
          today={dayKey()}
          onPick={(day, taskId) => setAdding({ day, taskId })}
        />
      )}

      {(filter === 'all' || filter === 'trips') && (
        <Pressable
          onPress={() => (!plus.active && (trips?.length ?? 0) >= FREE.trips ? openPlus('trip') : router.push('/trip/new'))}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: t.colors.primary,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="airplane-outline" size={18} color={t.colors.primary} />
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600', fontFamily: t.fonts.button }}>
            Seyahat albümü oluştur
          </Text>
        </Pressable>
      )}

      {shown.length === 0 && filter !== 'all' && (
        <Muted style={{ textAlign: 'center', paddingVertical: 20 }}>
          {filter === 'moments'
            ? 'Mesajlarda bir fotoğrafa uzun basıp "Albüme ekle" dediğinde burada anı olarak görünür.'
            : filter === 'trips'
              ? 'Tatilde çektiğiniz fotoğraflar için bir seyahat albümü oluşturun.'
              : 'Henüz görev fotoğrafı yok.'}
        </Muted>
      )}

      {shown.map((page) =>
        page.kind === 'trip' ? (
          <TripCover key={`trip-${page.trip.id}`} trip={page.trip} coupleId={couple!.id} />
        ) : (
          <Pressable
            key={page.kind === 'task' ? `task-${page.day}` : page.photo.id}
            onLongPress={page.kind === 'moment' ? () => setRemoving(page.photo.id) : undefined}
            delayLongPress={400}
            style={{ backgroundColor: '#FBF7F2', borderRadius: 6, paddingVertical: 22, paddingHorizontal: 16, gap: 16 }}
          >
            {page.kind === 'moment' ? (
              <>
                <View style={{ alignItems: 'center' }}>
                  <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: handFont, fontSize: 18, color: '#5E8C7A' }}>
                    {page.photo.taskId ? 'Bonus görev' : 'Anı'}
                  </Text>
                  {!!page.photo.taskId && (
                    <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 12, color: '#8A7F78', textAlign: 'center' }}>
                      {taskTitle(taskById(page.photo.taskId), t.lang)}
                    </Text>
                  )}
                </View>
                <Polaroid
                  photo={page.photo}
                  name={`${nameOf(page.photo.from)} çekti`}
                  aspect={3 / 4}
                  tilt={1.5}
                  style={{ alignSelf: 'center', width: '74%' }}
                />
                <DeleteRequest
                  kind="moment"
                  id={page.photo.messageId ?? page.photo.id.replace(/^moment_/, '')}
                  label="Albümdeki bir anı"
                  url="/album"
                  open={removing === page.photo.id}
                  onClose={() => setRemoving(null)}
                  doDelete={() => removeFromAlbum(couple!.id, page.photo.messageId ?? page.photo.id.replace(/^moment_/, ''))}
                />
              </>
            ) : page.kind === 'date' ? (
              <>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: handFont, fontSize: 18, color: '#E8516A' }}>
                    Date günü
                  </Text>
                </View>
                <Polaroid photo={page.photo} name={`${myName} & ${partnerName}`} aspect={4 / 3} tilt={-1} />
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  {page.mine ? (
                    <Pressable
                      style={{ flex: 1 }}
                      delayLongPress={350}
                      onLongPress={() => setEditing(page.mine!)}
                      accessibilityLabel="Notu düzenlemek için basılı tut"
                    >
                      <Polaroid photo={page.mine} name={myName} tilt={-3} noteHint="basılı tut, not ekle" />
                    </Pressable>
                  ) : (
                    <Pressable
                      style={{ flex: 1 }}
                      delayLongPress={350}
                      onLongPress={() => setAdding({ day: page.day, taskId: (page.theirs?.taskId ?? '') as string })}
                      accessibilityLabel="Fotoğrafını eklemek için basılı tut"
                    >
                      <Polaroid photo={undefined} name={myName} tilt={-3} empty={'basılı tut,\nfotoğrafını ekle'} />
                    </Pressable>
                  )}
                  <Polaroid style={{ flex: 1, marginTop: 12 }} photo={page.theirs} name={partnerName} tilt={2.5} />
                </View>
                <Text
                  maxFontSizeMultiplier={1.25}
                  style={{ fontFamily: handFont, fontSize: 25, lineHeight: 28, color: inkColor, textAlign: 'center' }}
                >
                  {pageTaskTitle(page, t.lang)}
                </Text>
              </>
            )}
            <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 12, color: '#9C8C87', textAlign: 'center', marginTop: -10 }}>
              {prettyDate(page.day)}
            </Text>
          </Pressable>
        ),
      )}
      {editing && couple && <EditPhotoNote photo={editing} coupleId={couple.id} name={myName} onClose={() => setEditing(null)} />}
      {adding && couple && user && (
        <AddTaskPhoto
          open
          onClose={() => setAdding(null)}
          coupleId={couple.id}
          uid={user.uid}
          name={myName}
          day={adding.day}
          fallbackTaskId={adding.taskId}
        />
      )}
    </Screen>
  );
}

// Ortak görevde iki fotoğrafın görevi aynıdır; ayrı görevlerde ikisi de yazılır.
function pageTaskTitle(page: Extract<Page, { kind: 'task' }>, lang: Lang): string {
  const a = page.mine?.taskId;
  const b = page.theirs?.taskId;
  if (a && b && a !== b) return `${taskTitle(taskById(a), lang)} · ${taskTitle(taskById(b), lang)}`;
  return taskTitle(taskById((a ?? b)!), lang);
}

// Siparişi olan çift için Siparişler bağlantısı.
function OrdersLink() {
  const t = useTheme();
  const { couple } = useSession();
  const orders = useMyOrders(couple?.id);
  const open = (orders ?? []).filter((o) => o.status !== 'teslim' && o.status !== 'iptal' && o.status !== 'talep').length;
  if (!(orders ?? []).length) return null;
  return (
    <Pressable
      onPress={() => router.push('/orders')}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 2 }}
    >
      <Ionicons name="cube-outline" size={16} color={t.colors.primary} />
      <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600', fontFamily: t.fonts.button }}>
        {open ? 'Siparişiniz yolda · durumu gör' : 'Siparişlerim'}
      </Text>
    </Pressable>
  );
}
