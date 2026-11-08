import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { answerScene, cancelScene, joinScene, type Scene } from '../../lib/scenes';
import { Avatar } from '../Avatar';
import { Btn, Head, INK, MUTED, Note } from './DreamUI';
import type { Profile } from '../../lib/session';

// İki kişilik sahnenin alt paneli: bekleme (başlatan ve partner için), canlı sahne, soru ve cevaplar.
// Sahnenin görüntüsü (avatarların yaptığı şey) dünyanın kendi ekranında çizilir; burada yalnızca akış var.

export type SceneMeta = { title: string; verb: string; reward?: { coins?: number; huzur?: number }; playMs?: number };

export function ScenePanel({
  scene,
  meta,
  coupleId,
  uid,
  partnerId,
  partnerName,
  profile,
  partnerProfile,
  onJoined,
  onClose,
  extra,
}: {
  scene: Scene;
  meta: SceneMeta;
  coupleId: string;
  uid: string;
  partnerId: string;
  partnerName: string;
  profile: Profile | null | undefined;
  partnerProfile: Profile | null | undefined;
  onJoined?: () => void;
  onClose?: () => void;
  extra?: ReactNode; // canlı sahnede ek bir alan (ör. yıldızların altında dilek)
}) {
  const [now, setNow] = useState(Date.now());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const mine = scene.by === uid;
  const left = Math.max(0, scene.expiresAt - now);
  const mm = Math.floor(left / 60000);
  const playing = scene.status === 'live' && scene.joinedAt && now < scene.joinedAt + (meta.playMs ?? 6000);
  const myAnswer = scene.answers?.[uid];
  const theirAnswer = scene.answers?.[partnerId];

  if (scene.status === 'waiting') {
    return mine ? (
      <>
        <Head title={meta.title} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar p={partnerProfile} name={partnerName} size={36} showMood={false} />
          <Note>
            {partnerName}’e haber gitti: “{meta.verb}”. Gelince sahne ikinizin telefonunda başlar.{' '}
            {mm > 0 ? `${mm} dk içinde.` : 'Süre dolmak üzere.'}
          </Note>
        </View>
        <Btn
          kind="soft"
          label="Vazgeç"
          onPress={() => {
            cancelScene(coupleId, scene.id).catch(() => {});
            onClose?.();
          }}
        />
      </>
    ) : (
      <>
        <Head title={meta.title} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar p={partnerProfile} name={partnerName} size={36} showMood={false} />
          <Note>
            {partnerName} seni çağırıyor: “{meta.verb}”. {mm > 0 ? `${mm} dk içinde gel.` : ''}
          </Note>
        </View>
        <Btn
          kind="accent"
          label={`Katıl · ${meta.verb}`}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const ok = await joinScene(coupleId, scene.id, uid, meta.reward ?? {});
              if (ok) onJoined?.();
            } finally {
              setBusy(false);
            }
          }}
        />
      </>
    );
  }

  if (playing) {
    return (
      <>
        <Head title={meta.title} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: -8 }}>
          <Avatar p={profile} name="" size={40} showMood={false} />
          <View style={{ marginLeft: -10 }}>
            <Avatar p={partnerProfile} name={partnerName} size={40} showMood={false} />
          </View>
        </View>
        <Note center>İkiniz de buradasınız. {meta.verb}…</Note>
        {extra}
      </>
    );
  }

  // soru
  if (!scene.question) return null;
  return (
    <>
      <Head title={meta.title} />
      {extra}
      <Text style={{ fontSize: 17, fontWeight: '800', color: INK, lineHeight: 22 }}>{scene.question}</Text>
      {myAnswer ? (
        <View style={{ gap: 6 }}>
          <AnswerRow p={profile} name="Sen" text={myAnswer} />
          {theirAnswer ? (
            <AnswerRow p={partnerProfile} name={partnerName} text={theirAnswer} />
          ) : (
            <Note>{partnerName}’in cevabı gelince burada görünecek ve sahne hayal defterine yazılacak.</Note>
          )}
        </View>
      ) : (
        <>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={240}
            placeholder="Cevabın…"
            placeholderTextColor={MUTED}
            style={{ minHeight: 60, borderWidth: 1, borderColor: '#F0E2DC', borderRadius: 12, padding: 10, color: INK, fontSize: 15 }}
          />
          {theirAnswer && <Note>{partnerName} cevapladı; seninki gelince ikisi de görünecek.</Note>}
          <Btn
            label="Cevapla"
            disabled={!text.trim() || busy}
            onPress={async () => {
              setBusy(true);
              try {
                await answerScene(coupleId, scene, uid, text, partnerId);
                setText('');
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
      {onClose && (
        <Pressable onPress={onClose} style={{ alignSelf: 'center', padding: 4 }}>
          <Text style={{ color: MUTED, fontSize: 13 }}>Sonra cevaplarım</Text>
        </Pressable>
      )}
    </>
  );
}

function AnswerRow({ p, name, text }: { p: Profile | null | undefined; name: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <Avatar p={p} name={name} size={28} showMood={false} />
      <View style={{ flex: 1, backgroundColor: '#FFF8F0', borderRadius: 12, padding: 8 }}>
        <Text style={{ fontSize: 11, color: MUTED, fontWeight: '700' }}>{name}</Text>
        <Text style={{ color: INK, fontSize: 14 }}>{text}</Text>
      </View>
    </View>
  );
}
