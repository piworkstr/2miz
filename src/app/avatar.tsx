import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { Button, Muted } from '../components/ui';
import { avatarSvg, DEFAULT_OPTS, OPTIONS, randomOpts, saveAvatar, type AvatarOpts } from '../lib/avatar';
import { shrinkTo } from '../lib/photos';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

type Cat = keyof AvatarOpts;
const CATS: { key: Cat; label: string; color?: boolean }[] = [
  { key: 'skin', label: 'Ten', color: true },
  { key: 'top', label: 'Saç' },
  { key: 'hairColor', label: 'Saç rengi', color: true },
  { key: 'eyes', label: 'Gözler' },
  { key: 'eyebrows', label: 'Kaşlar' },
  { key: 'mouth', label: 'Ağız' },
  { key: 'facialHair', label: 'Sakal' },
  { key: 'accessories', label: 'Gözlük' },
  { key: 'clothing', label: 'Kıyafet' },
  { key: 'clothesColor', label: 'Renk', color: true },
  { key: 'bg', label: 'Arka plan', color: true },
];

// Avatar düzenleyici: karakterini oluştur ya da fotoğraf koy.
export default function AvatarScreen() {
  const t = useTheme();
  const { user, profile } = useSession();
  const current = profile?.avatar;
  const [tab, setTab] = useState<'drawn' | 'photo'>(current?.kind === 'photo' ? 'photo' : 'drawn');
  const [opts, setOpts] = useState<AvatarOpts>(current?.kind === 'drawn' ? { ...DEFAULT_OPTS, ...current.opts } : DEFAULT_OPTS);
  const [photo, setPhoto] = useState<string | null>(current?.kind === 'photo' ? current.photo : null);
  const [cat, setCat] = useState<Cat>('top');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => avatarSvg(opts), [opts]);
  const faceCat = cat === 'eyes' || cat === 'eyebrows' || cat === 'mouth';
  const catInfo = CATS.find((c) => c.key === cat)!;

  async function pick(camera: boolean) {
    setError('');
    const res = camera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    try {
      setPhoto(await shrinkTo(res.assets[0].uri, 320, 0.6));
    } catch {
      setError('Fotoğraf işlenemedi, başka bir tane dene.');
    }
  }

  async function save() {
    if (!user || busy) return;
    if (tab === 'photo' && !photo) return setError('Önce bir fotoğraf seç.');
    setBusy(true);
    try {
      await saveAvatar(user.uid, tab === 'photo' ? { kind: 'photo', photo: photo! } : { kind: 'drawn', opts });
      router.back();
    } catch {
      setError('Kaydedilemedi, tekrar dene.');
      setBusy(false);
    }
  }

  const chip = (on: boolean) => ({
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: on ? t.colors.primary : t.colors.border,
    backgroundColor: on ? t.colors.primary : t.colors.card,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={t.colors.text} />
          <Text style={{ color: t.colors.text, fontSize: 15 }}>{tx(t, 'Geri')}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['drawn', 'photo'] as const).map((k) => (
            <Pressable key={k} onPress={() => setTab(k)} style={chip(tab === k)}>
              <Text style={{ fontWeight: '600', color: tab === k ? t.colors.onPrimary : t.colors.text }}>{k === 'drawn' ? 'Avatarım' : 'Fotoğrafım'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'drawn' ? (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 8, gap: 10 }}>
            <SvgXml xml={preview} width={170} height={170} />
            <Pressable
              onPress={() => setOpts(randomOpts())}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name="shuffle" size={18} color={t.colors.primary} />
              <Text style={{ color: t.colors.primary, fontWeight: '600' }}>Rastgele</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 6 }} style={{ flexGrow: 0 }}>
            {CATS.map((c) => (
              <Pressable key={c.key} onPress={() => setCat(c.key)} style={chip(cat === c.key)}>
                <Text style={{ fontWeight: '600', color: cat === c.key ? t.colors.onPrimary : t.colors.text }}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16, justifyContent: 'center' }}>
            {OPTIONS[cat].map((v) => {
              const on = opts[cat] === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setOpts((o) => ({ ...o, [cat]: v }))}
                  style={{
                    width: catInfo.color ? 48 : 74,
                    height: catInfo.color ? 48 : 74,
                    borderRadius: catInfo.color ? 24 : 16,
                    borderWidth: on ? 3 : 1,
                    borderColor: on ? t.colors.primary : t.colors.border,
                    backgroundColor: catInfo.color ? `#${v}` : t.colors.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {!catInfo.color &&
                    (v === 'none' ? (
                      <Ionicons name="close" size={26} color={t.colors.muted} />
                    ) : (
                      <SvgXml xml={avatarSvg({ ...opts, [cat]: v }, null, false, faceCat)} width={68} height={68} />
                    ))}
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', padding: 24, gap: 16 }}>
          {photo ? (
            <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={{ width: 180, height: 180, borderRadius: 90 }} />
          ) : (
            <View style={{ width: 180, height: 180, borderRadius: 90, backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person" size={80} color={t.colors.primary} />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <Button style={{ flex: 1 }} label="Fotoğraf çek" variant="secondary" onPress={() => pick(true)} />
            <Button style={{ flex: 1 }} label="Galeriden seç" variant="secondary" onPress={() => pick(false)} />
          </View>
          <Muted style={{ textAlign: 'center', fontSize: 12 }}>
            Fotoğrafın sadece partnerine görünür. Çizilmiş avatarda ruh haline göre yüz ifaden de değişir.
          </Muted>
        </View>
      )}

      <View style={{ padding: 16, gap: 6, borderTopWidth: 1, borderTopColor: t.colors.border }}>
        {!!error && <Text style={{ color: t.colors.primary, textAlign: 'center' }}>{error}</Text>}
        {busy ? <ActivityIndicator color={t.colors.primary} /> : <Button label="Kaydet" onPress={save} />}
      </View>
    </SafeAreaView>
  );
}
