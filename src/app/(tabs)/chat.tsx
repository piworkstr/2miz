import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { BondHeart, BondStreak } from '../../components/BondHeart';
import { handFont, inkColor } from '../../components/Polaroid';
import { Loading, Muted } from '../../components/ui';
import { fmt, useVoice, VoicePlayer } from '../../components/Voice';
import {
  addToAlbum,
  deleteMessage,
  markRead,
  REACTIONS,
  reactToMessage,
  removeFromAlbum,
  reportMessage,
  sendMessage,
  sendVoice,
  setTyping,
  usePartnerTyping,
  useMessagePhoto,
  useMessages,
  useVoiceFile,
  type Message,
} from '../../lib/chat';
import { setChatOpen } from '../../lib/push';
import { useSession } from '../../lib/session';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

export default function Chat() {
  const t = useTheme();
  const { user, couple, partnerName, partnerId, profile, partnerProfile } = useSession();
  const messages = useMessages(couple?.id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState<Message | null>(null);
  const startY = useRef(0);
  const partnerTyping = usePartnerTyping(couple?.id, partnerId);
  const lastTyping = useRef(0);
  const voice = useVoice((uri, ms) => {
    if (!couple || !user) return;
    voice.setHint('Sesli mesaj gönderiliyor…');
    sendVoice(couple.id, user.uid, uri, ms, { to: partnerId, fromName: profile?.name ?? 'Partnerin' })
      .then(() => voice.setHint(''))
      .catch(() => voice.setHint('Sesli mesaj gönderilemedi, tekrar dene.'));
  });

  // Sekme açıkken gelen mesajlar okundu sayılır.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setChatOpen(true);
      return () => {
        setFocused(false);
        setChatOpen(false);
        if (couple && user && lastTyping.current) {
          lastTyping.current = 0;
          setTyping(couple.id, user.uid, null);
        }
      };
    }, []),
  );
  const newest = messages?.[0]?.createdAtMs;
  useEffect(() => {
    if (focused && couple && user) markRead(couple.id, user.uid);
  }, [focused, newest, couple?.id, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ses kaydederken partnere "ses kaydediyor…" gösterilir; 3 saniyede bir tazelenir.
  useEffect(() => {
    if (!couple || !user) return;
    if (!voice.recording) {
      if (lastTyping.current) {
        lastTyping.current = 0;
        setTyping(couple.id, user.uid, null);
      }
      return;
    }
    lastTyping.current = Date.now();
    setTyping(couple.id, user.uid, 'voice');
    const i = setInterval(() => setTyping(couple.id, user.uid, 'voice'), 3000);
    return () => clearInterval(i);
  }, [voice.recording]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !couple || messages === null) return <Loading />;
  const uid = user.uid;
  const visible = messages.filter((m) => !m.hiddenFor?.[uid]);
  // Kendi mesajlarının durumu: gönderiliyor → gönderildi (tik) → ulaştı (boş kalp) → okundu (dolu kalp).
  const readAt = (partnerId && couple.lastRead?.[partnerId]) || 0;
  const deliveredAt = Math.max((partnerId && couple.lastDelivered?.[partnerId]) || 0, readAt);
  const statusOf = (m: Message): MsgState =>
    m.pending ? 'sending' : readAt >= m.createdAtMs ? 'read' : deliveredAt >= m.createdAtMs ? 'delivered' : 'sent';

  // Çift dokunma: kalp bırak (tekrar çift dokununca kalkar).
  function react(m: Message, emoji: string) {
    if (!couple) return;
    reactToMessage(couple.id, m, uid, emoji, { to: partnerId, fromName: profile?.name ?? 'Partnerin' }).catch(() => {});
  }

  // Yazarken partnere "yazıyor…" gösterilir (en fazla 3 saniyede bir yazılır).
  function onType(v: string) {
    setText(v);
    if (!couple) return;
    const now = Date.now();
    if (v.trim() && now - lastTyping.current > 3000) {
      lastTyping.current = now;
      setTyping(couple.id, uid, 'text');
    } else if (!v.trim() && lastTyping.current) {
      lastTyping.current = 0;
      setTyping(couple.id, uid, null);
    }
  }

  async function send() {
    if (!text.trim() || sending || !couple) return;
    setSending(true);
    try {
      lastTyping.current = 0;
      setTyping(couple.id, uid, null);
      await sendMessage(couple.id, uid, text, null, { to: partnerId, fromName: profile?.name ?? 'Partnerin' });
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar p={partnerProfile} name={partnerName} size={40} />
          <Text style={{ flex: 1, fontFamily: t.fonts.title, fontSize: t.titleSize * 0.8, lineHeight: t.titleSize, color: t.colors.text }}>
            {tx(t, partnerName)}
          </Text>
          <BondStreak compact />
          <BondHeart box={40} max={30} showLabel={false} />
        </View>
        {partnerTyping ? (
          <Text style={{ fontSize: 12, color: t.colors.primary, fontWeight: '600' }}>
            {partnerTyping === 'voice' ? '🎤 ses kaydediyor…' : 'yazıyor…'}
          </Text>
        ) : (
          <Muted style={{ fontSize: 12 }}>Sadece ikiniz görürsünüz. Fotoğraflar anlık çekilir.</Muted>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={visible}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 14, gap: 6 }}
          ListHeaderComponent={partnerTyping ? <TypingBubble kind={partnerTyping} name={partnerName} /> : undefined}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: 8, padding: 30, transform: [{ scaleY: -1 }] }}>
              <Ionicons name="chatbubbles-outline" size={36} color={t.colors.primary} />
              <Muted style={{ textAlign: 'center' }}>{partnerName}'e ilk mesajını yaz ya da anlık bir fotoğraf gönder.</Muted>
            </View>
          }
          renderItem={({ item, index }) => (
            <Bubble
              m={item}
              mine={item.from === uid}
              coupleId={couple.id}
              showTime={index === 0 || visible[index - 1]?.from !== item.from}
              status={item.from === uid ? statusOf(item) : null}
              onLong={() => setMenu(item)}
              onDoubleTap={() => react(item, '❤️')}
            />
          )}
        />

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            padding: 10,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.card,
          }}
        >
          {voice.recording ? (
            <View style={{ flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#E53935' }} />
              <Text style={{ fontSize: 16, fontWeight: '600', color: t.colors.text, fontVariant: ['tabular-nums'] }}>{fmt(voice.ms)}</Text>
              <Muted style={{ flex: 1, fontSize: 12 }}>Bırakınca gönderilir · iptal için yukarı kaydır</Muted>
            </View>
          ) : (
          <>
          <Pressable onPress={() => router.push('/camera')} hitSlop={8} accessibilityLabel="Anlık fotoğraf gönder" style={{ padding: 8 }}>
            <Ionicons name="camera" size={26} color={t.colors.primary} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={onType}
            placeholder="Mesaj yaz…"
            placeholderTextColor={t.colors.muted}
            multiline
            maxLength={1000}
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 42,
              backgroundColor: t.colors.bg,
              borderRadius: 21,
              paddingHorizontal: 14,
              paddingTop: 11,
              paddingBottom: 11,
              fontSize: 16,
              color: t.colors.text,
              fontFamily: t.fonts.body,
            }}
          />
          </>
          )}
          {text.trim() && !voice.recording ? (
            <Pressable
              onPress={send}
              accessibilityLabel="Gönder"
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: text.trim() ? t.colors.primary : t.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {sending ? <ActivityIndicator color={t.colors.onPrimary} /> : <Ionicons name="send" size={18} color={t.colors.onPrimary} />}
            </Pressable>
          ) : (
            <Pressable
              onPressIn={(e) => {
                startY.current = e.nativeEvent.pageY;
                voice.start();
              }}
              onPressOut={(e) => voice.stop(startY.current - e.nativeEvent.pageY < 60)}
              accessibilityLabel="Basılı tutarak sesli mesaj kaydet"
              style={{
                width: voice.recording ? 54 : 42,
                height: voice.recording ? 54 : 42,
                borderRadius: 27,
                marginTop: voice.recording ? -12 : 0,
                backgroundColor: voice.recording ? '#E53935' : t.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="mic" size={voice.recording ? 26 : 20} color="#fff" />
            </Pressable>
          )}
        </View>
        {!!voice.hint && (
          <Pressable onPress={() => voice.setHint('')} style={{ paddingHorizontal: 14, paddingBottom: 8, backgroundColor: t.colors.card }}>
            <Muted style={{ fontSize: 12, textAlign: 'center' }}>{voice.hint}</Muted>
          </Pressable>
        )}
      </KeyboardAvoidingView>

      <MessageMenu m={menu} uid={uid} coupleId={couple.id} partnerName={partnerName} onClose={() => setMenu(null)} />
    </SafeAreaView>
  );
}

