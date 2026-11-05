import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';
import { Card, Muted, Screen, Title } from './ui';

type Props = {
  title: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
};

export function ComingSoon({ title, icon, text }: Props) {
  return (
    <Screen>
      <Title>{title}</Title>
      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={32} color={colors.primary} />
        </View>
        <Muted style={{ textAlign: 'center' }}>{text}</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: 32 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
