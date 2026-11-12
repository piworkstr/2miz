import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { Blocks } from '../../components/games/Blocks';
import { Tavla } from '../../components/games/Tavla';
import { KnowMe } from '../../components/games/KnowMe';
import { Memory } from '../../components/games/Memory';
import { ThisThat } from '../../components/games/ThisThat';
import { Button, Card, Loading, Muted, Screen } from '../../components/ui';
import {
  abandonGame,
  acceptInvite,
  cancelInvite,
  GAMES,
  gameOver,
  isExpired,
  partnerJoined,
  useGame,
  type Game,
  type GameProps,
} from '../../lib/games';
import { useSession } from '../../lib/session';
import { useTheme } from '../../lib/useTheme';

export default function GameScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const game = useGame(couple?.id, id);
  const [asking, setAsking] = useState(false);

  // Oyunu açmak katılmak demektir: partnerin başlattığı oyuna girince sıra bana da gelmeye başlar.
  useEffect(() => {
    if (!game || !user || !couple) return;
    if (user.uid === game.to && !partnerJoined(game) && !gameOver(game)) acceptInvite(couple.id, game.id, user.uid).catch(() => {});
  }, [game?.id, game?.joined?.[user?.uid ?? ''], user?.uid, couple?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (game === undefined || !user || !couple || !partnerId) return <Loading />;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Süren oyundan çıkarken sorulur: sonlandır (yenisi başlatılabilir) ya da sonra devam et.
  const exit = () => (game && game.status === 'playing' && !gameOver(game) ? setAsking(true) : close());
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={exit} hitSlop={12}>
        <Ionicons name="close" size={28} color={t.colors.text} />
      </Pressable>
      <Text
        maxFontSizeMultiplier={1.25}
        style={{ flex: 1, color: t.colors.text, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}
      >
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
    onExit: exit,
  };

  // Blok sürüklemeyle oynanır: kaydırma yok (ekran yukarı kaymasın); kendi kapat düğmesi var.
  const drag = game.type === 'blocks' || game.type === 'tavla';
  // Partner henüz katılmadı: yalnız oynanıyor; katılınca sıra ona da geçer (Tavla'da o zamana dek bilgisayar).
  const solo = !partnerJoined(game) && !gameOver(game);
  const soloNote = solo && (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: t.colors.primarySoft,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Ionicons name="person-outline" size={16} color={t.colors.primary} />
      <Muted style={{ flex: 1, fontSize: 12 }}>
        {game.declined?.[partnerId]
          ? `${partnerName} şimdi müsait değil; yalnız devam ediyorsun.`
          : `${partnerName}'e haber gitti; katılana kadar yalnız oynuyorsun${game.type === 'tavla' ? ', rakibin bilgisayar' : ''}.`}
      </Muted>
    </View>
  );
  return (
    <Screen scroll={!drag}>
      {game.type !== 'blocks' && header}
      {soloNote}
      {game.type === 'thisthat' && <ThisThat {...props} />}
      {game.type === 'knowme' && <KnowMe {...props} />}
      {game.type === 'memory' && <Memory {...props} />}
      {game.type === 'blocks' && <Blocks {...props} />}
      {game.type === 'tavla' && <Tavla {...props} />}
      <Modal transparent animationType="fade" visible={asking} onRequestClose={() => setAsking(false)}>
        <Pressable
          onPress={() => setAsking(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', padding: 16, paddingBottom: 34 }}
        >
          <Pressable style={{ backgroundColor: t.colors.card, borderRadius: Math.max(t.radius.card, 14), padding: 18, gap: 10 }}>
            <Text
              maxFontSizeMultiplier={1.25}
              style={{ color: t.colors.text, fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button, textAlign: 'center' }}
            >
              Oyundan çıkıyorsun
            </Text>
            <Muted style={{ textAlign: 'center' }}>Oyun sonlandırılsın mı? Sonlandırırsan yeni bir oyun başlatabilirsin.</Muted>
            <Button
              label="Sonra devam et"
              onPress={() => {
                setAsking(false);
                close();
              }}
            />
            <Button
              label="Oyunu sonlandır"
              variant="secondary"
              onPress={async () => {
                setAsking(false);
                await abandonGame(couple.id, game.id).catch(() => {});
                close();
              }}
            />
            <Pressable onPress={() => setAsking(false)} style={{ alignItems: 'center', padding: 6 }}>
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted }}>
                Oyuna dön
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
          <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: t.fonts.title, fontSize: 30, color: t.colors.text, textAlign: 'center' }}>
            Şimdi olmaz
          </Text>
          <Muted style={{ textAlign: 'center' }}>{partnerName} şu an müsait değil. Biraz sonra tekrar davet edebilirsin.</Muted>
          <Button style={{ alignSelf: 'stretch' }} label="Tamam" onPress={onClose} />
        </>
      ) : expired ? (
        <>
          <Muted style={{ textAlign: 'center' }}>
            {game.status === 'cancelled'
              ? 'Bu oyun sonlandırıldı. Ana ekrandan yenisini başlatabilirsiniz.'
              : 'Davetin süresi doldu. Belki daha sonra?'}
          </Muted>
          <Button style={{ alignSelf: 'stretch' }} label="Tamam" onPress={onClose} />
        </>
      ) : (
        <>
          <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: t.fonts.title, fontSize: 30, color: t.colors.text, textAlign: 'center' }}>
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