// Partner yazarken ya da ses kaydederken listenin en altında beliren balon (üç nokta atar).
function TypingBubble({ kind, name }: { kind: 'text' | 'voice'; name: string }) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(anim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const dot = (i: number) => ({
    opacity: anim.interpolate({ inputRange: [0, (i + 0.5) / 4, (i + 1.5) / 4, 1], outputRange: [0.3, 1, 0.3, 0.3], extrapolate: 'clamp' as const }),
  });
  return (
    <View style={{ alignItems: 'flex-start', paddingTop: 4 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: t.colors.card,
          borderWidth: 1,
          borderColor: t.colors.border,
          borderRadius: 18,
          borderBottomLeftRadius: 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        {kind === 'voice' ? (
          <>
            <Ionicons name="mic" size={16} color={t.colors.primary} />
            <Text style={{ fontSize: 13, color: t.colors.muted }}>{name} ses kaydediyor</Text>
          </>
        ) : null}
        {[0, 1, 2].map((i) => (
          <Animated.View key={i} style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: t.colors.primary }, dot(i)]} />
        ))}
      </View>
    </View>
  );
}

type MsgState = 'sending' | 'sent' | 'delivered' | 'read';

// WhatsApp'taki tikler yerine: tik (gönderildi), boş kalp (ulaştı), kırmızı dolu kalp (okundu).
function StatusIcon({ state, size = 13 }: { state: MsgState; size?: number }) {
  const t = useTheme();
  const map = {
    sending: { name: 'time-outline', color: t.colors.muted, label: 'Gönderiliyor' },
    sent: { name: 'checkmark', color: t.colors.muted, label: 'Gönderildi' },
    delivered: { name: 'heart-outline', color: t.colors.muted, label: 'Ulaştı' },
    read: { name: 'heart', color: '#E8516A', label: 'Okundu' },
  } as const;
  const s = map[state];
  return <Ionicons name={s.name} size={size} color={s.color} accessibilityLabel={s.label} />;
}

