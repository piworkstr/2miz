import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorText, Input, Loading, Muted, Screen } from '../../components/ui';
import { completeTask, modeOf, POINTS, respond, useToday, type DayDoc } from '../../lib/daily';
import { dayKey, prettyDate, yesterdayKey } from '../../lib/date';
import { useSession } from '../../lib/session';
import { categoryLabels, randomTask, taskById, type Task } from '../../lib/tasks';
import { colors, fonts } from '../../lib/theme';

export default function Today() {
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const { day, key } = useToday(couple?.id, couple?.members);

  if (!user || !couple || !partnerId || !day) return <Loading />;

  const uid = user.uid;
  const mode = modeOf(day, couple.members);
  const streakAlive = couple.lastCompleteDay === dayKey() || couple.lastCompleteDay === yesterdayKey();

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Merhaba {profile?.name ?? ''}</Text>
          <Muted>
            {prettyDate(key)} · {partnerName} ile
          </Muted>
        </View>
      </View>

      <View style={styles.stats}>
        <Stat icon="flame-outline" value={streakAlive ? couple.streak : 0} label="gün seri" />
        <Stat icon="star-outline" value={couple.points} label="puan" />
      </View>

      {mode === 'pending' && (
        <PendingCard day={day} uid={uid} partnerName={partnerName} coupleId={couple.id} dayId={key} />
      )}

      {mode !== 'pending' && (
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

function Stat({ icon, value, label }: { icon: 'flame-outline' | 'star-outline'; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TaskTitle({ task, label }: { task: Task; label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.pillRow}>
        <Text style={styles.pill}>{label}</Text>
        <Text style={styles.pillMuted}>{categoryLabels[task.category]}</Text>
      </View>
      <Text style={styles.taskTitle}>{task.title}</Text>
    </View>
  );
}

type PendingProps = { day: DayDoc; uid: string; partnerName: string; coupleId: string; dayId: string };

function PendingCard({ day, uid, partnerName, coupleId, dayId }: PendingProps) {
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const mine = day.responses[uid];
  const task = taskById(day.sharedTaskId);

  async function answer(value: 'accept' | 'decline') {
    setBusy(value);
    try {
      await respond(coupleId, dayId, uid, value);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <TaskTitle task={task} label="Bugünün ortak görevi" />
      {mine === 'accept' ? (
        <Muted>Sen hazırsın. {partnerName} cevap verince görev başlayacak.</Muted>
      ) : (
        <>
          <Muted>Bunu birlikte yapmak ister misin? Biriniz istemezse ikinize de ayrı görev gelir.</Muted>
          <Button label="Birlikte yapalım" onPress={() => answer('accept')} busy={busy === 'accept'} />
          <Button
            label="Başka görev istiyorum"
            variant="secondary"
            onPress={() => answer('decline')}
            busy={busy === 'decline'}
          />
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
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const myTask = taskById(shared ? day.sharedTaskId : day.separate[uid]);
  const partnerTask = taskById(day.separate[partnerId]);
  const myDone = day.completions[uid];
  const partnerDone = day.completions[partnerId];

  async function finish() {
    setError('');
    if (!note.trim()) return setError('Bugüne küçük bir not bırak.');
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
      <Card>
        <TaskTitle task={myTask} label={shared ? 'Ortak görev' : 'Senin görevin'} />

        {myDone ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneLabel}>Tamamladın</Text>
            <Text style={styles.handNote}>{myDone.note}</Text>
          </View>
        ) : (
          <>
            <View style={styles.selfieSlot}>
              <Ionicons name="camera-outline" size={28} color={colors.muted} />
              <Muted style={{ textAlign: 'center' }}>Selfie çekimi bir sonraki güncellemede burada olacak.</Muted>
            </View>
            <Input
              placeholder="Bugünden küçük bir not..."
              value={note}
              onChangeText={setNote}
              maxLength={80}
            />
            <ErrorText>{error}</ErrorText>
            <Button label="Görevi tamamla" onPress={finish} busy={busy} />
          </>
        )}
      </Card>

      {!shared && (
        <Card style={{ gap: 6 }}>
          <Muted>Partnerinin görevi</Muted>
          <Text style={styles.partnerTask}>{partnerTask.title}</Text>
        </Card>
      )}

      <Card style={styles.statusRow}>
        <Ionicons
          name={partnerDone ? 'checkmark-circle' : 'time-outline'}
          size={22}
          color={partnerDone ? colors.success : colors.muted}
        />
        <Text style={{ flex: 1, color: colors.text }}>
          {partnerDone ? `${partnerName} görevini tamamladı` : `${partnerName} henüz tamamlamadı`}
        </Text>
      </Card>

      {day.rewarded && (
        <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}>
          <Text style={styles.reward}>
            Bugünü birlikte tamamladınız! +{shared ? POINTS.shared : POINTS.separate} puan
          </Text>
        </Card>
      )}
    </>
  );
}

function SurpriseCard() {
  const [task, setTask] = useState<Task | null>(null);
  return (
    <Card>
      <Text style={styles.surpriseTitle}>Canın mı sıkıldı?</Text>
      {task ? (
        <TaskTitle task={task} label="Sürpriz görev" />
      ) : (
        <Muted>Ekstra bir şey yapmak istersen rastgele bir görev çek.</Muted>
      )}
      <Button
        label={task ? 'Başka bir tane' : 'Sürpriz görev çek'}
        variant="secondary"
        onPress={() => setTask(randomTask(task?.id))}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  hello: { fontFamily: fonts.handBold, fontSize: 38, color: colors.text },
  stats: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: 14, color: colors.muted },
  pillRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  pill: {
    backgroundColor: colors.primarySoft,
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pillMuted: { fontSize: 12, color: colors.muted },
  taskTitle: { fontFamily: fonts.handBold, fontSize: 30, lineHeight: 34, color: colors.text },
  selfieSlot: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  doneBox: { backgroundColor: colors.successSoft, borderRadius: 12, padding: 14, gap: 4 },
  doneLabel: { color: colors.success, fontWeight: '600' },
  handNote: { fontFamily: fonts.hand, fontSize: 24, color: colors.text },
  partnerTask: { fontFamily: fonts.hand, fontSize: 24, color: colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  reward: { color: colors.success, fontWeight: '600', fontSize: 16, textAlign: 'center' },
  surpriseTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
});
