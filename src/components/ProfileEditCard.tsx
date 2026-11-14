import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { updateProfile } from 'firebase/auth';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ageFrom, DateInput, toDateKey, type DateParts } from './DateInput';
import { Avatar } from './Avatar';
import { auth, db } from '../lib/firebase';
import { GENDER_OPTIONS, type Gender } from '../lib/gender';
import { INTERESTS } from '../lib/interests';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Button, Card, ErrorText, Input, Muted, T } from './ui';

// Profil düzenleme: ad, doğum tarihi, telefon, sevdiklerin, avatar. Ad hem kullanıcı belgesine hem çiftteki isim haritasına yazılır.
function partsOf(key?: string): DateParts {
  const m = key?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? { d: m[3], m: m[2], y: m[1] } : { d: '', m: '', y: '' };
}

export function ProfileEditCard() {
  const t = useTheme();
  const { user, profile, couple } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [birth, setBirth] = useState<DateParts>({ d: '', m: '', y: '' });
  const [phone, setPhone] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [gender, setGender] = useState<Gender | ''>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user || !profile) return null;

  const start = () => {
    setName(profile.name ?? '');
    setBirth(partsOf(profile.birthDate));
    setPhone(profile.phone ?? '');
    setInterests(profile.interests ?? []);
    setGender(profile.gender ?? '');
    setError('');
    setOpen(true);
  };

  async function save() {
    if (!user || busy) return;
    const n = name.trim().slice(0, 30);
    if (!n) return setError('Partnerinin göreceği adını yaz.');
    const key = toDateKey(birth);
    if (!key) return setError('Doğum tarihini gün / ay / yıl olarak gir.');
    if (ageFrom(key) < 18) return setError('2miz, 18 yaş ve üzeri içindir.');
    setBusy(true);
    setError('');
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        name: n,
        birthDate: key,
        phone: phone.replace(/[^0-9+]/g, '').slice(0, 16),
        interests,
        gender: gender || deleteField(),
      });
      if (couple) await updateDoc(doc(db, 'couples', couple.id), { [`names.${user.uid}`]: n }).catch(() => {});
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: n }).catch(() => {});
      setOpen(false);
    } catch {
      setError('Kaydedilemedi, tekrar dene.');
    } finally {
      setBusy(false);
    }
  }

  const bd = partsOf(profile.birthDate);
  const bdText = bd.d ? `${bd.d}.${bd.m}.${bd.y}` : 'Doğum tarihi yok';

  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.push('/avatar')} accessibilityLabel="Avatarını değiştir">
          <Avatar p={profile} name={profile.name} size={48} showMood={false} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>{profile.name}</T>
          <Muted style={{ fontSize: 12 }}>{bdText}</Muted>
        </View>
        {!open && (
          <Pressable onPress={start} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 }}>
            <Ionicons name="create-outline" size={18} color={t.colors.primary} />
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontWeight: '600' }}>
              Düzenle
            </Text>
          </Pressable>
        )}
      </View>
      {open && (
        <>
          <Muted style={{ fontSize: 12 }}>Adın</Muted>
          <Input value={name} onChangeText={setName} maxLength={30} placeholder="Adın" autoCapitalize="words" />
          <Muted style={{ fontSize: 12 }}>Doğum tarihin (partnerin kutlaması için)</Muted>
          <DateInput value={birth} onChange={setBirth} />
          <Muted style={{ fontSize: 12 }}>Telefon numaran (isteğe bağlı · yalnızca partnerin görür, oyunda “Ara” için)</Muted>
          <Input value={phone} onChangeText={setPhone} maxLength={18} placeholder="+90 5xx xxx xx xx" keyboardType="phone-pad" />
          <Muted style={{ fontSize: 12 }}>Cinsiyetin (isteğe bağlı · yalnızca önerileri sana göre sıralamak için)</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {GENDER_OPTIONS.map((o) => {
              const on = gender === o.id;
              return (
                <Pressable
                  key={o.id || 'yok'}
                  onPress={() => setGender(o.id)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: on ? t.colors.primary : t.colors.border,
                    backgroundColor: on ? t.colors.primarySoft : t.colors.card,
                  }}
                >
                  <Text
                    maxFontSizeMultiplier={1.25}
                    style={{ color: on ? t.colors.onPrimarySoft : t.colors.text, fontWeight: on ? '700' : '400' }}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Muted style={{ fontSize: 12 }}>Sevdiklerin (partnerin “Birbirinizi tanıyın” bölümünde görür)</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INTERESTS.map((i) => {
              const on = interests.includes(i);
              return (
                <Pressable
                  key={i}
                  onPress={() => setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))}
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 12,
                    borderRadius: 18,
                    borderWidth: 1.5,
                    borderColor: on ? t.colors.primary : t.colors.border,
                    backgroundColor: on ? t.colors.primarySoft : t.colors.card,
                  }}
                >
                  <Text maxFontSizeMultiplier={1.25} style={{ color: on ? t.colors.primary : t.colors.text, fontSize: 14 }}>
                    {i}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button style={{ flex: 1 }} label="Vazgeç" variant="secondary" onPress={() => setOpen(false)} />
            <Button style={{ flex: 1 }} label="Kaydet" onPress={save} busy={busy} />
          </View>
          <ErrorText>{error}</ErrorText>
          <Pressable onPress={() => router.push('/avatar')} style={{ alignItems: 'center', padding: 4 }}>
            <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.primary, fontSize: 13 }}>
              Avatarını / fotoğrafını değiştir
            </Text>
          </Pressable>
        </>
      )}
    </Card>
  );
}
