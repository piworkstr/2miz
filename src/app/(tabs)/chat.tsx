import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { ChatCamera } from '../../components/ChatCamera';
import { Loading, Muted } from '../../components/ui';
import { deleteMessage, markRead, reportMessage, sendMessage, useMessagePhoto, useMessages, type Message } from '../../lib/chat';
import { useSession } from '../../lib/session';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

export default function Chat() {
  const t = useTheme();
  const { user, couple, partnerName } = useSession();
  const messages = useMessages(couple?.id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [camera, setCamera] = useState(false);
  const [menu, setMenu] = useState<Message | null>(null);

  // Sekme açıkken gelen mesajlar okundu sayılır.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const newest = messages?.[0]?.createdAtMs;
  useEffect(() => {
    if (focused && couple && user) markRead(couple.id, user.uid);
  }, [focused, newest, couple?.id, user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user || !couple || messages === null) return <Loading />;
  const uid = user.uid;
  const visible = messages.filter((m) => !m.hiddenFor?.[uid]);

  async function send() {
    if (!text.trim() || sending || !couple) return;
    setSending(true);
    try {
      await sendMessage(couple.id, uid, text, null);
      setText('');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
        <Text style={{ fontFamily: t.fonts.title, fontSize: t.titleSize * 0.8, lineHeight: t.titleSize, color: t.colors.text }}>
          {tx(t, partnerName)}
        </Text>
        <Muted style={{ fontSize: 12 }}>Sadece ikiniz görürsünüz. Fotoğraflar anlık çekilir.</Muted>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={visible}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 14, gap: 6 }}
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
              onLong={() => setMenu(item)}
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
          <Pressable onPress={() => setCamera(true)} hitSlop={8} accessibilityLabel="Anlık fotoğraf gönder" style={{ padding: 8 }}>
            <Ionicons name="camera" size={26} color={t.colors.primary} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
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
        </View>
      </KeyboardAvoidingView>

      <ChatCamera open={camera} onClose={() => setCamera(false)} onSend={(data) => sendMessage(couple.id, uid, '', data)} />
      <MessageMenu m={menu} uid={uid} coupleId={couple.id} partnerName={partnerName} onClose={() => setMenu(null)} />
    </SafeAreaView>
  );
}

function Bubble({ m, mine, coupleId, showTime, onLong }: { m: Message; mine: boolean; coupleId: string; showTime: boolean; onLong: () => void }) {
  const t = useTheme();
  const photo = useMessagePhoto(coupleId, m.id, m.hasPhoto);
  const time = new Date(m.createdAtMs).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 2 }}>
      <Pressable
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
          padding: m.hasPhoto ? 4 : 0,
          overflow: 'hidden',
        }}
      >
        {m.hasPhoto &&
          (photo ? (
            <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={{ width: 220, height: 290, borderRadius: 14 }} />
          ) : (
            <View style={{ width: 220, height: 290, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.primarySoft }}>
              <ActivityIndicator color={t.colors.primary} />
            </View>
          ))}
        {!!m.text && (
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
      {showTime && <Text style={{ fontSize: 11, color: t.colors.muted, marginHorizontal: 6 }}>{time}</Text>}
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

  function close() {
    setReporting(false);
    setDone(false);
    onClose();
  }

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

  const row = (label: string, onPress: () => void, danger?: boolean) => (
    <Pressable key={label} onPress={onPress} style={({ pressed }) => ({ paddingVertical: 16, paddingHorizontal: 20, backgroundColor: pressed ? t.colors.primarySoft : 'transparent' })}>
      <Text style={{ fontSize: 16, color: danger ? '#C0392B' : t.colors.text, fontFamily: t.fonts.body }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={!!m} transparent animationType="fade" onRequestClose={close}>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: t.colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34, paddingTop: 8 }}>
          {done ? (
            <View style={{ padding: 20, gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: '600', color: t.colors.text }}>Şikayetin alındı</Text>
              <Muted>
                Mesaj senin ekranından kaldırıldı ve inceleme için ekibimize iletildi. Kendini güvende hissetmiyorsan Biz
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
              {row('Mesajı sil', async () => {
                if (m) await deleteMessage(coupleId, m.id, m.hasPhoto);
                close();
              }, true)}
              {row('Vazgeç', close)}
            </>
          ) : (
            <>
              {row(`${partnerName}'in mesajını şikayet et`, () => setReporting(true), true)}
              {row('Vazgeç', close)}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
