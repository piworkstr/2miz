import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArtAvatar } from '../components/ArtAvatar';
import { Button, Muted } from '../components/ui';
import { ART, DEFAULT_ART, randomArt, saveAvatar, type ArtItem, type ArtOpts } from '../lib/avatar';
import { shrinkTo } from '../lib/photos';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

// Avatar düzenleyici: Mert & Bahar çizimleriyle aynı stilde karakterini oluştur ya da fotoğraf koy.
type Cat = keyof ArtOpts;
const CATS: { key: Cat; label: string; color?: boolean; crop?: 'circle' | 'bust' }[] = [
  { key: 'skin', label: 'Ten', color: true },
  { key: 'face', label: 'Yüz' },
  { key: 'hair', label: 'Saç' },
  { key: 'hairColor', label: 'Saç rengi', color: true },
  { key: 'beard', label: 'Sakal' },
  { key: 'glasses', label: 'Gözlük' },
  { key: 'head', label: 'Başlık' },
  { key: 'top', label: 'Kıyafet', crop: 'bust' },
  { key: 'clothColor', label: 'Kıyafet rengi', color: true },
  { key: 'bg', label: 'Arka plan', color: true },
];

export default function AvatarScreen() {
  const t = useTheme();
  const { user, profile } = useSession();
  const current = profile?.avatar;
  const [tab, setTab] = useState<'art' | 'photo'>(current?.kind === 'photo' ? 'photo' : 'art');
  const [opts, setOpts] = useState<ArtOpts>(current?.kind === 'art' ? { ...DEFAULT_ART, ...current.opts } : DEFAULT_ART);
  const [photo, setPhoto] = useState<string | null>(current?.kind === 'photo' ? current.photo : null);
  const [cat, setCat] = useState<Cat>('hair');
  const [hairSet, setHairSet] = useState<'f' | 'm'>('f');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
      await saveAvatar(user.uid, tab === 'photo' ? { kind: 'photo', photo: photo! } : { kind: 'art', opts });
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
  const chipText = (on: boolean) => ({ fontWeight: '600' as const, color: on ? t.colors.onPrimary : t.colors.text });

  // seçenekler
  const colors = catInfo.color ? (ART[cat as 'skin' | 'hairColor' | 'clothColor' | 'bg'] as string[]) : null;
  let items: ArtItem[] | null = catInfo.color ? null : (ART[cat as 'face' | 'hair' | 'beard' | 'glasses' | 'head' | 'top'] as ArtItem[]);
  if (cat === 'hair' && items) items = items.filter((h) => h.id === 'none' || (hairSet === 'f' ? h.f : h.m));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top']}>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={t.colors.text} />
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15 }}>
            {tx(t, 'Geri')}
          </Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['art', 'photo'] as const).map((k) => (
            <Pressable key={k} onPress={() => setTab(k)} style={chip(tab === k)}>
              <Text maxFontSizeMultiplier={1.25} style={chipText(tab === k)}>
                {k === 'art' ? 'Avatarım' : 'Fotoğrafım'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {tab === 'art' ? (
        <>
          <View style={{ alignItems: 'center', paddingVertical: 4, gap: 8 }}>
            <View style={{ width: 200, height: 191, borderRadius: 28, overflow: 'hidden', backgroundColor: opts.bg }}>
              <ArtAvatar opts={opts} size={200} variant="bust" />
            </View>
            <Pressable
              onPress={() => setOpts(randomArt())}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.6 : 1 })}
            >
              <Ionicons name="shuffle" size={18} color={t.colors.primary} />
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600' }}>
                Rastgele
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 6 }}
            style={{ flexGrow: 0 }}
          >
            {CATS.map((c) => (
              <Pressable key={c.key} onPress={() => setCat(c.key)} style={chip(cat === c.key)}>
                <Text maxFontSizeMultiplier={1.25} style={chipText(cat === c.key)}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {cat === 'hair' && (
            <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: 4 }}>
              {(['f', 'm'] as const).map((k) => (
                <Pressable key={k} onPress={() => setHairSet(k)} style={[chip(hairSet === k), { paddingVertical: 5 }]}>
                  <Text maxFontSizeMultiplier={1.25} style={[chipText(hairSet === k), { fontSize: 12 }]}>
                    {k === 'f' ? 'Kadın' : 'Erkek'}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16, justifyContent: 'center' }}>
            {colors?.map((v) => {
              const on = opts[cat] === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setOpts((o) => ({ ...o, [cat]: v }))}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    borderWidth: on ? 3 : 1,
                    borderColor: on ? t.colors.primary : t.colors.border,
                    backgroundColor: v,
                  }}
                />
              );
            })}
            {items?.map((it) => {
              const on = opts[cat] === it.id;
              const preview: ArtOpts = { ...opts, [cat]: it.id } as ArtOpts;
              return (
                <Pressable
                  key={it.id}
                  onPress={() => setOpts((o) => ({ ...o, [cat]: it.id }))}
                  style={{
                    width: 78,
                    borderRadius: 16,
                    borderWidth: on ? 3 : 1,
                    borderColor: on ? t.colors.primary : t.colors.border,
                    backgroundColor: t.colors.card,
                    alignItems: 'center',
                    overflow: 'hidden',
                    paddingBottom: 4,
                  }}
                >
                  {it.id === 'none' ? (
                    <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="close" size={26} color={t.colors.muted} />
                    </View>
                  ) : catInfo.crop === 'bust' ? (
                    <ArtAvatar opts={preview} size={72} variant="bust" />
                  ) : (
                    <ArtAvatar opts={preview} size={72} variant="circle" style={{ backgroundColor: 'transparent' }} />
                  )}
                  <Text maxFontSizeMultiplier={1.0} numberOfLines={1} style={{ fontSize: 10, color: t.colors.muted }}>
                    {it.label}
                  </Text>
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
            <View
              style={{
                width: 180,
                height: 180,
                borderRadius: 90,
                backgroundColor: t.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="person" size={80} color={t.colors.primary} />
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
            <Button style={{ flex: 1 }} label="Fotoğraf çek" variant="secondary" onPress={() => pick(true)} />
            <Button style={{ flex: 1 }} label="Galeriden seç" variant="secondary" onPress={() => pick(false)} />
          </View>
          <Muted style={{ textAlign: 'center', fontSize: 12 }}>
            Fotoğrafın sadece partnerine görünür. Çizgi avatarda ruh haline göre yüz ifaden de değişir.
          </Muted>
        </View>
      )}

      <View style={{ padding: 16, gap: 6, borderTopWidth: 1, borderTopColor: t.colors.border }}>
        {!!error && (
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, textAlign: 'center' }}>
            {error}
          </Text>
        )}
        {busy ? <ActivityIndicator color={t.colors.primary} /> : <Button label="Kaydet" onPress={save} />}
      </View>
    </SafeAreaView>
  );
}
