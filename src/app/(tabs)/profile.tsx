import { signOut } from 'firebase/auth';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Muted, Screen, Title } from '../../components/ui';
import { auth } from '../../lib/firebase';
import { useSession } from '../../lib/session';
import { colors, fonts } from '../../lib/theme';

export default function Profile() {
  const { profile, partnerName, couple } = useSession();

  return (
    <Screen>
      <Title>Biz</Title>
      <Card style={styles.couple}>
        <Text style={styles.names}>
          {profile?.name ?? 'Sen'} & {partnerName}
        </Text>
        <View style={styles.row}>
          <View style={styles.box}>
            <Text style={styles.value}>{couple?.points ?? 0}</Text>
            <Muted>toplam puan</Muted>
          </View>
          <View style={styles.box}>
            <Text style={styles.value}>{couple?.streak ?? 0}</Text>
            <Muted>en son seri</Muted>
          </View>
        </View>
      </Card>
      <Button label="Çıkış yap" variant="secondary" onPress={() => signOut(auth)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  couple: { alignItems: 'center' },
  names: { fontFamily: fonts.handBold, fontSize: 36, color: colors.primary },
  row: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  box: { flex: 1, alignItems: 'center', backgroundColor: colors.bg, borderRadius: 12, padding: 12 },
  value: { fontSize: 24, fontWeight: '700', color: colors.text },
});
