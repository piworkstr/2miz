import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { DEMO_COUPLE, PERSONAS, type PersonaId } from '../lib/demoPersona';
import { db } from '../lib/firebase';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';
import { Card, Muted, T } from './ui';

// Yalnız kurucu çiftte görünür: hesabı Mert ya da Bahar tanıtım kimliğine çevirir (ad, avatar, hitap).
export function PersonaCard() {
  const t = useTheme();
  const { user, couple, profile } = useSession();
  const [busy, setBusy] = useState<PersonaId | null>(null);
  if (!user || !couple || couple.id !== DEMO_COUPLE) return null;

  async function become(id: PersonaId) {
    if (!user) return;
    setBusy(id);
    const p = PERSONAS[id];
    try {
      // couples.names eşleşme anındaki adı tutar; partnerin ekranındaki ad buradan gelir.
      if (couple) await updateDoc(doc(db, 'couples', couple.id), { [`names.${user.uid}`]: p.name });
      await updateDoc(doc(db, 'users', user.uid), {
        name: p.name,
        avatar: { kind: 'photo', photo: p.photo },
        petNames: [...p.petNamesForPartner],
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={{ gap: 8 }}>
      <T style={{ fontSize: 16, fontWeight: '600', fontFamily: t.fonts.button }}>Tanıtım kimliği</T>
      <Muted style={{ fontSize: 12 }}>Ekran görüntüleri için hesabını Mert ya da Bahar yap. Şu an: {profile?.name}</Muted>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(Object.keys(PERSONAS) as PersonaId[]).map((id) => {
          const p = PERSONAS[id];
          const on = profile?.name === p.name;
          return (
            <Pressable
              key={id}
              onPress={() => become(id)}
              disabled={busy !== null}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                padding: 8,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: on ? t.colors.primary : t.colors.border,
                backgroundColor: on ? t.colors.primarySoft : 'transparent',
                opacity: busy && busy !== id ? 0.5 : 1,
              }}
            >
              <Image source={{ uri: `data:image/jpeg;base64,${p.photo}` }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              <Text style={{ fontWeight: '700', color: t.colors.text }}>{busy === id ? '…' : `${p.name} ol`}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}
