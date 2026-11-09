import Ionicons from '@expo/vector-icons/Ionicons';
import { doc, updateDoc } from 'firebase/firestore';
import { Pressable, Text, View } from 'react-native';
import { db } from '../lib/firebase';
import { useSession } from '../lib/session';
import { LIVING, type Living } from '../lib/tasks';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

// Yaşam düzeni: aynı ev / aynı şehir ayrı ev / uzak. Günlük görevler buna göre seçilir;
// ayrı yaşayan çifte "sabah kahvaltı hazırla" çıkmaz. İkiniz de değiştirebilirsiniz.
const ICON: Record<Living, React.ComponentProps<typeof Ionicons>['name']> = { together: 'home', city: 'business', far: 'airplane' };

export function LivingChips({ compact }: { compact?: boolean }) {
  const t = useTheme();
  const { couple } = useSession();
  if (!couple) return null;
  const cur = couple.living ?? (couple.status === 'uzak' ? 'far' : undefined);
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {LIVING.map((l) => {
        const on = cur === l.id;
        return (
          <Pressable
            key={l.id}
            onPress={() => updateDoc(doc(db, 'couples', couple.id), { living: l.id }).catch(() => {})}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              gap: 4,
              paddingVertical: compact ? 8 : 10,
              paddingHorizontal: 4,
              borderRadius: t.radius.card,
              borderWidth: 1.5,
              borderColor: on || pressed ? t.colors.primary : t.colors.border,
              backgroundColor: on ? t.colors.primarySoft : 'transparent',
            })}
          >
            <Ionicons name={ICON[l.id]} size={20} color={on ? t.colors.primary : t.colors.muted} />
            <Text
              numberOfLines={2}
              style={{
                fontSize: 12,
                lineHeight: 15,
                textAlign: 'center',
                color: on ? t.colors.primary : t.colors.text,
                fontFamily: t.fonts.body,
              }}
            >
              {tx(t, l.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
