import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, IconChip } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { useAddresses } from '../hooks';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Addresses'>;

/**
 * C9 — ที่อยู่จัดส่งที่บันทึกไว้
 *
 * ยังไม่มีปุ่มแก้/ลบ เพราะ endpoint ฝั่งเซิร์ฟเวอร์มีแค่ "ดู" กับ "เพิ่ม"
 * ตามกฎที่ตั้งไว้ว่าห้ามมี UI ที่กดแล้วไม่เกิดอะไร — ใส่ตอนทำ endpoint แก้/ลบ
 */
export function AddressesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: addresses = [], isLoading } = useAddresses();

  return (
    <View testID="screen-addresses" style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScreenHeader title={t('customer.addresses.title')} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={{ padding: p.space.screen, paddingTop: 0, gap: p.space.md }}>
        {isLoading ? (
          <Text variant="small" color="muted">
            {t('common.loading')}
          </Text>
        ) : null}

        {!isLoading && addresses.length === 0 ? (
          <Card style={{ gap: p.space.sm, alignItems: 'center', paddingVertical: p.space.xl }}>
            <IconChip name="mapPin" tone="teal" size={48} />
            <Text variant="body" bold style={{ marginTop: p.space.sm }}>
              {t('customer.addresses.emptyTitle')}
            </Text>
            {/* บอกตรง ๆ ว่าทำไมต้องมี ไม่ใช่แค่ "ยังไม่มีข้อมูล" */}
            <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
              {t('customer.addresses.emptyHint')}
            </Text>
          </Card>
        ) : null}

        {addresses.map((a, index) => (
          <Card key={a.id} style={{ flexDirection: 'row', gap: p.space.md, alignItems: 'flex-start' }}>
            <IconChip name="mapPin" tone={index === 0 ? 'brand' : 'neutral'} size={40} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
                <Text variant="small" bold>
                  {a.label}
                </Text>
                {/* ที่อยู่ตัวแรกคือค่าตั้งต้น ตรงกับที่เซิร์ฟเวอร์เลือกเมื่อออร์เดอร์ไม่ระบุมา */}
                {index === 0 ? (
                  <Text testID="address-default-tag" variant="kicker" color="link" bold>
                    {t('customer.addresses.defaultTag')}
                  </Text>
                ) : null}
              </View>
              <Text variant="caption" color="muted">
                {a.addressText}
              </Text>
              {a.note ? (
                <Text variant="caption" color="faint">
                  {a.note}
                </Text>
              ) : null}
            </View>
          </Card>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.screen }}>
        <Button
          testID="btn-add-address"
          label={t('customer.addresses.add')}
          onPress={() => navigation.navigate('AddAddress')}
        />
      </View>
    </View>
  );
}
