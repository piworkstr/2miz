import { Image, Text, View, type ViewStyle } from 'react-native';
import { photoUri, type Photo } from '../lib/photos';

// Albüm her temada aynı "gerçek polaroid" görünümünde kalır; basılı albümle birebir olsun diye.
const PAPER = '#FFFFFF';
const INK = '#2B1D22';
const HAND = 'Caveat_500Medium';

type Props = {
  photo?: Photo;
  name: string;
  tilt?: number;
  aspect?: number;
  style?: ViewStyle;
};

export function Polaroid({ photo, name, tilt = 0, aspect = 1, style }: Props) {
  return (
    <View
      style={[
        {
          backgroundColor: PAPER,
          padding: 8,
          paddingBottom: 10,
          borderWidth: 1,
          borderColor: '#E9DED8',
          transform: [{ rotate: `${tilt}deg` }],
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 3,
        },
        style,
      ]}
    >
      {photo ? (
        <Image source={{ uri: photoUri(photo) }} style={{ width: '100%', aspectRatio: aspect, backgroundColor: '#eee' }} />
      ) : (
        <View style={{ width: '100%', aspectRatio: aspect, backgroundColor: '#F3ECE8', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: HAND, fontSize: 20, color: '#B9A9A3' }}>henüz yok</Text>
        </View>
      )}
      <Text style={{ fontFamily: HAND, fontSize: 21, lineHeight: 23, color: INK, textAlign: 'center', marginTop: 8 }} numberOfLines={3}>
        {photo?.note || ' '}
      </Text>
      <Text style={{ fontSize: 11, color: '#9C8C87', textAlign: 'center', marginTop: 2 }}>{name}</Text>
    </View>
  );
}

export const handFont = HAND;
export const inkColor = INK;
