import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
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
    </>
  );
}
