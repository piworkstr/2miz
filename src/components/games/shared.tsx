import { router } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { finishGame, GAME_POINTS, type Game } from '../../lib/games';
import { useTheme } from '../../lib/useTheme';
import { Button, Card, Muted } from '../ui';

// Oyun bittiğinde bir kez "bitirdim" işaretler (ikisi de bitirince puan verilir).
export function useFinishOnce(done: boolean, game: Game, coupleId: string, uid: string) {
  const sent = useRef(false);
  useEffect(() => {
    if (done && !sent.current && !game.finished?.[uid]) {
      sent.current = true;
      finishGame(coupleId, game.id, uid).catch(() => {
        sent.current = false;
      });
    }
  }, [done, game, coupleId, uid]);
}

export function BigChoice({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 120,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: Math.max(t.radius.card, 6),
        borderWidth: 2,
        borderColor: pressed ? t.colors.primary : t.colors.border,
        backgroundColor: pressed ? t.colors.primarySoft : t.colors.card,
      })}
    >
      <Text
        maxFontSizeMultiplier={1.25}
        style={{ fontFamily: t.fonts.display, fontSize: 24, lineHeight: 30, color: t.colors.text, textAlign: 'center' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Option({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: Math.min(t.radius.card, 14),
        borderWidth: 1.5,
        borderColor: selected || pressed ? t.colors.primary : t.colors.border,
        backgroundColor: selected ? t.colors.primarySoft : t.colors.card,
      })}
    >
      <Text
        maxFontSizeMultiplier={1.25}
        style={{ color: selected ? t.colors.primary : t.colors.text, fontSize: 16, fontFamily: t.fonts.body }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Progress({ value, total, label }: { value: number; total: number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < value ? t.colors.primary : t.colors.border }} />
        ))}
      </View>
      <Muted style={{ fontSize: 12 }}>{label}</Muted>
    </View>
  );
}

export function ResultHeader({ big, line, game, uid }: { big: string; line: string; game: Game; uid: string }) {
  const t = useTheme();
  const both = game.status === 'done';
  return (
    <Card style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}>
      <Text maxFontSizeMultiplier={1.25} style={{ fontFamily: t.fonts.title, fontSize: 56, lineHeight: 64, color: t.colors.primary }}>
        {big}
      </Text>
      <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 16, textAlign: 'center', fontFamily: t.fonts.body }}>
        {line}
      </Text>
      {both && game.finished?.[uid] && <Muted style={{ fontSize: 13 }}>Günün ilk oyunuysa ikinize de +{GAME_POINTS} puan</Muted>}
    </Card>
  );
}

export function Done({ children }: { children?: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      {children}
      <Button label="Bitir" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
}
