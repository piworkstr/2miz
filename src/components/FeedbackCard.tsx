import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { DEMO_COUPLE } from '../lib/demoPersona';
import { db } from '../lib/firebase';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Button, Card, Input, Muted, T } from './ui';

// Deneme kullanıcıları hata ve eksikleri buradan bildirir. Cihaz ve sürüm bilgisi otomatik eklenir.
// Kurucu çift aynı kartın altında gelen bildirimleri görür ve "yapıldı" işaretler.
type Kind = 'hata' | 'eksik' | 'oneri' | 'olay'; // olay: kullanım sayacı (ör. arama düğmesi), listede görünmez
const KINDS: { id: Kind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'hata', label: 'Hata', icon: 'bug-outline' },
  { id: 'eksik', label: 'Eksik', icon: 'remove-circle-outline' },
  { id: 'oneri', label: 'Öneri', icon: 'bulb-outline' },
];

type Feedback = {
  id: string;
  by: string;
  name: string;
  coupleId: string | null;
  kind: Kind;
  text: string;
  device: string;
  version: string;
  status: 'yeni' | 'yapildi';
  createdAt?: { toMillis(): number } | null;
};

export function FeedbackCard() {
  const t = useTheme();
  const { user, couple, profile } = useSession();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('hata');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!user) return null;

  async function send() {
    if (!user || !text.trim() || busy) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        by: user.uid,
        name: profile?.name ?? '',
        coupleId: couple?.id ?? null,
        kind,
        text: text.trim().slice(0, 1000),
        device: `${Device.modelName ?? Platform.OS} · ${Platform.OS} ${Device.osVersion ?? ''}`.trim(),
        version: `${Constants.expoConfig?.version ?? '?'}${Constants.appOwnership === 'expo' ? ' (Expo Go)' : ''}`,
        status: 'yeni',
        createdAt: serverTimestamp(),
      });
      setText('');
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 1800);
    } finally {
      setBusy(false);
    }
  }

  const chip = (on: boolean) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: on ? t.colors.primary : t.colors.border,
    backgroundColor: on ? t.colors.primarySoft : t.colors.card,
  });

  return (
    <>
      <Card style={{ gap: 10 }}>
        <Pressable onPress={() => setOpen((o) => !o)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="chatbox-ellipses-outline" size={18} color={t.colors.primary} />
          <T style={{ flex: 1, fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>Hata ve öneri bildir</T>
          <Ionicons name={open ? 'chevron-up' : 'chevron-forward'} size={16} color={t.colors.muted} />
        </Pressable>
        {open && (
          <>
            <Muted style={{ fontSize: 12 }}>Ne oldu, ne bekliyordun? Hangi ekranda? Cihaz ve sürüm bilgisi otomatik eklenir.</Muted>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {KINDS.map((k) => (
                <Pressable key={k.id} onPress={() => setKind(k.id)} style={chip(kind === k.id)}>
                  <Ionicons name={k.icon} size={14} color={kind === k.id ? t.colors.primary : t.colors.muted} />
                  <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 13, fontWeight: '600', color: t.colors.text }}>
                    {k.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Input
              value={text}
              onChangeText={setText}
              multiline
              maxLength={1000}
              placeholder={
                kind === 'hata' ? 'Örn. Çiftlikte ağılı taşıyamadım, basılı tutunca…' : 'Örn. Görevlerde şunu da görmek isterdim…'
              }
              style={{ minHeight: 84 }}
            />
            {done ? (
              <Muted style={{ textAlign: 'center' }}>Teşekkürler, aldık 💛</Muted>
            ) : (
              <Button label="Gönder" onPress={send} busy={busy} style={{ opacity: text.trim() ? 1 : 0.5 }} />
            )}
          </>
        )}
      </Card>
      {couple?.id === DEMO_COUPLE && <FeedbackInbox />}
    </>
  );
}

// Kurucu çift: gelen bildirimler, yeniler üstte.
function FeedbackInbox() {
  const t = useTheme();
  const [items, setItems] = useState<Feedback[]>([]);
  const [showDone, setShowDone] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(300)),
        (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Feedback, 'id'>) }))),
        () => setItems([]),
      ),
    [],
  );
  const events = items.filter((f) => f.kind === 'olay');
  const real = items.filter((f) => f.kind !== 'olay');
  const list = real.filter((f) => showDone || f.status !== 'yapildi');
  const fresh = real.filter((f) => f.status !== 'yapildi').length;
  const calls = events.filter((e) => e.text.startsWith('arama:'));
  const called = calls.filter((e) => e.text.endsWith(':arandi'));
  const when = (f: Feedback) => {
    const ms = f.createdAt?.toMillis?.();
    if (!ms) return '';
    const d = new Date(ms);
    return `${d.getDate()}.${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T style={{ flex: 1, fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>Gelen bildirimler · {fresh}</T>
        <Pressable onPress={() => setShowDone((s) => !s)} hitSlop={8}>
          <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 12, color: t.colors.primary, fontWeight: '700' }}>
            {showDone ? 'Yapılanları gizle' : 'Yapılanları göster'}
          </Text>
        </Pressable>
      </View>
      <Muted style={{ fontSize: 12 }}>
        📞 Ara düğmesi: {calls.length} dokunuş · {called.length} arama · {new Set(calls.map((e) => e.by)).size} kişi ·{' '}
        {new Set(calls.map((e) => e.coupleId)).size} çift
      </Muted>
      {list.length === 0 && <Muted style={{ fontSize: 12 }}>Yeni bildirim yok.</Muted>}
      {list.map((f) => (
        <View
          key={f.id}
          style={{ borderTopWidth: 1, borderTopColor: t.colors.border, paddingTop: 8, gap: 4, opacity: f.status === 'yapildi' ? 0.55 : 1 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons
              name={KINDS.find((k) => k.id === f.kind)?.icon ?? 'chatbox-outline'}
              size={14}
              color={f.kind === 'hata' ? '#D65849' : t.colors.primary}
            />
            <Text maxFontSizeMultiplier={1.25} style={{ flex: 1, fontSize: 12, color: t.colors.muted }}>
              {f.name || 'Kullanıcı'} · {when(f)} · {f.device} · v{f.version}
            </Text>
            <Pressable
              onPress={() => updateDoc(doc(db, 'feedback', f.id), { status: f.status === 'yapildi' ? 'yeni' : 'yapildi' }).catch(() => {})}
              hitSlop={8}
            >
              <Ionicons name={f.status === 'yapildi' ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={t.colors.primary} />
            </Pressable>
          </View>
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 14 }}>
            {f.text}
          </Text>
        </View>
      ))}
    </Card>
  );
}
