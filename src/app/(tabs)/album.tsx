import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { handFont, inkColor, Polaroid } from '../../components/Polaroid';
import { Card, Loading, Muted, Screen, Title } from '../../components/ui';
import { prettyDate } from '../../lib/date';
import { usePhotos, type Photo } from '../../lib/photos';
import { useSession } from '../../lib/session';
import { taskById } from '../../lib/tasks';
import { useTheme } from '../../lib/useTheme';

type Page =
  | { kind: 'date'; day: string; photo: Photo }
  | { kind: 'task'; day: string; mine?: Photo; theirs?: Photo };

export default function Album() {
  const t = useTheme();
  const { user, couple, partnerName, profile } = useSession();
  const photos = usePhotos(couple?.id);

  // Fotoğrafları günlere göre sayfalara ayırır: date selfiesi kendi sayfası, görev selfieleri yan yana.
  const pages = useMemo<Page[]>(() => {
    if (!photos || !user) return [];
    const out: Page[] = [];
    const byDay = new Map<string, { mine?: Photo; theirs?: Photo }>();
    for (const p of photos) {
      if (p.kind === 'date') {
        out.push({ kind: 'date', day: p.day, photo: p });
        continue;
      }
      const slot = byDay.get(p.day) ?? {};
      if (p.uid === user.uid) slot.mine = p;
      else slot.theirs = p;
      byDay.set(p.day, slot);
    }
    byDay.forEach((v, day) => out.push({ kind: 'task', day, ...v }));
    // Aynı gün date sayfası görev sayfasından önce gelsin.
    return out.sort((a, b) => (a.day === b.day ? (a.kind === 'date' ? -1 : 1) : a.day < b.day ? 1 : -1));
  }, [photos, user]);

  if (photos === null) return <Loading />;
  const myName = profile?.name ?? 'Sen';

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

      {pages.map((page) => (
        <View
          key={`${page.kind}-${page.day}`}
          style={{ backgroundColor: '#FBF7F2', borderRadius: 6, paddingVertical: 22, paddingHorizontal: 16, gap: 16 }}
        >
          {page.kind === 'date' ? (
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
        </View>
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
