import Ionicons from '@expo/vector-icons/Ionicons';
import { doc, updateDoc } from 'firebase/firestore';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { db } from '../lib/firebase';
import { useSession } from '../lib/session';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

// Küçük ünlem: anlamayan dokunur, açıklama açılır; "Anladım" deyince bir daha çıkmaz, "Tekrar göster" bırakır.
// Durum kişinin profilinde saklanır (hints.<id>).
export function Hint({ id, children }: { id: string; children: ReactNode }) {
  const t = useTheme();
  const { user, profile } = useSession();
  const [open, setOpen] = useState(false);
  if (!user || profile?.hints?.[id]) return null;
  const dismiss = () => {
    setOpen(false);
    updateDoc(doc(db, 'users', user.uid), { [`hints.${id}`]: true }).catch(() => {});
  };
  return (
    <>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        hitSlop={10}
        accessibilityLabel="Açıklama"
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: open ? t.colors.primary : t.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="alert" size={14} color={open ? t.colors.onPrimary : t.colors.primary} />
      </Pressable>
      {open && (
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 28,
            zIndex: 20,
            width: 260,
            padding: 12,
            gap: 10,
            borderRadius: 14,
            backgroundColor: t.colors.card,
            borderWidth: 1,
            borderColor: t.colors.border,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          }}
        >
          <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 13, lineHeight: 18, fontFamily: t.fonts.body }}>
            {children}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
            <Pressable onPress={() => setOpen(false)} style={{ paddingVertical: 6, paddingHorizontal: 10 }}>
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.muted, fontWeight: '700', fontSize: 13 }}>
                {tx(t, 'Tekrar göster')}
              </Text>
            </Pressable>
            <Pressable
              onPress={dismiss}
              style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: t.colors.primary }}
            >
              <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.onPrimary, fontWeight: '700', fontSize: 13 }}>
                {tx(t, 'Anladım')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}
