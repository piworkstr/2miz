import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveBonusPhotos, shrink } from '../lib/photos';
import { taskById, taskTitle } from '../lib/tasks';
import { useTheme } from '../lib/useTheme';
import { Button, ErrorText, Input, Muted, Title } from './ui';

export const BONUS_PHOTO_MAX = 3;

// Bonus görev tamamlanırken (ya da sonradan) o göreve birkaç fotoğraf ve kısa bir not eklenir.
// Fotoğraflar albüme "Bonus görev" sayfası olarak düşer. Fotoğraf eklemek zorunlu değildir.
export function BonusDoneSheet(props: {
  open: boolean;
  onClose: () => void;
  coupleId: string;
  uid: string;
  day: string;
  taskId: string;
  doneLabel?: string; // verilirse görev de tamamlanır (onDone); verilmezse yalnızca fotoğraf eklenir
  onDone?: () => Promise<boolean | void>;
}) {
  const { open, onClose, coupleId, uid, day, taskId } = props;
  const t = useTheme();
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'pick' | 'save' | null>(null);
  const [error, setError] = useState('');

  const close = () => {
    setPhotos([]);
    setNote('');
    setError('');
    setBusy(null);
    onClose();
  };

  async function pick(from: 'camera' | 'library') {
    if (busy || photos.length >= BONUS_PHOTO_MAX) return;
    setError('');
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setError('Kamera izni gerekiyor. İzin vermek istemezsen galeriden seçebilirsin.');
      }
      const left = BONUS_PHOTO_MAX - photos.length;
      const res =
        from === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: true })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 1,
              exif: true,
              allowsMultipleSelection: left > 1,
              selectionLimit: left,
            });
      if (res.canceled || !res.assets.length) return;
      setBusy('pick');
      const out: string[] = [];
      for (const a of res.assets.slice(0, left))
        out.push(await shrink(a.uri, { width: a.width, height: a.height, orientation: a.exif?.Orientation as number | undefined }));
      setPhotos((p) => [...p, ...out].slice(0, BONUS_PHOTO_MAX));
    } catch {
      setError('Fotoğraf alınamadı, tekrar dene.');
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (busy) return;
    setBusy('save');
    setError('');
    try {
      if (props.onDone && (await props.onDone()) === false) {
        setError('Görev tamamlanamadı; bağlantıyı kontrol edip tekrar dene.');
        return setBusy(null);
      }
      if (photos.length) await saveBonusPhotos(coupleId, day, uid, taskId, note.slice(0, 60), photos);
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
          <Title>{props.onDone ? 'Görevi tamamla' : 'Fotoğraf ekle'}</Title>
          <Muted>{taskTitle(taskById(taskId), t.lang)}</Muted>
          <Muted>{`Bu göreve ${BONUS_PHOTO_MAX} fotoğrafa kadar ekleyebilirsin; albümünüze "Bonus görev" olarak düşer.${props.onDone ? ' İstersen fotoğrafsız da tamamlayabilirsin.' : ''}`}</Muted>

          {photos.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {photos.map((d, i) => (
                <View key={i} style={{ flex: 1, maxWidth: '32%' }}>
                  <Image source={{ uri: `data:image/jpeg;base64,${d}` }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 10 }} />
                  <Pressable
                    onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    hitSlop={8}
                    accessibilityLabel="Fotoğrafı çıkar"
                    style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 2 }}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {photos.length < BONUS_PHOTO_MAX && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button style={{ flex: 1 }} variant="secondary" label="Fotoğraf çek" busy={busy === 'pick'} onPress={() => pick('camera')} />
              <Button
                style={{ flex: 1 }}
                variant="secondary"
                label="Galeriden seç"
                busy={busy === 'pick'}
                onPress={() => pick('library')}
              />
            </View>
          )}
          {photos.length > 0 && <Input value={note} onChangeText={setNote} placeholder="Kısa bir not (isteğe bağlı)" maxLength={60} />}
          {!!error && <ErrorText>{error}</ErrorText>}
          {(props.onDone || photos.length > 0) && (
            <Button
              label={props.onDone ? (photos.length ? (props.doneLabel ?? 'Tamamla') : 'Fotoğrafsız tamamla') : 'Albüme ekle'}
              busy={busy === 'save'}
              onPress={save}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
