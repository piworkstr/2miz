import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import { Image, Pressable, Text, TextInput, View, type ImageSourcePropType } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Card, Muted, Screen, T } from '../components/ui';
import { DART } from '../lib/dreamArt';
import { BOATS, homeOf, HOUSE_LV, ISLANDS, seaOf } from '../lib/dreams';
import { farmOf, farmSummary, levelOf } from '../lib/farm';
import { ART } from '../lib/farmArt';
import { db } from '../lib/firebase';
import { useSession } from '../lib/session';
import { useTheme } from '../lib/useTheme';

// Hayalimiz: çiftin gerçek hayali ve üç hayal dünyası. Altın üç dünyada ortak.
export default function DreamsScreen() {
  const t = useTheme();
  const { user, couple, profile, partnerProfile, partnerName } = useSession();
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState('');
  if (!user || !couple) return null;

  const farm = farmOf(couple);
  const sea = seaOf(couple);
  const home = homeOf(couple);
  const sum = farmSummary(farm, user.uid);
  const note = couple.dreamNote?.trim();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function save() {
    await updateDoc(doc(db, 'couples', couple!.id), { dreamNote: text.trim().slice(0, 240) }).catch(() => {});
    setEdit(false);
  }

  const world = (
    href: '/garden' | '/dream/sea' | '/dream/house',
    img: ImageSourcePropType,
    bg: string,
    title: string,
    line: string,
    stat: string,
  ) => (
    <Pressable key={href} onPress={() => router.push(href)}>
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10 }}>
        <View style={{ width: 96, height: 84, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={img} style={{ width: 84, height: 74 }} resizeMode="contain" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T style={{ fontWeight: '700', fontSize: 16 }}>{title}</T>
          <Muted style={{ fontSize: 12, lineHeight: 16 }}>{line}</Muted>
          <Text style={{ fontSize: 12, fontWeight: '800', color: t.colors.primary }}>{stat}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.colors.muted} />
      </Card>
    </Pressable>
  );

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={close} hitSlop={12} accessibilityLabel="Geri">
          <Ionicons name="chevron-back" size={28} color={t.colors.text} />
        </Pressable>
        <Avatar p={profile} name={profile?.name ?? ''} size={36} showMood={false} />
        <View style={{ marginLeft: -14 }}>
          <Avatar p={partnerProfile} name={partnerName} size={36} showMood={false} />
        </View>
        <Text style={{ flex: 1, fontFamily: t.fonts.title, fontSize: 30, color: t.colors.text }}>Hayalimiz</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: '#FFF3C4',
            borderRadius: 999,
            paddingVertical: 4,
            paddingLeft: 4,
            paddingRight: 10,
          }}
        >
          <Image source={ART.coin.src} style={{ width: 24, height: 21 }} />
          <Text style={{ fontWeight: '900', color: '#7A5A00', fontSize: 15 }}>{farm.coins}</Text>
        </View>
      </View>

      <Card style={{ gap: 6 }}>
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: t.colors.primary }}>GERÇEK HAYALİMİZ</Text>
        {edit ? (
          <>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              maxLength={240}
              placeholder="Örn. Emekli olunca küçük bir motor yat alıp koy koy gezeceğiz."
              placeholderTextColor={t.colors.muted}
              style={{
                minHeight: 70,
                color: t.colors.text,
                fontSize: 15,
                borderWidth: 1,
                borderColor: t.colors.border,
                borderRadius: 10,
                padding: 10,
              }}
            />
            <Pressable
              onPress={save}
              style={{
                alignSelf: 'flex-end',
                backgroundColor: t.colors.primary,
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: t.colors.onPrimary, fontWeight: '700' }}>Kaydet</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={() => {
              setText(note ?? '');
              setEdit(true);
            }}
          >
            <Text style={{ fontFamily: t.fonts.note, fontSize: 24, lineHeight: 28, color: t.colors.text }}>
              {note ? `“${note}”` : 'Birlikte hayal ettiğiniz hayatı buraya yazın. İkiniz de görürsünüz.'}
            </Text>
            <Muted style={{ fontSize: 12, textDecorationLine: 'underline' }}>{note ? 'Düzenle' : 'Yaz'}</Muted>
          </Pressable>
        )}
      </Card>

      {world(
        '/garden',
        ART.barn.src,
        '#8BC34F',
        'Bizim Çiftlik',
        'Ekin, birbirinizin ektiğini sulayın, araziyi büyütün.',
        `Seviye ${levelOf(farm.xp).level} · ${sum.fields} tarla${sum.ready ? ` · ${sum.ready} hazır` : ''}`,
      )}
      {world(
        '/dream/sea',
        DART[sea.boat].src,
        '#4FA8D8',
        'Mavi Yolculuk',
        'Sandalla başlayın, motor yata geçin. Koy koy gezin, balık tutun, kamp kurun.',
        sea.trip
          ? `${ISLANDS.find((i) => i.id === sea.trip!.to)?.name} yolunda ⛵`
          : `${BOATS[sea.boat].name} · ${Object.keys(sea.visited).length}/${ISLANDS.length} koy · ${sea.mem.length} anı`,
      )}
      {world(
        '/dream/house',
        DART[HOUSE_LV[home.lvl - 1].art].src,
        '#E99AB8',
        'Sahilde Ev',
        'Ege’de küçük bir evden villaya. Sabah kahvesi, mangal, bisiklet turu.',
        `${HOUSE_LV[home.lvl - 1].name} · ${home.huzur} huzur`,
      )}

      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <T style={{ fontWeight: '700', fontSize: 13 }}>Altın nereden gelir?</T>
        <Muted style={{ fontSize: 12, lineHeight: 17 }}>
          Günlük görevi ikiniz de yapınca 20 altın ve seri bonusu kumbaraya düşer; çiftlikte “Al” ile toplarsınız. Hasat, hayvan ürünleri,
          tutulan balıklar ve birlikte yaşanan anlar da altın getirir. Altın üç dünyada ortaktır.
        </Muted>
      </View>
    </Screen>
  );
}
