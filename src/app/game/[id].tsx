import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { KnowMe } from '../../components/games/KnowMe';
import { Memory } from '../../components/games/Memory';
import { ThisThat } from '../../components/games/ThisThat';
import { Button, Card, Loading, Muted, Screen } from '../../components/ui';
import { cancelInvite, GAMES, isExpired, useGame, type Game, type GameProps } from '../../lib/games';
import { useSession } from '../../lib/session';
import { useTheme } from '../../lib/useTheme';

export default function GameScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const game = useGame(couple?.id, id);

  if (game === undefined || !user || !couple || !partnerId) return <Loading />;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={close} hitSlop={12}>
        <Ionicons name="close" size={28} color={t.colors.text} />
      </Pressable>
      <Text style={{ flex: 1, color: t.colors.text, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>
        {game ? GAMES[game.type].name : 'Oyun'}
      </Text>
    </View>
  );

  if (!game) {
    return (
      <Screen>
        {header}
        <Muted>Bu oyun bulunamadı.</Muted>
        <Button label="Geri dön" onPress={close} />
      </Screen>
    );
  }

  if (game.status === 'invited' || game.status === 'declined' || game.status === 'cancelled') {
    return (
      <Screen>
        {header}
        <Waiting game={game} coupleId={couple.id} partnerName={partnerName} onClose={close} />
      </Screen>
    );
  }

  const props: GameProps = {
    game,
    coupleId: couple.id,
    uid: user.uid,
    partnerId,
    partnerName,
    myName: profile?.name ?? 'Sen',
  };

  return (
    <Screen>
      {header}
      {game.type === 'thisthat' && <ThisThat {...props} />}
      {game.type === 'knowme' && <KnowMe {...props} />}
      {game.type === 'memory' && <Memory {...props} />}
    </Screen>
  );
}

function Waiting({ game, coupleId, partnerName, onClose }: { game: Game; coupleId: string; partnerName: string; onClose: () => void }) {
  const t = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  const expired = isExpired(game) || game.status === 'cancelled';
  const icon: ComponentProps<typeof Ionicons>['name'] =
    game.status === 'declined' ? 'moon-outline' : expired ? 'time-outline' : 'paper-plane-outline';
  const left = Math.max(0, game.expiresAt - now);
  const mm = Math.floor(left / 60000);
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');

  return (
    <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 14 }}>
      <Ionicons name={icon} size={40} color={t.colors.primary} />
      {game.status === 'declined' ? (
        <>
          <Text style={{ fontFamily: t.fonts.title, fontSize: 30, color: t.colors.text, textAlign: 'center' }}>Şimdi olmaz</Text>
          <Muted style={{ textAlign: 'center' }}>
            {partnerName} şu an müsait değil. Biraz sonra tekrar davet edebilirsin.
          </Muted>
          <Button style={{ alignSelf: 'stretch' }} label="Tamam" onPress={onClose} />
        </>
      ) : expired ? (
        <>
          <Muted style={{ textAlign: 'center' }}>Davetin süresi doldu. Belki daha sonra?</Muted>
          <Button style={{ alignSelf: 'stretch' }} label="Tamam" onPress={onClose} />
        </>
      ) : (
        <>
          <Text style={{ fontFamily: t.fonts.title, fontSize: 30, color: t.colors.text, textAlign: 'center' }}>
            {partnerName} bekleniyor
          </Text>
          <ActivityIndicator color={t.colors.primary} />
          <Muted style={{ textAlign: 'center' }}>
            Davet {partnerName}'in ekranına düştü. Kabul edince oyun burada başlayacak. Kalan süre {mm}:{ss}
          </Muted>
          <Button
            style={{ alignSelf: 'stretch' }}
            variant="secondary"
            label="Daveti geri al"
            onPress={async () => {
              await cancelInvite(coupleId, game.id);
              onClose();
            }}
          />
        </>
      )}
    </Card>
  );
}
