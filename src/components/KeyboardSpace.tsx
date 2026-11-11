import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, Dimensions, Keyboard, Platform, View, type KeyboardEvent } from 'react-native';

// Klavyenin üst kenarı (pencere koordinatı); kapalıyken null. iOS'ta çerçeve değişimini dinler.
export function useKeyboardTop(): number | null {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    const onFrame = (e: KeyboardEvent) => {
      const y = e.endCoordinates.screenY;
      setTop(y >= Dimensions.get('screen').height - 1 ? null : y);
    };
    const onHide = () => setTop(null);
    const subs =
      Platform.OS === 'ios'
        ? [Keyboard.addListener('keyboardWillChangeFrame', onFrame), Keyboard.addListener('keyboardWillHide', onHide)]
        : [Keyboard.addListener('keyboardDidShow', onFrame), Keyboard.addListener('keyboardDidHide', onHide)];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return top;
}

export const useKeyboardVisible = () => useKeyboardTop() !== null;

// Sütunun en altına konur: klavye açılınca kendi alt kenarını pencereye göre ölçer ve klavyenin kapattığı
// kadar yükselir; üstündeki giriş alanı klavyenin hemen üstüne çıkar. (KeyboardAvoidingView, altında sekme
// çubuğu boşluğu olan ekranlarda eksik hesaplıyordu.) Android pencereyi kendisi daraltır; orada boş kalır.
export function KeyboardSpace() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const h = useRef(new Animated.Value(0)).current;
  const top = useKeyboardTop();
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (top === null) {
      Animated.timing(h, { toValue: 0, duration: 220, useNativeDriver: false }).start();
      return;
    }
    ref.current?.measureInWindow((_x, y, _w, hh) => {
      Animated.timing(h, { toValue: Math.max(0, y + hh - top), duration: 220, useNativeDriver: false }).start();
    });
  }, [top, h]);
  return <Animated.View ref={ref} style={{ height: h }} />;
}
