import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { router } from 'expo-router';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';
import { BoredCard } from '../../components/BoredCard';
import { CoupleInfoCard, daysTogether } from '../../components/CoupleInfoCard';
import { DateCard } from '../../components/DateCard';
import { Polaroid } from '../../components/Polaroid';
import { SelfieCamera } from '../../components/SelfieCamera';
import { Button, Card, Display, ErrorText, Input, Loading, Muted, Pill, Screen, T, Title } from '../../components/ui';
import { completeTask, modeOf, POINTS, respond, useToday, type DayDoc } from '../../lib/daily';
import { dayKey, prettyDate, yesterdayKey } from '../../lib/date';
import { saveTaskPhoto, usePhotos } from '../../lib/photos';
import { useSession } from '../../lib/session';
import { categoryLabels, taskById, type Task } from '../../lib/tasks';
import { BONUS_POINTS, toggleFavorite } from '../../lib/archive';
import { finishOpenBonus } from '../../lib/daily';
import { notifyPartner } from '../../lib/push';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

type Panel = 'play' | 'bonus' | 'date' | null;

export default function Today() {
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const { day, key } = useToday(couple?.id, couple?.members);
  const t = useTheme();
  const [panel, setPanel] = useState<Panel>(null);

  if (!user || !couple || !partnerId || !day) return <Loading />;

  const uid = user.uid;
  const mode = modeOf(day, couple.members);
  const streakAlive = couple.lastCompleteDay === dayKey() || couple.lastCompleteDay === yesterdayKey();
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <Screen>
      <View style={{ gap: 2, marginTop: 4 }}>
        <Title>{t.copy.hello(profile?.name ?? '')}</Title>
        <Muted>
          {tx(t, t.copy.dateLine(prettyDate(key), partnerName))}
          {couple.startDate ? ` · ${daysTogether(couple.startDate)}. gününüz` : ''}
        </Muted>
      </View>

      <TodayStrip
        day={day}
        uid={uid}
        partnerId={partnerId}
        myName={profile?.name ?? 'Sen'}
        partnerName={partnerName}
        streak={streakAlive ? couple.streak : 0}
        points={couple.points}
      />

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Shortcut icon="game-controller-outline" label="Birlikte oyna" active={panel === 'play'} onPress={() => toggle('play')} />
        <Shortcut icon="color-wand-outline" label={t.copy.surpriseTitle} active={false} onPress={() => router.push('/wheel')} />
        <Shortcut icon="calendar-outline" label="Date" active={panel === 'date'} onPress={() => toggle('date')} />
      </View>
      {panel === 'play' && <BoredCard />}
      {panel === 'date' && (
        <Card>
          <DateCard mode="planner" />
        </Card>
      )}

      <DateCard mode="banner" />

      {mode === 'pending' ? (
        <PendingCard day={day} uid={uid} partnerName={partnerName} coupleId={couple.id} dayId={key} />
      ) : (
        <TaskCard
          day={day}
          uid={uid}
          partnerId={partnerId}
          partnerName={partnerName}
          shared={mode === 'shared'}
          coupleId={couple.id}
          members={couple.members}
          dayId={key}
        />
      )}

      <OpenBonusCard />


      <Pressable onPress={() => router.push('/archive')} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 }}>
        <Ionicons name="time-outline" size={16} color={t.colors.primary} />
        <Text style={{ color: t.colors.primary, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Görev arşivi ve favoriler')}</Text>
      </Pressable>

      <MemoryCorner />
      <CoupleInfoCard />
    </Screen>
  );
}

// İkinizin bugünkü durumu: kim görevi bitirdi, seri ve puan.
function TodayStrip(props: {
  day: DayDoc;
  uid: string;
  partnerId: string;
  myName: string;
  partnerName: string;
  streak: number;
  points: number;
}) {
  const t = useTheme();
  const { day, uid, partnerId } = props;
  const both = !!day.completions[uid] && !!day.completions[partnerId];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: t.colors.card,
        borderWidth: 1,
        borderColor: t.colors.border,
        borderRadius: t.radius.card,
        padding: 14,
      }}
    >
      <Person name={props.myName} done={!!day.completions[uid]} />
      <Ionicons name={both ? 'heart' : 'heart-outline'} size={22} color={t.colors.primary} />
      <Person name={props.partnerName} done={!!day.completions[partnerId]} />
      <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
        <Chip icon={t.id === 'asko' ? 'heart' : 'flame'} text={`${props.streak} ${t.copy.streak}`} />
        <Chip icon={t.id === 'asko' ? 'happy-outline' : 'star'} text={`${props.points} ${t.copy.points}`} />
      </View>
    </View>
  );
}

function Person({ name, done }: { name: string; done: boolean }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4, width: 58 }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: done ? t.colors.primary : t.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {done ? (
          <Ionicons name="checkmark" size={24} color={t.colors.onPrimary} />
        ) : (
          <Text style={{ color: t.colors.primary, fontWeight: '700', fontSize: 17 }}>{name.slice(0, 1).toLocaleUpperCase('tr-TR')}</Text>
        )}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 11, color: t.colors.muted, fontFamily: t.fonts.body }}>
        {done ? 'Tamam' : name}
      </Text>
    </View>
  );
}

