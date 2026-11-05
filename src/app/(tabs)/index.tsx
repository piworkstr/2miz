import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { DateCard } from '../../components/DateCard';
import { Button, Card, Display, ErrorText, Input, Loading, Muted, Pill, Screen, T, Title } from '../../components/ui';
import { completeTask, modeOf, POINTS, respond, useToday, type DayDoc } from '../../lib/daily';
import { dayKey, prettyDate, yesterdayKey } from '../../lib/date';
import { useSession } from '../../lib/session';
import { categoryLabels, randomTask, taskById, type Task } from '../../lib/tasks';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

export default function Today() {
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const { day, key } = useToday(couple?.id, couple?.members);
  const t = useTheme();

  if (!user || !couple || !partnerId || !day) return <Loading />;

  const uid = user.uid;
  const mode = modeOf(day, couple.members);
  const streakAlive = couple.lastCompleteDay === dayKey() || couple.lastCompleteDay === yesterdayKey();

  return (
    <Screen>
      <View style={{ gap: 2, marginTop: 4 }}>
        <Title>{t.copy.hello(profile?.name ?? '')}</Title>
        <Muted>{tx(t, t.copy.dateLine(prettyDate(key), partnerName))}</Muted>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Stat icon={t.id === 'asko' ? 'heart' : 'flame-outline'} value={streakAlive ? couple.streak : 0} label={t.copy.streak} />
        <Stat icon={t.id === 'asko' ? 'happy-outline' : 'star-outline'} value={couple.points} label={t.copy.points} />
      </View>

      <DateCard />

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

      <SurpriseCard />
    </Screen>
  );
}

function Stat({ icon, value, label }: { icon: 'flame-outline' | 'star-outline' | 'heart' | 'happy-outline'; value: number; label: string }) {
  const t = useTheme();
  const boxed = t.accentBar;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: boxed ? 'transparent' : t.id === 'asko' ? t.colors.card : t.colors.primarySoft,
        borderWidth: boxed ? 1 : 0,
        borderColor: t.colors.border,
        borderRadius: t.radius.card,
        paddingVertical: 12,
        paddingHorizontal: 12,
      }}
    >
      <Ionicons name={icon} size={22} color={t.colors.primary} />
      <Text style={{ fontSize: 20, fontWeight: '700', color: boxed ? t.colors.primary : t.colors.text, fontFamily: t.fonts.button }}>
        {value}
      </Text>
      <Muted style={{ flex: 1, fontSize: 12, lineHeight: 15 }}>{tx(t, label)}</Muted>
    </View>
  );
}

function TaskTitle({ task, label }: { task: Task; label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <Pill>{label}</Pill>
        <Muted style={{ fontSize: 12 }}>{tx(t, categoryLabels[task.category])}</Muted>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const myTask = taskById(shared ? day.sharedTaskId : day.separate[uid]);
  const partnerTask = taskById(day.separate[partnerId]);
  const myDone = day.completions[uid];
  const partnerDone = day.completions[partnerId];

  async function finish() {
    setError('');
    if (!note.trim()) return setError(t.copy.noteRequired);
    setBusy(true);
    try {
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
            <View
              style={{
                borderWidth: 1.5,
                borderStyle: 'dashed',
                borderColor: t.colors.border,
                borderRadius: Math.min(t.radius.card, 14),
                padding: 20,
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="camera-outline" size={28} color={t.colors.muted} />
              <Muted style={{ textAlign: 'center' }}>{t.copy.selfieSoon}</Muted>
            </View>
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

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
        <Ionicons
          name={partnerDone ? 'checkmark-circle' : 'time-outline'}
          size={22}
          color={partnerDone ? t.colors.success : t.colors.muted}
        />
        <T style={{ flex: 1 }}>{partnerDone ? t.copy.partnerDone(partnerName) : t.copy.partnerNotDone(partnerName)}</T>
      </Card>

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

function SurpriseCard() {
  const t = useTheme();
  const [task, setTask] = useState<Task | null>(null);
  return (
    <Card>
      <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, t.copy.surpriseTitle)}</T>
      {task ? <TaskTitle task={task} label={t.copy.surpriseLabel} /> : <Muted>{t.copy.surpriseHint}</Muted>}
      <Button
        label={task ? t.copy.surpriseAgain : t.copy.surpriseBtn}
        variant="secondary"
        onPress={() => setTask(randomTask(task?.id))}
      />
    </Card>
  );
}
