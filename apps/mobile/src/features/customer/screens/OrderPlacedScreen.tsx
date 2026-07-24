import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderPlaced'>;

export function OrderPlacedScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <SafeAreaView
      testID="screen-order-placed"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface, alignItems: 'center', justifyContent: 'center', padding: p.space.xl, gap: p.space.md }}
    >
      {/* วงกลมยืนยันสำเร็จ + เครื่องหมายถูก (glyph ในข้อความยืนยัน ไม่ใช่ไอคอนนำทาง) */}
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: tokens.brandSolid, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="display" color="onBrand">✓</Text>
      </View>
      <Text variant="h1" style={{ textAlign: 'center' }}>{t('customer.orderPlaced.title')}</Text>
      <Text variant="body" color="muted" style={{ textAlign: 'center' }}>{t('customer.orderPlaced.body')}</Text>
      <Text variant="small" color="muted">{t('customer.orderPlaced.orderNo')}: {route.params.orderId}</Text>
      <Button testID="btn-back-home" label={t('customer.orderPlaced.backHome')} onPress={() => navigation.popToTop()} />
    </SafeAreaView>
  );
}
