import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { DayDoc } from '../lib/daily';
import { prettyDate } from '../lib/date';
import { db } from '../lib/firebase';
import { saveTaskPhoto, shrink } from '../lib/photos';
import { taskById } from '../lib/tasks';
import { useTheme } from '../lib/useTheme';
import { Polaroid } from './Polaroid';
import { Button, ErrorText, Input, Muted, Title } from './ui';

// Geçmiş bir görev gününe sonradan fotoğraf ekleme: albümde kendi boş polaroidine basılı tutunca açılır.
// Albüm bastırılırken o günün sayfası yarım kalmasın diye var; puan ya da seri değişmez.
export function AddTaskPhoto(props: {
  open: boolean;
  onClose: () => void;
  coupleId: string;
  uid: string;
  name: string;
  day: string;
  fallbackTaskId: string; // gün kaydı okunamazsa partnerin fotoğrafındaki görev
}) {
  const { open, onClose, coupleId, uid, name, day } = props;
  const t = useTheme();
  const [data, setData] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'pick' | 'save' | null>(null);
  const [error, setError] = useState('');

  const close = () => {
    setData(null);
    setNote('');
    setError('');
    onClose();
  };

  async function pick(from: 'camera' | 'library') {
    if (busy) return;
    setError('');
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setError('Kamera izni gerekiyor. İzin vermek istemezsen galeriden seçebilirsin.');
      }
      const res =
        from === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: true })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: true });
      if (res.canceled || !res.assets.length) return;
      const a = res.assets[0];
      setBusy('pick');
      setData(await shrink(a.uri, { width: a.width, height: a.height, orientation: a.exif?.Orientation as number | undefined }));
    } catch {
      setError('Fotoğraf alınamadı, tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!data || busy) return;
    setBusy('save');
    setError('');
    try {
      // O günün görevi: ayrı görev günüyse kendi görevin, değilse ortak görev.
      const snap = await getDoc(doc(db, 'couples', coupleId, 'days', day)).catch(() => null);
      const d = snap?.exists() ? (snap.data() as Partial<DayDoc>) : null;
      const taskId = d?.separate?.[uid] ?? d?.sharedTaskId ?? props.fallbackTaskId;
      await saveTaskPhoto(coupleId, day, uid, taskId, note.slice(0, 60), data);
      close();
    } catch {
      setError('Kaydedilemedi; bağlantıyı kontrol edip tekrar dene.');
      setBusy(null);
    }
  }

  return (
    <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Pressable onPress={close} hitSlop={12} accessibilityLabel="Kapat" style={{ alignSelf: 'flex-end' }}>
            <Ionicons name="close" size={28} color={t.colors.text} />
          </Pressable>
          <Title>Fotoğrafını ekle</Title>
          <Muted>{`${prettyDate(day)} · ${taskById(props.fallbackTaskId).title}`}</Muted>
          <Muted>O gün fotoğraf eklememiştin. Şimdi eklersen albümde ve baskıda bu sayfa tamamlanır.</Muted>

          {data ? (
            <Polaroid
              photo={{ data, note: note.trim() }}
              name={name}
              aspect={3 / 4}
              tilt={-2}
              style={{ alignSelf: 'center', width: '70%', marginVertical: 8 }}
            />
          ) : null}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button style={{ flex: 1 }} variant="secondary" label="Fotoğraf çek" onPress={() => pick('camera')} busy={busy === 'pick'} />
            <Button style={{ flex: 1 }} variant="secondary" label="Galeriden seç" onPress={() => pick('library')} busy={busy === 'pick'} />
          </View>
          {data && (
            <>
              <Input value={note} onChangeText={setNote} placeholder="Altına bir not (isteğe bağlı)" maxLength={60} />
              <Button label="Albüme ekle" onPress={save} busy={busy === 'save'} />
            </>
          )}
          <ErrorText>{error}</ErrorText>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
