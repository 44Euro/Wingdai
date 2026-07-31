import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Chip } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { repos } from '../../../data';
import { getCurrentCoords, type Coords } from '../../customer/currentLocation';
import type { CuisineCategory } from '../../../data/types';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'OpenRestaurant'>;

const CUISINES: CuisineCategory[] = ['rice', 'noodle', 'somtam', 'drink', 'dessert'];

/**
 * "เปิดร้านของคุณ" (claude.md §4.3)
 *
 * ร้านเป็น **ความสามารถบนบัญชีเดิม** ไม่ใช่การสมัครบัญชีใหม่ — จอนี้จึงอยู่ใน CustomerStack
 * เข้าจากโปรไฟล์ ไม่ใช่จากหน้าล็อกอิน และไม่มีการกรอกรหัสผ่านอะไรอีก
 *
 * พิกัดใช้ตำแหน่งเครื่อง เพราะเซิร์ฟเวอร์ต้องเช็คว่าอยู่ในโซนที่เปิดให้บริการ (§1)
 * และแผนที่ปักหมุดยังทำไม่ได้จริงจนกว่าจะเปลี่ยนไปใช้ .pmtiles (เหมือนจอเพิ่มที่อยู่)
 */
export function OpenRestaurantScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState<CuisineCategory>('rice');
  const [addressText, setAddressText] = useState('');
  const [prepTime, setPrepTime] = useState('15');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const register = useMutation({
    mutationFn: () =>
      repos.merchant.registerRestaurant({
        name: name.trim(),
        cuisine,
        addressText: addressText.trim(),
        lat: coords!.lat,
        lng: coords!.lng,
        prepTimeMinutes: Number(prepTime),
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        bankAccountName: bankAccountName.trim(),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['merchant'] }),
  });

  async function locate() {
    setLocating(true);
    setLocationError(false);
    try {
      setCoords(await getCurrentCoords());
    } catch {
      setLocationError(true);
    } finally {
      setLocating(false);
    }
  }

  const prepOk = Number.isInteger(Number(prepTime)) && Number(prepTime) >= 1 && Number(prepTime) <= 120;
  const ready =
    name.trim() !== '' && addressText.trim() !== '' && coords !== null && prepOk &&
    bankName.trim() !== '' && bankAccountNumber.trim() !== '' && bankAccountName.trim() !== '';

  return (
    <SafeAreaView
      testID="screen-open-restaurant"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('merchant.open.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: p.space.xxl, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {register.isSuccess ? (
          <Card testID="restaurant-submitted">
            <View style={{ gap: p.space.sm }}>
              <Text variant="h3">{t('merchant.open.sentTitle')}</Text>
              {/* บอกตรง ๆ ว่ายังขายไม่ได้จนกว่าจะผ่านการตรวจ ไม่ปล่อยให้เข้าใจว่าเปิดแล้ว */}
              <Text variant="body" color="muted">
                {t('merchant.open.sentBody', { zone: register.data.zoneName })}
              </Text>
              <Text variant="small" color="muted">{t('merchant.open.nextStep')}</Text>
              <Button
                testID="btn-open-done"
                label={t('common.back')}
                onPress={() => navigation.goBack()}
              />
            </View>
          </Card>
        ) : (
          <>
            <Field label={t('merchant.open.name')}>
              <Input
                testID="input-shop-name"
                accessibilityLabel={t('merchant.open.name')}
                value={name}
                onChangeText={setName}
              />
            </Field>

            <View style={{ gap: p.space.sm }}>
              <Text variant="kicker" color="muted">{t('merchant.open.cuisine')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
                {CUISINES.map((c) => (
                  <Chip
                    key={c}
                    testID={`cuisine-${c}`}
                    label={t(`customer.cuisine.${c}`)}
                    active={c === cuisine}
                    onPress={() => setCuisine(c)}
                  />
                ))}
              </View>
            </View>

            <Field label={t('merchant.open.address')}>
              <Input
                testID="input-shop-address"
                accessibilityLabel={t('merchant.open.address')}
                value={addressText}
                onChangeText={setAddressText}
                multiline
              />
            </Field>

            {/*
              §1 · §7 — พิกัดร้านต้องอยู่ในโซนที่เปิดให้บริการ และเซิร์ฟเวอร์เป็นคนตัดสิน
              ที่นี่แค่เก็บพิกัดจริงจากเครื่อง ไม่เดาจากข้อความที่อยู่
            */}
            <Card>
              <View style={{ gap: p.space.sm }}>
                <Text variant="kicker" color="muted">{t('merchant.open.location')}</Text>
                <Text testID="shop-coords" variant="small" color={coords ? 'success' : 'muted'}>
                  {coords
                    ? t('merchant.open.locationSet', {
                        lat: coords.lat.toFixed(5), lng: coords.lng.toFixed(5),
                      })
                    : t('merchant.open.locationHint')}
                </Text>
                <Button
                  testID="btn-use-location"
                  variant="secondary"
                  label={t('merchant.open.useLocation')}
                  disabled={locating}
                  onPress={() => void locate()}
                />
                {locationError ? (
                  <Text testID="location-error" variant="small" color="danger">
                    {t('merchant.open.locationDenied')}
                  </Text>
                ) : null}
              </View>
            </Card>

            <Field
              label={t('merchant.open.prepTime')}
              hint={prepTime !== '' && !prepOk ? t('merchant.open.prepTimeError') : undefined}
            >
              <Input
                testID="input-prep-time"
                accessibilityLabel={t('merchant.open.prepTime')}
                value={prepTime}
                onChangeText={setPrepTime}
                keyboardType="number-pad"
              />
            </Field>

            <View style={{ gap: p.space.md }}>
              <Text variant="kicker" color="muted">{t('merchant.open.payout')}</Text>
              <Field label={t('merchant.open.bankName')}>
              <Input
                testID="input-bank-name"
                accessibilityLabel={t('merchant.open.bankName')}
                value={bankName}
                onChangeText={setBankName}
              />
            </Field>
              <Field label={t('merchant.open.bankNumber')}>
              <Input
                testID="input-bank-number"
                accessibilityLabel={t('merchant.open.bankNumber')}
                value={bankAccountNumber}
                onChangeText={setBankAccountNumber}
                keyboardType="number-pad"
              />
            </Field>
              <Field label={t('merchant.open.bankHolder')}>
              <Input
                testID="input-bank-holder"
                accessibilityLabel={t('merchant.open.bankHolder')}
                value={bankAccountName}
                onChangeText={setBankAccountName}
              />
            </Field>
              {/* §7 ชื่อบัญชีควรตรงกับชื่อเจ้าของ เป็นด่านกันบัญชีม้า — แอดมินตรวจตอนอนุมัติ */}
              <Text variant="caption" color="faint">{t('merchant.open.bankNote')}</Text>
            </View>

            <Button
              testID="btn-submit-restaurant"
              label={t('merchant.open.submit')}
              disabled={!ready || register.isPending}
              onPress={() => register.mutate()}
            />

            {register.isError ? (
              <Text testID="open-error" variant="small" color="danger">
                {(register.error as Error).message}
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
