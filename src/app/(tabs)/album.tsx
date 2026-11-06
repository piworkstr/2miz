import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { handFont, inkColor, Polaroid } from '../../components/Polaroid';
import { Card, Loading, Muted, Screen, Title } from '../../components/ui';
import { prettyDate } from '../../lib/date';
import { removeFromAlbum } from '../../lib/chat';
import { usePhotos, type Photo } from '../../lib/photos';
import { useSession } from '../../lib/session';
import { taskById } from '../../lib/tasks';
import { useTheme } from '../../lib/useTheme';

type Page =
  | { kind: 'date'; day: string; photo: Photo }
  | { kind: 'task'; day: string; mine?: Photo; theirs?: Photo }
  | { kind: 'moment'; day: string; photo: Photo };

type Filter = 'all' | 'tasks' | 'moments';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'tasks', label: 'Görevler' },
  { key: 'moments', label: 'Anılar' },
];
const ORDER = { date: 0, task: 1, moment: 2 };

export default function Album() {
  const t = useTheme();
  const { user, couple, partnerName, profile } = useSession();
  const photos = usePhotos(couple?.id);
  const [filter, setFilter] = useState<Filter>('all');
  const [removing, setRemoving] = useState<string | null>(null);

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
    // Aynı gün önce date, sonra görev, sonra anılar.
    return out.sort((a, b) => (a.day === b.day ? ORDER[a.kind] - ORDER[b.kind] : a.day < b.day ? 1 : -1));
  }, [photos, user]);

  const shown = pages.filter((p) => filter === 'all' || (filter === 'moments' ? p.kind === 'moment' : p.kind !== 'moment'));

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

      {pages.length === 0 && (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <Ionicons name="images-outline" size={34} color={t.colors.primary} />
          <Muted style={{ textAlign: 'center' }}>İlk polaroidiniz bugünün görevinden gelecek.</Muted>
        </Card>
      )}

      {pages.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 16,
                borderRadius: 20,
                backgroundColor: filter === f.key ? t.colors.primary : t.colors.card,
                borderWidth: 1,
                borderColor: filter === f.key ? t.colors.primary : t.colors.border,
              }}
            >
              <Text style={{ color: filter === f.key ? t.colors.onPrimary : t.colors.text, fontWeight: '600', fontFamily: t.fonts.button }}>
                {f.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {pages.length > 0 && shown.length === 0 && (
        <Muted style={{ textAlign: 'center', paddingVertical: 20 }}>
          {filter === 'moments'
            ? 'Mesajlarda bir fotoğrafa uzun basıp "Albüme ekle" dediğinde burada anı olarak görünür.'
            : 'Henüz görev fotoğrafı yok.'}
        </Muted>
      )}

      {shown.map((page) => (
        <Pressable
          key={page.kind === 'task' ? `task-${page.day}` : page.photo.id}
          onLongPress={page.kind === 'moment' ? () => setRemoving(page.photo.id) : undefined}
          delayLongPress={400}
          style={{ backgroundColor: '#FBF7F2', borderRadius: 6, paddingVertical: 22, paddingHorizontal: 16, gap: 16 }}
        >
          {page.kind === 'moment' ? (
            <>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontFamily: handFont, fontSize: 18, color: '#5E8C7A' }}>Anı</Text>
              </View>
              <Polaroid
                photo={page.photo}
                name={`${nameOf(page.photo.from)} çekti`}
                aspect={3 / 4}
                tilt={1.5}
                style={{ alignSelf: 'center', width: '74%' }}
              />
              {removing === page.photo.id && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      setRemoving(null);
                      removeFromAlbum(couple!.id, page.photo.messageId ?? page.photo.id.replace(/^moment_/, '')).catch(() => {});
                    }}
                    style={{ backgroundColor: '#C0392B', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Albümden çıkar</Text>
                  </Pressable>
                  <Pressable onPress={() => setRemoving(null)} style={{ borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#D9CCC6' }}>
                    <Text style={{ color: inkColor, fontWeight: '600' }}>Vazgeç</Text>
                  </Pressable>
                </View>
              )}
            </>
          ) : page.kind === 'date' ? (
            <>
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ fontFamily: handFont, fontSize: 18, color: '#E8516A' }}>Date günü</Text>
              </View>
              <Polaroid photo={page.photo} name={`${myName} & ${partnerName}`} aspect={4 / 3} tilt={-1} />
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Polaroid style={{ flex: 1 }} photo={page.mine} name={myName} tilt={-3} />
                <Polaroid style={{ flex: 1, marginTop: 12 }} photo={page.theirs} name={partnerName} tilt={2.5} />
              </View>
              <Text style={{ fontFamily: handFont, fontSize: 25, lineHeight: 28, color: inkColor, textAlign: 'center' }}>
                {taskTitle(page)}
              </Text>
            </>
          )}
          <Text style={{ fontSize: 12, color: '#9C8C87', textAlign: 'center', marginTop: -10 }}>{prettyDate(page.day)}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

// Ortak görevde iki fotoğrafın görevi aynıdır; ayrı görevlerde ikisi de yazılır.
function taskTitle(page: Extract<Page, { kind: 'task' }>): string {
  const a = page.mine?.taskId;
  const b = page.theirs?.taskId;
  if (a && b && a !== b) return `${taskById(a).title} · ${taskById(b).title}`;
  return taskById((a ?? b)!).title;
}
