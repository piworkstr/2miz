import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { TaskWheel } from '../components/TaskWheel';
import { Screen } from '../components/ui';
import { useL } from '../lib/i18n';
import { tx } from '../lib/theme';
import { useTheme } from '../lib/useTheme';

// Bonus görev çarkı kendi sayfasında: ana sayfada aşağıda açılınca gözden kaçıyordu.
export default function WheelScreen() {
  const t = useTheme();
  const l = useL();
  return (
    <Screen>
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name="chevron-back" size={22} color={t.colors.text} />
        <Text maxFontSizeMultiplier={1.25} style={{ color: t.colors.text, fontSize: 15, fontFamily: t.fonts.body }}>
          {tx(t, l('Bugün', 'Today'))}
        </Text>
      </Pressable>
      <TaskWheel />
    </Screen>
  );
}