function Chip({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={14} color={t.colors.primary} />
      <Text style={{ fontSize: 13, color: t.colors.text, fontWeight: '600', fontFamily: t.fonts.body }}>{tx(t, text)}</Text>
    </View>
  );
}

function Shortcut({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderRadius: t.radius.card,
        borderWidth: active ? 2 : 1,
        borderColor: active || pressed ? t.colors.primary : t.colors.border,
        backgroundColor: active ? t.colors.primarySoft : t.colors.card,
      })}
    >
      <Ionicons name={icon} size={24} color={t.colors.primary} />
      <Text
        numberOfLines={2}
        style={{ fontSize: 13, lineHeight: 16, fontWeight: '600', color: t.colors.text, fontFamily: t.fonts.button, textAlign: 'center' }}
      >
        {tx(t, label)}
      </Text>
    </Pressable>
  );
}

// Albümden her gün değişen bir anı ("12 gün önce"). Geçmiş anılara geri çağırır.
function MemoryCorner() {
  const t = useTheme();
  const { user, couple, partnerName, profile } = useSession();
  const photos = usePhotos(couple?.id, 30);
  if (!photos || !user) return null;
  const today = dayKey();
  const days = [...new Set(photos.filter((p) => p.day !== today).map((p) => p.day))];
  if (!days.length) return null;

  let h = 0;
  for (const c of today) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pick = days[h % days.length];
  const dayPhotos = photos.filter((p) => p.day === pick);
  const datePhoto = dayPhotos.find((p) => p.kind === 'date');
  const mine = dayPhotos.find((p) => p.kind === 'task' && p.uid === user.uid);
  const theirs = dayPhotos.find((p) => p.kind === 'task' && p.uid !== user.uid);
  const moment = !datePhoto && !mine && !theirs ? dayPhotos.find((p) => p.kind === 'moment') : undefined;
  const [y, m, d] = pick.split('-').map(Number);
  const now = new Date();
  const ago = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(y, m - 1, d).getTime()) / 86400000,
  );
  const taskId = (mine ?? theirs)?.taskId;
  const caption = datePhoto ? 'Date gününüz' : taskId ? taskById(taskId).title : moment ? 'Bir anı' : '';
  const myName = profile?.name ?? 'Sen';

  return (
    <Pressable onPress={() => router.push('/album')} style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Anı köşesi')}</T>
        <Muted style={{ fontSize: 13 }}>{ago === 1 ? 'Dün' : `${ago} gün önce`}</Muted>
      </View>
      <View style={{ backgroundColor: '#FBF7F2', borderRadius: 8, padding: 16, gap: 10 }}>
        {datePhoto ? (
          <Polaroid photo={datePhoto} name={`${myName} & ${partnerName}`} aspect={4 / 3} tilt={-1} />
        ) : moment ? (
          <Polaroid
            photo={moment}
            name={moment.from === user.uid ? myName : partnerName}
            aspect={3 / 4}
            tilt={1.5}
            style={{ alignSelf: 'center', width: '64%' }}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Polaroid style={{ flex: 1 }} photo={mine} name={myName} tilt={-3} />
            <Polaroid style={{ flex: 1, marginTop: 10 }} photo={theirs} name={partnerName} tilt={2.5} />
          </View>
        )}
        {!!caption && (
          <Text style={{ fontFamily: 'Caveat_500Medium', fontSize: 22, color: '#2B1D22', textAlign: 'center' }}>{caption}</Text>
        )}
      </View>
    </Pressable>
  );
}

function TaskTitle({ task, label }: { task: Task; label: string }) {
  const t = useTheme();
  const { couple } = useSession();
  const fav = !!couple?.favorites?.includes(task.id);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pill>{label}</Pill>
        <Muted style={{ fontSize: 12, flex: 1 }}>{tx(t, categoryLabels[task.category])}</Muted>
        {couple && (
          <Pressable onPress={() => toggleFavorite(couple.id, task.id, !fav).catch(() => {})} hitSlop={10} accessibilityLabel="Favori">
            <Ionicons name={fav ? 'heart' : 'heart-outline'} size={22} color={t.colors.primary} />
          </Pressable>
        )}
      </View>
      <Display>{task.title}</Display>
    </View>
  );
}

type PendingProps = { day: DayDoc; uid: string; partnerName: string; coupleId: string; dayId: string };

