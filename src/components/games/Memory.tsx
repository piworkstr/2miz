import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { endTurn, flipCard, type GameProps } from '../../lib/games';
import { photoUri, usePhotos } from '../../lib/photos';
import { useTheme } from '../../lib/useTheme';
import { Card, Muted } from '../ui';
import { Done, ResultHeader, useFinishOnce } from './shared';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Sıra tabanlı hafıza oyunu: albümdeki selfieleriniz kart olur. Eşleştiren bir puan alır ve tekrar oynar.
export function Memory({ game, coupleId, uid, partnerId, partnerName }: GameProps) {
  const t = useTheme();
  const photos = usePhotos(coupleId, 60);
  const [busy, setBusy] = useState(false);
  const m = game.memory!;
  const byId = useMemo(() => new Map((photos ?? []).map((p) => [p.id, p])), [photos]);
  const finished = m.matched.length >= m.deck.length;
  useFinishOnce(finished, game, coupleId, uid);

  const myTurn = m.turn === uid;

  // Uygulama tam bu sırada kapanıp açıldıysa, açık kalan iki kart kapanıp sıra geçsin.
  const stuck = myTurn && m.flipped.length === 2 && !busy;
  useEffect(() => {
    if (!stuck) return;
    const tm = setTimeout(() => endTurn(coupleId, game.id, partnerId), 1300);
    return () => clearTimeout(tm);
  }, [stuck, coupleId, game.id, partnerId]);
  const myScore = m.scores[uid] ?? 0;
  const theirScore = m.scores[partnerId] ?? 0;

  async function tap(i: number) {
    if (!myTurn || busy || finished) return;
    setBusy(true);
    try {
      const r = await flipCard(coupleId, game.id, uid, i);
      if (r === 'miss') {
        // İkinize de kartları göstermek için kısa bir bekleme, sonra sıra partnere geçer.
        setTimeout(() => {
          endTurn(coupleId, game.id, partnerId).finally(() => setBusy(false));
        }, 1300);
        return;
      }
    } catch {
      // ağ hatasında sessizce devam
    }
    setBusy(false);
  }

  const status = finished
    ? null
    : myTurn
      ? m.flipped.length === 2
        ? 'Eşleşmedi…'
        : 'Senin sıran, iki kart aç'
      : `${partnerName} oynuyor…`;

  const winner = myScore === theirScore ? 'Berabere!' : myScore > theirScore ? 'Sen kazandın!' : `${partnerName} kazandı!`;

  const grid = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {m.deck.map((face, i) => {
        const open = m.matched.includes(i) || m.flipped.includes(i);
        const matched = m.matched.includes(i);
        const photo = face.startsWith('icon:') ? undefined : byId.get(face);
        return (
          <Pressable
            key={i}
            onPress={() => tap(i)}
            style={{
              width: '31.5%',
              aspectRatio: 0.8,
              borderRadius: Math.min(t.radius.card, 10),
              overflow: 'hidden',
              borderWidth: matched ? 2 : 1,
              borderColor: matched ? t.colors.primary : t.colors.border,
              backgroundColor: open ? '#fff' : t.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: matched && finished ? 0.95 : 1,
            }}
          >
            {open ? (
              photo ? (
                <Image source={{ uri: photoUri(photo) }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons
                  name={(face.startsWith('icon:') ? face.slice(5) : 'image-outline') as IconName}
                  size={34}
                  color={t.colors.primary}
                />
              )
            ) : (
              <Ionicons name={t.id === 'agir' ? 'flash' : 'heart'} size={26} color={t.colors.onPrimary} />
            )}
          </Pressable>
        );
      })}
    </View>
  );

  if (finished) {
    return (
      <Done>
        <ResultHeader big={`${myScore}-${theirScore}`} line={winner} game={game} uid={uid} />
        {grid}
      </Done>
    );
  }

  return (
    <>
      <Card style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
        <Score label="Sen" value={myScore} active={myTurn} />
        <Score label={partnerName} value={theirScore} active={!myTurn} />
      </Card>
      <Text
        maxFontSizeMultiplier={1.25}
        style={{ textAlign: 'center', color: myTurn ? t.colors.primary : t.colors.muted, fontWeight: '600', fontFamily: t.fonts.body }}
      >
        {status}
      </Text>
      {grid}
      {photos !== null && photos.length < 6 && (
        <Muted style={{ textAlign: 'center', fontSize: 12 }}>Albümünüz büyüdükçe kartlarda daha çok selfieniz olacak.</Muted>
      )}
    </>
  );
}

function Score({ label, value, active }: { label: string; value: number; active: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text maxFontSizeMultiplier={1.25} style={{ fontSize: 26, fontWeight: '700', color: active ? t.colors.primary : t.colors.text }}>
        {value}
      </Text>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}