function Bubble({
  m,
  mine,
  coupleId,
  showTime,
  status,
  onLong,
  onDoubleTap,
}: {
  m: Message;
  mine: boolean;
  coupleId: string;
  showTime: boolean;
  status: MsgState | null;
  onLong: () => void;
  onDoubleTap: () => void;
}) {
  const t = useTheme();
  const lastTap = useRef(0);
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      onDoubleTap();
    } else lastTap.current = now;
  };
  const reactions = Object.values(m.reactions ?? {});
  const badge = reactions.length > 0 && (
    <View
      style={{
        flexDirection: 'row',
        gap: 1,
        marginTop: -10,
        marginHorizontal: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 12,
        backgroundColor: t.colors.card,
        borderWidth: 1,
        borderColor: t.colors.border,
        zIndex: 2,
      }}
    >
      {reactions.map((e, i) => (
        <Text key={i} style={{ fontSize: 14 }}>
          {e}
        </Text>
      ))}
    </View>
  );
  const photo = useMessagePhoto(coupleId, m.id, m.hasPhoto);
  const time = new Date(m.createdAtMs).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Fotoğraflar sohbette de polaroid olarak görünür; albüme eklenenlerde küçük bir kalp olur.
  if (m.hasPhoto) {
    return (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', paddingVertical: 6, paddingHorizontal: 6 }}>
        <Pressable
          onPress={tap}
          onLongPress={onLong}
          delayLongPress={350}
          style={{
            width: 216,
            backgroundColor: '#FFFFFF',
            padding: 8,
            paddingBottom: 6,
            borderWidth: 1,
            borderColor: '#E9DED8',
            transform: [{ rotate: `${mine ? 2 : -2}deg` }],
            shadowColor: '#000',
            shadowOpacity: 0.14,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
            elevation: 3,
          }}
        >
          {photo ? (
            <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={{ width: '100%', aspectRatio: 3 / 4, backgroundColor: '#eee' }} />
          ) : (
            <View style={{ width: '100%', aspectRatio: 3 / 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3ECE8' }}>
              <ActivityIndicator color="#E8516A" />
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 6, minHeight: 30 }}>
            <Text style={{ fontFamily: handFont, fontSize: 20, color: inkColor }}>{time}</Text>
            {m.inAlbum && <Ionicons name="bookmark" size={14} color="#E8516A" />}
            {status && <StatusIcon state={status} size={15} />}
          </View>
          {!!m.text && (
            <Text style={{ fontFamily: handFont, fontSize: 19, color: inkColor, textAlign: 'center' }}>{m.text}</Text>
          )}
        </Pressable>
        {badge}
      </View>
    );
  }

  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 2 }}>
      <Pressable
        onPress={tap}
        onLongPress={onLong}
        delayLongPress={350}
        style={{
          maxWidth: '78%',
          backgroundColor: mine ? t.colors.primary : t.colors.card,
          borderWidth: mine ? 0 : 1,
          borderColor: t.colors.border,
          borderRadius: 18,
          borderBottomRightRadius: mine ? 4 : 18,
          borderBottomLeftRadius: mine ? 18 : 4,
          overflow: 'hidden',
        }}
      >
        {m.audioMs ? (
          <VoicePlayer coupleId={coupleId} m={m} mine={mine} />
        ) : (
          <Text
            style={{
              color: mine ? t.colors.onPrimary : t.colors.text,
              fontSize: 16,
              lineHeight: 22,
              paddingHorizontal: 14,
              paddingVertical: 9,
              fontFamily: t.fonts.body,
            }}
          >
            {m.text}
          </Text>
        )}
      </Pressable>
      {badge}
      {(showTime || status) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginHorizontal: 6 }}>
          {showTime && <Text style={{ fontSize: 11, color: t.colors.muted }}>{time}</Text>}
          {status && <StatusIcon state={status} />}
        </View>
      )}
    </View>
  );
}

