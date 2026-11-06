import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { handFont, inkColor } from '../../components/Polaroid';
import { KRAFT, Stamp } from '../../components/TripCover';
import { Loading } from '../../components/ui';
import { openPlus, tripPhotoLimit, usePlus } from '../../lib/plus';
import { notifyPartner } from '../../lib/push';
import { useSession } from '../../lib/session';
import {
  addTripPhotos,
  deleteTrip,
  deleteTripPhoto,
  setTripPhotoNote,
  tripDates,
  useTrip,
  useTripPhotos,
  type TripPhoto,
} from '../../lib/trips';

const TILTS = [-3, 2.5, 1.5, -2, -1, 3];

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, couple, partnerId, partnerName, profile } = useSession();
  const trip = useTrip(couple?.id, id);
  const photos = useTripPhotos(couple?.id, id);
  const [adding, setAdding] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState<TripPhoto | null>(null);
  const [viewing, setViewing] = useState<TripPhoto | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const plus = usePlus();
  const LIMIT = tripPhotoLimit(plus);

  if (trip === null) {
    // Seyahat silindiyse (ya da partner sildiyse) albüme dön.
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: KRAFT }}>
        <Text style={{ fontFamily: handFont, fontSize: 24, color: inkColor }}>Bu seyahat artık yok.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: '#C0566A', fontWeight: '600' }}>Albüme dön</Text>
        </Pressable>
      </SafeAreaView>
    );
  }
  if (!trip || !photos || !user || !couple) return <Loading />;

  const myName = profile?.name ?? 'Sen';
  const room = LIMIT - trip.count;

  async function pick() {
    if (!trip || !user || !couple || adding) return;
    setError('');
    if (room <= 0) {
      if (!plus.active) return openPlus('tripPhotos');
      return setError(`Bir seyahate en fazla ${LIMIT} fotoğraf eklenebiliyor.`);
    }
    // iPhone'un kendi seçicisi: tüm galeriye erişim istemez, yalnızca seçilen fotoğraflar gelir.
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      orderedSelection: true,
      quality: 1,
    });
    if (res.canceled || !res.assets.length) return;
    const uris = res.assets.map((a) => a.uri).slice(0, room);
    setAdding({ done: 0, total: uris.length });
    try {
      const n = await addTripPhotos(couple.id, trip, user.uid, uris, LIMIT, (done) => setAdding({ done, total: uris.length }));
      if (n > 0 && partnerId) {
        notifyPartner(partnerId, `${myName} seyahat albümünüze ekledi ✈️`, `${trip.name}: ${n} yeni fotoğraf`, {
          type: 'trip',
          url: `/trip/${trip.id}`,
        });
      }
    } catch {
      setError('Bazı fotoğraflar eklenemedi, tekrar dene.');
    } finally {
      setAdding(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: KRAFT }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 18 }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chevron-back" size={22} color={inkColor} />
          <Text style={{ color: inkColor, fontSize: 15 }}>Albüm</Text>
        </Pressable>

        <View style={{ gap: 4 }}>
          <Stamp style={{ position: 'absolute', right: 0, top: -6 }} />
          <Text style={{ fontFamily: handFont, fontSize: 40, lineHeight: 44, color: inkColor, paddingRight: 70 }}>{trip.name}</Text>
          <Text style={{ fontSize: 14, color: '#7A6650' }}>
            {trip.place ? `${trip.place} · ` : ''}
            {tripDates(trip)}
          </Text>
        </View>

        <Pressable
          onPress={pick}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: room > 0 || !plus.active ? '#C0566A' : '#B9A88F',
            borderRadius: 14,
            paddingVertical: 14,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {adding ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                Ekleniyor {adding.done}/{adding.total}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="images-outline" size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                {room > 0 ? 'Galeriden fotoğraf ekle' : plus.active ? 'Sınır doldu' : "Plus'la 100 fotoğrafa çıkar"}
              </Text>
            </>
          )}
        </Pressable>
        <Text style={{ fontSize: 12, color: '#7A6650', textAlign: 'center', marginTop: -10 }}>
          {trip.count}/{LIMIT} fotoğraf · Uzun basarak not yazabilir ya da silebilirsiniz
        </Text>
        {!!error && <Text style={{ color: '#A93246', textAlign: 'center' }}>{error}</Text>}

        {photos.length === 0 ? (
          <Text style={{ fontFamily: handFont, fontSize: 22, color: '#9A8468', textAlign: 'center', paddingVertical: 30 }}>
            İlk fotoğrafı ekleyin, {partnerName} da kendi çektiklerini ekleyebilir.
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 }}>
            {photos.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => setViewing(p)}
                onLongPress={() => setMenu(p)}
                delayLongPress={350}
                style={{
                  width: '47%',
                  marginTop: i % 2 === 1 ? 14 : 0,
                  backgroundColor: '#fff',
                  padding: 7,
                  paddingBottom: 8,
                  transform: [{ rotate: `${TILTS[i % TILTS.length]}deg` }],
                  shadowColor: '#000',
                  shadowOpacity: 0.14,
                  shadowRadius: 5,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 3,
                }}
              >
                <Image
                  source={{ uri: `data:image/jpeg;base64,${p.data}` }}
                  style={{ width: '100%', aspectRatio: 1, backgroundColor: '#eee' }}
                />
                <Text
                  style={{
                    fontFamily: handFont,
                    fontSize: 18,
                    lineHeight: 20,
                    color: inkColor,
                    textAlign: 'center',
                    marginTop: 6,
                    minHeight: 20,
                  }}
                  numberOfLines={2}
                >
                  {p.note || ' '}
                </Text>
                <Text style={{ fontSize: 10, color: '#9C8C87', textAlign: 'center' }}>{p.uid === user.uid ? myName : partnerName}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={{ alignItems: 'center', marginTop: 20, gap: 10 }}>
          {confirmDelete ? (
            <>
              <Text style={{ color: inkColor, textAlign: 'center' }}>
                Seyahat ve içindeki {trip.count} fotoğraf ikiniz için de silinecek.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={async () => {
                    await deleteTrip(couple.id, trip.id).catch(() => {});
                    router.back();
                  }}
                  style={{ backgroundColor: '#A93246', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Evet, sil</Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmDelete(false)}
                  style={{ borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: '#B9A88F' }}
                >
                  <Text style={{ color: inkColor, fontWeight: '600' }}>Vazgeç</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable onPress={() => setConfirmDelete(true)}>
              <Text style={{ color: '#A93246', fontSize: 14 }}>Seyahati sil</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <PhotoMenu photo={menu} coupleId={couple.id} onClose={() => setMenu(null)} />

      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable
          onPress={() => setViewing(null)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', padding: 16, gap: 12 }}
        >
          {viewing && (
            <>
              <Image
                source={{ uri: `data:image/jpeg;base64,${viewing.data}` }}
                style={{ width: '100%', aspectRatio: 3 / 4 }}
                resizeMode="contain"
              />
              {!!viewing.note && (
                <Text style={{ fontFamily: handFont, fontSize: 24, color: '#fff', textAlign: 'center' }}>{viewing.note}</Text>
              )}
            </>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function PhotoMenu({ photo, coupleId, onClose }: { photo: TripPhoto | null; coupleId: string; onClose: () => void }) {
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setNote(null);
    onClose();
  }

  const row = (label: string, onPress: () => void, danger?: boolean) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: 16, paddingHorizontal: 20, backgroundColor: pressed ? '#F5EDE3' : 'transparent' })}
    >
      <Text style={{ fontSize: 16, color: danger ? '#A93246' : inkColor }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={!!photo} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable
            style={{ backgroundColor: '#FFFBF6', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34, paddingTop: 8 }}
          >
            {note !== null ? (
              <View style={{ padding: 20, gap: 12 }}>
                <Text style={{ fontSize: 17, fontWeight: '600', color: inkColor }}>Polaroidin altına not</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Örn. Kaputaş'ta ilk dalış"
                  placeholderTextColor="#B9A9A3"
                  maxLength={80}
                  autoFocus
                  style={{
                    backgroundColor: '#F3ECE4',
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 22,
                    color: inkColor,
                    fontFamily: handFont,
                  }}
                />
                <Pressable
                  onPress={async () => {
                    if (!photo || busy) return;
                    setBusy(true);
                    await setTripPhotoNote(coupleId, photo.id, note).catch(() => {});
                    setBusy(false);
                    close();
                  }}
                  style={{ backgroundColor: '#C0566A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Kaydet</Text>
                  )}
                </Pressable>
                {row('Vazgeç', close)}
              </View>
            ) : (
              <>
                {row(photo?.note ? 'Notu düzenle' : 'Not yaz', () => setNote(photo?.note ?? ''))}
                {row(
                  'Fotoğrafı sil',
                  async () => {
                    if (photo) await deleteTripPhoto(coupleId, photo).catch(() => {});
                    close();
                  },
                  true,
                )}
                {row('Vazgeç', close)}
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
