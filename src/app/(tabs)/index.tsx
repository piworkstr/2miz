import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import type React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from '../../components/Avatar';
import { BondHeart, BondStreak } from '../../components/BondHeart';
import { MoodSheet } from '../../components/MoodSheet';
import { activeMood, MOODS } from '../../lib/avatar';
import { greeting } from '../../lib/greeting';
import { BoredCard } from '../../components/BoredCard';
import { GardenCard } from '../../components/GardenCard';
import { LivingCard } from '../../components/LivingCard';
import { bondOf, scheduleRiskReminder } from '../../lib/bond';
import { CoupleInfoCard, daysTogether } from '../../components/CoupleInfoCard';
import { DateCard } from '../../components/DateCard';
import { Polaroid } from '../../components/Polaroid';
import { SelfieCamera } from '../../components/SelfieCamera';
import { SharedCalendar } from '../../components/SharedCalendar';
import { SpecialDays } from '../../components/SpecialDays';
import { Button, Card, Display, ErrorText, Input, Loading, Muted, Pill, Screen, T, Title } from '../../components/ui';
import { completeTask, modeOf, POINTS, respond, useToday, type DayDoc } from '../../lib/daily';
import { dayKey, prettyDate, yesterdayKey } from '../../lib/date';
import { saveTaskPhoto, usePhotos } from '../../lib/photos';
import { useSession, type Profile } from '../../lib/session';
import { categoryLabels, taskById, type Task } from '../../lib/tasks';
import { BONUS_POINTS, toggleFavorite } from '../../lib/archive';
import { finishOpenBonus } from '../../lib/daily';
import { notifyPartner } from '../../lib/push';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

type Panel = 'play' | 'bonus' | 'date' | null;

export default function Today() {
  const { user, couple, partnerId, partnerName, profile, partnerProfile } = useSession();
  const { day, key } = useToday(couple?.id, couple?.members);
  const t = useTheme();
  const [panel, setPanel] = useState<Panel>(null);

  // Seri varken bugün henüz bir şey yapmadıysan akşam 21:00'de hatırlatma kurulur.
  const bond = bondOf(couple, user?.uid, partnerId);
  useEffect(() => {
    scheduleRiskReminder(bond, partnerName);
  }, [bond.streak, bond.meToday > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !couple || !partnerId || !day) return <Loading />;

  const uid = user.uid;
  const mode = modeOf(day, couple.members);
  const streakAlive = couple.lastCompleteDay === dayKey() || couple.lastCompleteDay === yesterdayKey();
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  return (
    <Screen>
      <View style={{ gap: 2, marginTop: 4 }}>
        <Title>{greeting(t.id, profile?.name ?? '', partnerProfile?.petNames)}</Title>
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

      {!profile?.avatar && (
        <Pressable
          onPress={() => router.push('/avatar')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            padding: 12,
            borderRadius: t.radius.card,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: t.colors.primary,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Ionicons name="color-palette-outline" size={20} color={t.colors.primary} />
          <Text style={{ flex: 1, color: t.colors.text, fontFamily: t.fonts.body }}>
            Avatarını oluştur; ruh haline göre yüz ifaden değişsin.
          </Text>
          <Ionicons name="chevron-forward" size={18} color={t.colors.primary} />
        </Pressable>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22 }}>
        <Shortcut icon="game-controller" color="#8C6BC2" label="Birlikte oyna" active={panel === 'play'} onPress={() => toggle('play')} />
        <Shortcut icon="color-wand" color="#E07A45" label={t.copy.surpriseTitle} active={false} onPress={() => router.push('/wheel')} />
        <Shortcut icon="heart" color={t.colors.primary} label="Date" active={panel === 'date'} onPress={() => toggle('date')} />
      </View>
      {panel === 'play' && <BoredCard />}
      {panel === 'date' && (
        <Card>
          <DateCard mode="planner" />
        </Card>
      )}

      <LivingCard />

      <SharedCalendar />

      <DateCard mode="banner" />

      <SpecialDays />

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

      <GardenCard />

      <Pressable
        onPress={() => router.push('/archive')}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 }}
      >
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
  const { profile, partnerProfile } = useSession();
  const [moodOpen, setMoodOpen] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 2 }}>
      <Person p={profile} name={props.myName} done={!!day.completions[uid]} onPress={() => setMoodOpen(true)} />
      <BondHeart />
      <Person p={partnerProfile} name={props.partnerName} done={!!day.completions[partnerId]} />
      <MoodSheet open={moodOpen} onClose={() => setMoodOpen(false)} />
      <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
        <BondStreak />
        <Chip icon={t.id === 'asko' ? 'happy-outline' : 'star'} text={`${props.points} ${t.copy.points}`} />
      </View>
    </View>
  );
}

