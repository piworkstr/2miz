import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { DayDoc } from '../lib/daily';
import { prettyDate } from '../lib/date';
import { db } from '../lib/firebase';
import { saveTaskPhoto, shrink, updatePhotoNote, type Photo } from '../lib/photos';
import { taskById, taskTitle } from '../lib/tasks';
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
          <Muted>{`${prettyDate(day)} · ${taskTitle(taskById(props.fallbackTaskId), t.lang)}`}</Muted>
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

// Kendi fotoğrafının notunu sonradan ekle ya da değiştir: albümde kendi polaroidine basılı tutunca açılır.
export function EditPhotoNote({ photo, coupleId, name, onClose }: { photo: Photo; coupleId: string; name: string; onClose: () => void }) {
  const t = useTheme();
  const [note, setNote] = useState(photo.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await updatePhotoNote(coupleId, photo.id, note);
      onClose();
    } catch {
      setError('Kaydedilemedi; bağlantıyı kontrol edip tekrar dene.');
      setBusy(false);
    }
  }
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Kapat" style={{ alignSelf: 'flex-end' }}>
            <Ionicons name="close" size={28} color={t.colors.text} />
          </Pressable>
          <Title>{photo.note ? 'Notu düzenle' : 'Not ekle'}</Title>
          <Muted>{`${prettyDate(photo.day)} · fotoğrafın altında el yazısıyla görünür; albümde ve baskıda da çıkar.`}</Muted>
          <Polaroid
            photo={{ data: photo.data, note: note.trim() }}
            name={name}
            aspect={3 / 4}
            tilt={-2}
            style={{ alignSelf: 'center', width: '70%', marginVertical: 8 }}
          />
          <Input value={note} onChangeText={setNote} placeholder="Altına bir not" maxLength={60} autoFocus />
          <ErrorText>{error}</ErrorText>
          <Button label="Kaydet" onPress={save} busy={busy} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// Fotoğraf eklenmemiş geçmiş görev günleri: albümde hiç görünmeyen günlere sonradan fotoğraf eklemek için.
export function MissingPhotoDays(props: {
  coupleId: string;
  uid: string;
  days: { key: string; day: DayDoc }[] | null;
  havePhoto: Set<string>; // fotoğrafım olan günler
  today: string;
  onPick: (day: string, taskId: string) => void;
}) {
  const t = useTheme();
  if (props.days === null) return <Muted>Günler yükleniyor…</Muted>;
  // Görevi en az birinizin tamamladığı, bugünden önceki ve fotoğrafını eklemediğin günler.
  const missing = props.days.filter(
    (d) => d.key < props.today && !props.havePhoto.has(d.key) && Object.keys(d.day.completions ?? {}).length > 0,
  );
  if (!missing.length) return <Muted>Fotoğrafsız kalan bir görev günün yok.</Muted>;
  return (
    <View style={{ gap: 8 }}>
      <Muted>Bu günlerde görev yapılmış ama fotoğrafın yok. Eklediğin gün albümde bir sayfa olur.</Muted>
      {missing.map((d) => {
        const taskId = d.day.separate?.[props.uid] ?? d.day.sharedTaskId;
        return (
          <Pressable
            key={d.key}
            onPress={() => props.onPick(d.key, taskId)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: t.colors.card,
              borderWidth: 1,
              borderColor: t.colors.border,
              borderRadius: 14,
              padding: 12,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Muted style={{ fontSize: 12 }}>{prettyDate(d.key)}</Muted>
              <Text maxFontSizeMultiplier={1.25} numberOfLines={2} style={{ color: t.colors.text, fontFamily: t.fonts.body, fontSize: 15 }}>
                {taskTitle(taskById(taskId), t.lang)}
              </Text>
            </View>
            <Ionicons name="add-circle" size={26} color={t.colors.primary} />
          </Pressable>
        );
      })}
    </View>
  );
}