function PendingCard({ day, uid, partnerName, coupleId, dayId }: PendingProps) {
  const t = useTheme();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const mine = day.responses[uid];

  async function answer(value: 'accept' | 'decline') {
    setBusy(value);
    try {
      await respond(coupleId, dayId, uid, value);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card accent>
      <TaskTitle task={taskById(day.sharedTaskId)} label={t.copy.sharedLabel} />
      {mine === 'accept' ? (
        <Muted>{t.copy.waiting(partnerName)}</Muted>
      ) : (
        <>
          <Muted>{t.copy.sharedHint}</Muted>
          <Button label={t.copy.accept} onPress={() => answer('accept')} busy={busy === 'accept'} />
          <Button label={t.copy.decline} variant="secondary" onPress={() => answer('decline')} busy={busy === 'decline'} />
        </>
      )}
    </Card>
  );
}

type TaskCardProps = {
  day: DayDoc;
  uid: string;
  partnerId: string;
  partnerName: string;
  shared: boolean;
  coupleId: string;
  members: string[];
  dayId: string;
};

function TaskCard({ day, uid, partnerId, partnerName, shared, coupleId, members, dayId }: TaskCardProps) {
  const t = useTheme();
  const [note, setNote] = useState('');
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const myTask = taskById(shared ? day.sharedTaskId : day.separate[uid]);
  const partnerTask = taskById(day.separate[partnerId]);
  const myDone = day.completions[uid];

  async function finish() {
    setError('');
    if (!selfie) return setError('Görevi tamamlamak için bir selfie çek.');
    if (!note.trim()) return setError(t.copy.noteRequired);
    setBusy(true);
    try {
      // Önce fotoğraf kaydedilir; görev ancak selfie yerine ulaştıysa tamamlanır.
      await saveTaskPhoto(coupleId, dayId, uid, myTask.id, note, selfie);
      await completeTask(coupleId, dayId, uid, members, note);
    } catch {
      setError('Kaydedilemedi, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card accent>
        <TaskTitle task={myTask} label={shared ? t.copy.sharedTask : t.copy.myTask} />

        {myDone ? (
          <View style={{ backgroundColor: t.colors.successSoft, borderRadius: Math.min(t.radius.card, 12), padding: 14, gap: 4 }}>
            <T style={{ color: t.colors.success, fontWeight: '600' }}>{tx(t, t.copy.completed)}</T>
            <T style={{ fontFamily: t.fonts.note, fontSize: 24 }}>{myDone.note}</T>
          </View>
        ) : (
          <>
            <SelfieCamera value={selfie} onChange={setSelfie} hint="Bu an albümünüze polaroid olarak girecek." />
            <Input placeholder={t.copy.notePlaceholder} value={note} onChangeText={setNote} maxLength={80} />
            <ErrorText>{error}</ErrorText>
            <Button label={t.copy.complete} onPress={finish} busy={busy} />
          </>
        )}
      </Card>

      {!shared && (
        <Card style={{ gap: 6 }}>
          <Muted>{tx(t, t.copy.partnerTask)}</Muted>
          <Display style={{ fontSize: t.displaySize * 0.8 }}>{partnerTask.title}</Display>
        </Card>
      )}


      {day.rewarded && (
        <Card style={{ backgroundColor: t.colors.successSoft, borderColor: t.colors.successSoft }}>
          <T style={{ color: t.colors.success, fontWeight: '600', fontSize: 16, textAlign: 'center' }}>
            {tx(t, t.copy.reward(shared ? POINTS.shared : POINTS.separate))}
          </T>
        </Card>
      )}
    </>
  );
}


// Çarktan çıkıp kabul edilen bonus görevler. Yapınca biriniz "Tamamladım" der.
function OpenBonusCard() {
  const t = useTheme();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const open = couple?.openBonus ?? [];
  if (!user || !couple || open.length === 0) return null;
  const doneToday = couple.lastBonusDay === dayKey();

  async function finish(id: string, taskId: string) {
    if (!user || !couple || busy) return;
    setBusy(id);
    try {
      const ok = await finishOpenBonus(couple.id, id, user.uid, BONUS_POINTS);
      if (ok && partnerId) {
        notifyPartner(partnerId, `${profile?.name ?? 'Partnerin'} bonus görevi tamamladı 🎉`, taskById(taskId).title, { type: 'wheel', url: '/' });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="color-wand-outline" size={20} color={t.colors.primary} />
        <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, t.copy.surpriseTitle.endsWith('bonus') ? `${t.copy.surpriseTitle.slice(0, -5)}bonuslarınız` : `${t.copy.surpriseTitle}leriniz`)}</T>
      </View>
      {open.map((o) => (
        <View key={o.id} style={{ gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.colors.border }}>
          <Display style={{ fontSize: t.displaySize * 0.8 }}>{taskById(o.taskId).title}</Display>
          <Muted style={{ fontSize: 12 }}>{o.by === user.uid ? 'Sen kabul ettin' : `${partnerName} kabul etti`}</Muted>
          <Button
            label={doneToday ? 'Tamamladım' : `Tamamladım · +${BONUS_POINTS} puan`}
            onPress={() => finish(o.id, o.taskId)}
            busy={busy === o.id}
          />
        </View>
      ))}
    </Card>
  );
}