function Person({ p, name, done, onPress }: { p: Profile | null; name: string; done: boolean; onPress?: () => void }) {
  const t = useTheme();
  const mood = activeMood(p?.mood);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ alignItems: 'center', gap: 2, width: 48 }}>
      <View>
        <Avatar p={p} name={name} size={40} />
        {done && (
          <View
            style={{
              position: 'absolute',
              right: -3,
              top: -3,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: '#4FA37E',
              borderWidth: 2,
              borderColor: t.colors.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 10, color: t.colors.muted, fontFamily: t.fonts.body }}>
        {mood ? MOODS[mood].label : done ? 'Tamam' : name}
      </Text>
    </Pressable>
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

// Yuvarlak renkli simge düğmesi; yazı yok, erişilebilirlik etiketi var. Açıkken altında küçük bir nokta.
function Shortcut({
  icon,
  color,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={tx(t, label)}
      style={({ pressed }) => ({ alignItems: 'center', gap: 4, opacity: pressed ? 0.8 : 1 })}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: active ? t.colors.text : 'rgba(255,255,255,0.9)',
          shadowColor: color,
          shadowOpacity: 0.45,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        }}
      >
        <Ionicons name={icon} size={24} color="#fff" />
      </View>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: active ? color : 'transparent' }} />
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
  const [open, setOpen] = useState(false);

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

  // Görevini tamamladıysan büyük kart küçülür: tek bir özet, dokununca notlar açılır.
  if (myDone) {
    const theirDone = day.completions[partnerId];
    const rows = shared
      ? [{ who: null as string | null, task: myTask, note: myDone.note, theirNote: theirDone?.note }]
      : [
          { who: 'Sen', task: myTask, note: myDone.note, theirNote: undefined },
          { who: partnerName, task: partnerTask, note: theirDone?.note, theirNote: undefined },
        ];
    return (
      <Pressable onPress={() => setOpen((o) => !o)} style={{ marginTop: 10 }}>
        <Card
          style={{
            gap: 10,
            paddingTop: 30,
            backgroundColor: day.rewarded ? t.colors.successSoft : t.colors.card,
            borderColor: day.rewarded ? t.colors.successSoft : t.colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={day.rewarded ? 'checkmark-done-circle' : 'checkmark-circle'} size={26} color={t.colors.success} />
            <View style={{ flex: 1 }}>
              <T style={{ fontWeight: '700', color: t.colors.success }}>
                {day.rewarded
                  ? tx(t, t.copy.reward(shared ? POINTS.shared : POINTS.separate))
                  : tx(t, `Görevini tamamladın · ${partnerName} bekleniyor`)}
              </T>
            </View>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={t.colors.muted} />
          </View>
          {rows.map((r) => (
            <View key={r.who ?? 'shared'} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Ionicons
                name={(r.who === partnerName ? theirDone : myDone) ? 'checkmark' : 'ellipse-outline'}
                size={16}
                color={(r.who === partnerName ? theirDone : myDone) ? t.colors.success : t.colors.muted}
                style={{ marginTop: 2 }}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 14, color: t.colors.text, fontFamily: t.fonts.body }}>
                  {r.who ? <Text style={{ color: t.colors.muted }}>{r.who}: </Text> : null}
                  {r.task.title}
                </Text>
                {open && !!r.note && <T style={{ fontFamily: t.fonts.note, fontSize: 21 }}>“{r.note}”</T>}
                {open && !!r.theirNote && (
                  <T style={{ fontFamily: t.fonts.note, fontSize: 21 }}>
                    {partnerName}: “{r.theirNote}”
                  </T>
                )}
              </View>
            </View>
          ))}
          {!open && <Muted style={{ fontSize: 12 }}>Notları görmek için dokun</Muted>}
        </Card>
        {/* Post-it: ne durumda olduğunu bir bakışta söyler. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 12,
            top: -14,
            backgroundColor: day.rewarded ? '#FFF2A8' : '#FFD9E2',
            paddingHorizontal: 12,
            paddingVertical: 6,
            transform: [{ rotate: '5deg' }],
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 3,
            shadowOffset: { width: 1, height: 2 },
            elevation: 3,
          }}
        >
          <Text style={{ fontFamily: 'Caveat_700Bold', fontSize: 20, color: '#2B1D22' }}>
            {day.rewarded ? 'Bugün tamam! ✓' : `${partnerName} bekleniyor…`}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <>
      <Card accent>
        <TaskTitle task={myTask} label={shared ? t.copy.sharedTask : t.copy.myTask} />

        <SelfieCamera value={selfie} onChange={setSelfie} hint="Bu an albümünüze polaroid olarak girecek." />
        <Input placeholder={t.copy.notePlaceholder} value={note} onChangeText={setNote} maxLength={80} />
        <ErrorText>{error}</ErrorText>
        <Button label={t.copy.complete} onPress={finish} busy={busy} />
      </Card>

      {!shared && (
        <Card style={{ gap: 6 }}>
          <Muted>{tx(t, t.copy.partnerTask)}</Muted>
          <Display style={{ fontSize: t.displaySize * 0.8 }}>{partnerTask.title}</Display>
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
        notifyPartner(partnerId, `${profile?.name ?? 'Partnerin'} bonus görevi tamamladı 🎉`, taskById(taskId).title, {
          type: 'wheel',
          url: '/',
        });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="color-wand-outline" size={20} color={t.colors.primary} />
        <T style={{ flex: 1, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>
          {tx(
            t,
            t.copy.surpriseTitle.endsWith('bonus') ? `${t.copy.surpriseTitle.slice(0, -5)}bonuslarınız` : `${t.copy.surpriseTitle}leriniz`,
          )}
        </T>
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
