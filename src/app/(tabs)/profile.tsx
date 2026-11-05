import Ionicons from '@expo/vector-icons/Ionicons';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Muted, Screen, T, Title } from '../../components/ui';
import { auth } from '../../lib/firebase';
import { useSession } from '../../lib/session';
import { THEME_LIST, tx, type Theme } from '../../lib/theme';
import { saveTheme, useTheme } from '../../lib/useTheme';

export default function Profile() {
  const { user, profile, partnerName, couple } = useSession();
  const t = useTheme();
  const [saving, setSaving] = useState<string | null>(null);

  async function choose(theme: Theme) {
    if (!user || theme.id === t.id) return;
    setSaving(theme.id);
    try {
      await saveTheme(user.uid, theme.id);
    } finally {
      setSaving(null);
    }
  }

  return (
    <Screen>
      <Title>{t.copy.tabs.us}</Title>

      <Card style={{ alignItems: 'center' }}>
        <Text style={{ fontFamily: t.fonts.title, fontSize: t.titleSize * 0.9, color: t.colors.primary }}>
          {tx(t, `${profile?.name ?? 'Sen'} & ${partnerName}`)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
          <Box value={couple?.points ?? 0} label={t.copy.points} />
          <Box value={couple?.streak ?? 0} label={t.copy.streak} />
        </View>
      </Card>

      <View style={{ gap: 4 }}>
        <T style={{ fontSize: 17, fontWeight: '600', fontFamily: t.fonts.button }}>{tx(t, 'Temanı seç')}</T>
        <Muted>Tema sadece senin telefonunu değiştirir, partnerin kendi temasını seçer.</Muted>
      </View>

      {THEME_LIST.map((theme) => (
        <ThemeOption
          key={theme.id}
          theme={theme}
          selected={theme.id === t.id}
          saving={saving === theme.id}
          onPress={() => choose(theme)}
        />
      ))}

      <Button label="Çıkış yap" variant="secondary" onPress={() => signOut(auth)} />
    </Screen>
  );
}

function Box({ value, label }: { value: number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: t.colors.bg, borderRadius: Math.min(t.radius.card, 12), padding: 12 }}>
      <T style={{ fontSize: 24, fontWeight: '700' }}>{String(value)}</T>
      <Muted style={{ fontSize: 12, textAlign: 'center' }}>{tx(t, label)}</Muted>
    </View>
  );
}

// Her seçenek kendi temasının renk ve fontuyla çizilir, böylece seçmeden önce görürsün.
function ThemeOption({ theme, selected, saving, onPress }: { theme: Theme; selected: boolean; saving: boolean; onPress: () => void }) {
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: c.bg,
        borderRadius: Math.max(theme.radius.card, 8),
        borderWidth: selected ? 2.5 : 1,
        borderColor: selected ? c.primary : c.border,
        padding: 16,
        gap: 10,
        opacity: pressed || saving ? 0.8 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: theme.fonts.title, fontSize: theme.titleSize * 0.75, color: c.text }}>
          {tx(theme, theme.name)}
        </Text>
        {selected && <Ionicons name="checkmark-circle" size={24} color={c.primary} />}
      </View>
      <Text style={{ color: c.muted, fontFamily: theme.fonts.body, fontSize: 13 }}>{theme.tagline}</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View
          style={{
            backgroundColor: c.primary,
            borderRadius: theme.radius.button,
            paddingHorizontal: 14,
            paddingVertical: 8,
          }}
        >
          <Text style={{ color: c.onPrimary, fontFamily: theme.fonts.button, fontWeight: theme.fonts.button ? undefined : '600', letterSpacing: theme.upper ? 1 : 0 }}>
            {tx(theme, theme.copy.accept)}
          </Text>
        </View>
        <Text style={{ flex: 1, color: c.text, fontFamily: theme.fonts.body, fontSize: 13 }} numberOfLines={1}>
          {theme.copy.hello('Elif')}
        </Text>
      </View>
    </Pressable>
  );
}
