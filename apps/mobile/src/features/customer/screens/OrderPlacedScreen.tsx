import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Card } from '../../../ui/Surface';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderPlaced'>;

export function OrderPlacedScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <SafeAreaView
      testID="screen-order-placed"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: p.space.xl, gap: p.space.lg }}>
        <View
          style={[
            {
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: tokens.tealSolid,
              alignItems: 'center',
              justifyContent: 'center',
            },
            p.shadow.teal,
          ]}
        >
          <Icon name="check" color="#7CE0B0" size={44} strokeWidth={2.6} />
        </View>

        <Text variant="h1" style={{ textAlign: 'center' }}>{t('customer.orderPlaced.title')}</Text>
        <Text variant="body" color="muted" style={{ textAlign: 'center' }}>{t('customer.orderPlaced.body')}</Text>

        <Card style={{ alignSelf: 'stretch', alignItems: 'center', gap: 2 }}>
          <Text variant="kicker" color="muted">{t('customer.orderPlaced.orderNo')}</Text>
          <Text variant="bodyLg" bold>{route.params.orderId}</Text>
        </Card>
      </View>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg }}>
        <Button testID="btn-back-home" label={t('customer.orderPlaced.backHome')} onPress={() => navigation.popToTop()} />
      </View>
    </SafeAreaView>
  );
}
