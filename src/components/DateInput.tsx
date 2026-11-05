import { View } from 'react-native';
import { Input } from './ui';

export type DateParts = { d: string; m: string; y: string };

// Gün / ay / yıl için üç kutu. Ek bir kütüphane gerektirmez, Expo Go'da sorunsuz çalışır.
export function DateInput({ value, onChange }: { value: DateParts; onChange: (v: DateParts) => void }) {
  const digits = (s: string) => s.replace(/[^0-9]/g, '');
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Input
        style={{ flex: 1, textAlign: 'center' }}
        placeholder="Gün"
        keyboardType="number-pad"
        maxLength={2}
        value={value.d}
        onChangeText={(d) => onChange({ ...value, d: digits(d) })}
      />
      <Input
        style={{ flex: 1, textAlign: 'center' }}
        placeholder="Ay"
        keyboardType="number-pad"
        maxLength={2}
        value={value.m}
        onChangeText={(m) => onChange({ ...value, m: digits(m) })}
      />
      <Input
        style={{ flex: 1.4, textAlign: 'center' }}
        placeholder="Yıl"
        keyboardType="number-pad"
        maxLength={4}
        value={value.y}
        onChangeText={(y) => onChange({ ...value, y: digits(y) })}
      />
    </View>
  );
}

// Geçerli bir tarihse "YYYY-MM-DD" döner, değilse null.
export function toDateKey({ d, m, y }: DateParts): string | null {
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (!day || !month || y.length !== 4) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  if (date > new Date()) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function ageFrom(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}