const REASONS = ['Uygunsuz içerik', 'Taciz ya da tehdit', 'Rızam olmadan paylaşılan fotoğraf', 'Diğer'];

// Uzun basınca: kendi mesajını silme, partnerin mesajını şikayet etme.
function MessageMenu({ m, uid, coupleId, partnerName, onClose }: { m: Message | null; uid: string; coupleId: string; partnerName: string; onClose: () => void }) {
  const t = useTheme();
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');

  function close() {
    setReporting(false);
    setDone(false);
    setAdding(false);
    setNote('');
    setErr('');
    onClose();
  }

  async function add() {
    if (!m || busy) return;
    setBusy(true);
    setErr('');
    try {
      await addToAlbum(coupleId, m, uid, note);
      close();
    } catch {
      setErr('Eklenemedi, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  const { partnerId, profile } = useSession();
  const emojiRow = m && (
    <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingVertical: 10 }}>
      {REACTIONS.map((e) => {
        const on = m.reactions?.[uid] === e;
        return (
          <Pressable
            key={e}
            onPress={() => {
              reactToMessage(coupleId, m, uid, e, { to: partnerId, fromName: profile?.name ?? 'Partnerin' }).catch(() => {});
              close();
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? t.colors.primarySoft : 'transparent',
            }}
          >
            <Text style={{ fontSize: 26 }}>{e}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const albumRow = m?.hasPhoto
    ? m.inAlbum
      ? row('Albümden çıkar', async () => {
          if (m) await removeFromAlbum(coupleId, m.id).catch(() => {});
          close();
        })
      : row('Albüme ekle', () => setAdding(true))
    : null;

  async function report(reason: string) {
    if (!m) return;
    setBusy(true);
    try {
      await reportMessage(coupleId, m, uid, reason);
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  function row(label: string, onPress: () => void, danger?: boolean) {
    return (
      <Pressable key={label} onPress={onPress} style={({ pressed }) => ({ paddingVertical: 16, paddingHorizontal: 20, backgroundColor: pressed ? t.colors.primarySoft : 'transparent' })}>
        <Text style={{ fontSize: 16, color: danger ? '#C0392B' : t.colors.text, fontFamily: t.fonts.body }}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Modal visible={!!m} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: t.colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34, paddingTop: 8 }}>
          {adding ? (
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: t.colors.text }}>Albüme anı olarak ekle</Text>
              <Muted>Polaroidin altına el yazısıyla bir not yaz (istersen boş bırak).</Muted>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Örn. O akşamki gün batımı"
                placeholderTextColor={t.colors.muted}
                maxLength={80}
                autoFocus
                style={{
                  backgroundColor: t.colors.bg,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  fontSize: 22,
                  color: inkColor,
                  fontFamily: handFont,
                }}
              />
              {!!err && <Text style={{ color: '#C0392B' }}>{err}</Text>}
              <Pressable
                onPress={add}
                style={{ backgroundColor: t.colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              >
                {busy ? <ActivityIndicator color={t.colors.onPrimary} /> : <Text style={{ color: t.colors.onPrimary, fontSize: 16, fontWeight: '600' }}>Albüme ekle</Text>}
              </Pressable>
              {row('Vazgeç', close)}
            </View>
          ) : done ? (
            <View style={{ padding: 20, gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: t.colors.text }}>Şikayetin alındı</Text>
              <Muted>
                Mesaj senin ekranından kaldırıldı ve inceleme için ekibimize iletildi. Kendini güvende hissetmiyorsan İkimiz
                ekranından eşleşmeni bitirebilirsin.
              </Muted>
              {row('Tamam', close)}
            </View>
          ) : reporting ? (
            <>
              <Muted style={{ paddingHorizontal: 20, paddingVertical: 10 }}>Neden şikayet ediyorsun?</Muted>
              {busy ? <ActivityIndicator style={{ padding: 20 }} color={t.colors.primary} /> : REASONS.map((r) => row(r, () => report(r)))}
              {row('Vazgeç', close)}
            </>
          ) : m?.from === uid ? (
            <>
              {emojiRow}
              {albumRow}
              {row('Mesajı sil', async () => {
                if (m) await deleteMessage(coupleId, m);
                close();
              }, true)}
              {row('Vazgeç', close)}
            </>
          ) : (
            <>
              {emojiRow}
              {albumRow}
              {row(`${partnerName}'in mesajını şikayet et`, () => setReporting(true), true)}
              {row('Vazgeç', close)}
            </>
          )}
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
