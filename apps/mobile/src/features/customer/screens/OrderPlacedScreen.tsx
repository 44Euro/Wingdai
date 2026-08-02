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
import { useOrder } from '../hooks';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OrderPlaced'>;

export function OrderPlacedScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: order } = useOrder(route.params.orderId);
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
          {/*
            เดิมฝังสี '#7CE0B0' ไว้ตรงนี้ ซึ่งคือค่าของโทเคน success **ของโหมดมืด**
            โหมดสว่างจึงได้เขียวผิดเฉดบนพื้น teal — ใช้โทเคนที่ออกแบบมาสำหรับ
            เนื้อหาบนพื้น teal โดยเฉพาะ ซึ่งผ่านเทสต์ contrast แล้วทั้งสองโหมด
          */}
          <Icon name="check" color={tokens.textOnTeal} size={44} strokeWidth={2.6} />
        </View>

        <Text variant="h1" style={{ textAlign: 'center' }}>{t('customer.orderPlaced.title')}</Text>
        <Text variant="body" color="muted" style={{ textAlign: 'center' }}>{t('customer.orderPlaced.body')}</Text>

        {/*
          ต้องโชว์ `reference` (WD-XXXXXX) ไม่ใช่ `orderId` ซึ่งเป็น uuid
          เลขที่อ่านออกมีไว้ให้ลูกค้าอ้างตอนโทรหาร้านหรือแจ้งปัญหา — uuid ยาว 36 ตัว
          อ่านทางโทรศัพท์ไม่ได้เลย และนี่คือเหตุผลที่ orders มีคอลัมน์ reference แยกไว้
        */}
        <Card style={{ alignSelf: 'stretch', alignItems: 'center', gap: 2 }}>
          <Text variant="kicker" color="muted">{t('customer.orderPlaced.orderNo')}</Text>
          <Text testID="placed-reference" variant="bodyLg" bold>
            {order?.reference ?? '—'}
          </Text>
        </Card>
      </View>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.lg }}>
        <Button testID="btn-back-home" label={t('customer.orderPlaced.backHome')} onPress={() => navigation.popToTop()} />
      </View>
    </SafeAreaView>
  );
}
