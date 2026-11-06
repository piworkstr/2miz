import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { tripDates, useTripPhotos, type Trip } from '../lib/trips';
import { handFont, inkColor } from './Polaroid';

export const KRAFT = '#EADCC4';

// Seyahatin albümdeki kapağı: kraft kağıt, el yazısı başlık, pul ve yelpaze gibi açılmış üç küçük polaroid.
export function TripCover({ trip, coupleId }: { trip: Trip; coupleId: string }) {
  const photos = useTripPhotos(coupleId, trip.id, 3);
  const tilts = [-8, 3, 10];
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      style={({ pressed }) => ({
        backgroundColor: KRAFT,
        borderRadius: 6,
        padding: 18,
        gap: 14,
        opacity: pressed ? 0.9 : 1,
        overflow: 'hidden',
      })}
    >
      <Stamp style={{ position: 'absolute', top: 12, right: 12 }} />
      <View style={{ gap: 2, paddingRight: 70 }}>
        <Text style={{ fontFamily: handFont, fontSize: 30, lineHeight: 34, color: inkColor }} numberOfLines={2}>
          {trip.name}
        </Text>
        <Text style={{ fontSize: 13, color: '#7A6650' }}>
          {trip.place ? `${trip.place} · ` : ''}
          {tripDates(trip)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', height: 130, alignItems: 'center' }}>
        {photos && photos.length > 0 ? (
          photos.map((p, i) => (
            <View
              key={p.id}
              style={{
                width: 96,
                backgroundColor: '#fff',
                padding: 5,
                paddingBottom: 16,
                marginHorizontal: -8,
                transform: [{ rotate: `${tilts[i]}deg` }, { translateY: i === 1 ? -6 : 4 }],
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 },
                elevation: 3,
              }}
            >
              <Image source={{ uri: `data:image/jpeg;base64,${p.data}` }} style={{ width: '100%', aspectRatio: 1, backgroundColor: '#eee' }} />
            </View>
          ))
        ) : (
          <Text style={{ fontFamily: handFont, fontSize: 20, color: '#9A8468' }}>Fotoğraflarınızı ekleyin</Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: '#7A6650' }}>{trip.count} fotoğraf</Text>
        <Ionicons name="chevron-forward" size={18} color="#7A6650" />
      </View>
    </Pressable>
  );
}

export function Stamp({ style }: { style?: object }) {
  return (
    <View
      style={[
        {
          width: 58,
          height: 58,
          borderRadius: 29,
          borderWidth: 2,
          borderColor: '#C0566A',
          borderStyle: 'dashed',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ rotate: '-14deg' }],
          opacity: 0.85,
        },
        style,
      ]}
    >
      <Ionicons name="airplane" size={20} color="#C0566A" />
      <Text style={{ fontSize: 8, fontWeight: '700', letterSpacing: 1, color: '#C0566A' }}>2MİZ</Text>
    </View>
  );
}
