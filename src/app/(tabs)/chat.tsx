import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
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
import { BondHeart, BondStreak } from '../../components/BondHeart';
import { handFont, inkColor } from '../../components/Polaroid';
import { Loading, Muted } from '../../components/ui';
import { addToAlbum, deleteMessage, markRead, removeFromAlbum, reportMessage, sendMessage, useMessagePhoto, useMessages, type Message } from '../../lib/chat';
import { setChatOpen } from '../../lib/push';
import { useSession } from '../../lib/session';
import { tx } from '../../lib/theme';
import { useTheme } from '../../lib/useTheme';

export default function Chat() {
  const t = useTheme();
  const { user, couple, partnerName, partnerId, profile } = useSession();
  const messages = useMessages(couple?.id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState<Message | null>(null);

  // Sekme açıkken gelen mesajlar okundu sayılır.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setChatOpen(true);
      return () => {
        setFocused(false);
        setChatOpen(false);
      };
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
          <Text style={{ flex: 1, fontFamily: t.fonts.title, fontSize: t.titleSize * 0.8, lineHeight: t.titleSize, color: t.colors.text }}>
            {tx(t, partnerName)}
          </Text>
          <BondStreak compact />
          <BondHeart box={40} max={30} showLabel={false} />
        </View>
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
          <Pressable onPress={() => router.push('/camera')} hitSlop={8} accessibilityLabel="Anlık fotoğraf gönder" style={{ padding: 8 }}>
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

      <MessageMenu m={menu} uid={uid} coupleId={couple.id} partnerName={partnerName} onClose={() => setMenu(null)} />
    </SafeAreaView>
  );
}

function Bubble({ m, mine, coupleId, showTime, onLong }: { m: Message; mine: boolean; coupleId: string; showTime: boolean; onLong: () => void }) {
  const t = useTheme();
  const photo = useMessagePhoto(coupleId, m.id, m.hasPhoto);
  const time = new Date(m.createdAtMs).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Fotoğraflar sohbette de polaroid olarak görünür; albüme eklenenlerde küçük bir kalp olur.
  if (m.hasPhoto) {
    return (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', paddingVertical: 6, paddingHorizontal: 6 }}>
        <Pressable
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
            {m.inAlbum && <Ionicons name="heart" size={15} color="#E8516A" />}
          </View>
          {!!m.text && (
            <Text style={{ fontFamily: handFont, fontSize: 19, color: inkColor, textAlign: 'center' }}>{m.text}</Text>
          )}
        </Pressable>
      </View>
    );
  }

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
          overflow: 'hidden',
        }}
      >
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
              {albumRow}
              {row('Mesajı sil', async () => {
                if (m) await deleteMessage(coupleId, m.id, m.hasPhoto);
                close();
              }, true)}
              {row('Vazgeç', close)}
            </>
          ) : (
            <>
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
