import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, IconChip } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { useAddAddress } from '../hooks';
import { getCurrentCoords, LocationDenied, type Coords } from '../currentLocation';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'AddAddress'>;

/**
 * C29 — เพิ่มที่อยู่จัดส่ง
 *
 * **ยังไม่มีแผนที่ให้ปักหมุด** เพราะ tile ที่ใช้อยู่ (demotiles ของ MapLibre) เป็นแผนที่โลก
 * ความละเอียดต่ำ ไม่มีถนนระดับซอย — ให้ปักหมุดบนพื้นที่ว่างเปล่าคือ UI ที่แกล้งทำงาน
 * ใส่แผนที่ตอนย้ายไป .pmtiles ที่โฮสต์เอง (claude.md §10)
 *
 * ระหว่างนี้ใช้พิกัดจากเครื่อง ซึ่งตรงกับพฤติกรรมจริง: คนมักบันทึกที่อยู่ตอนอยู่ที่นั่น
 * และไรเดอร์อ่าน "ข้อความที่อยู่" เป็นหลัก พิกัดใช้คิดระยะทางกับจ่ายงาน
 */
export function AddAddressScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const addAddress = useAddAddress();

  const [label, setLabel] = useState('');
  const [addressText, setAddressText] = useState('');
  const [note, setNote] = useState('');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUseCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      setCoords(await getCurrentCoords());
    } catch (e) {
      setError(e instanceof LocationDenied ? 'customer.addresses.locationDenied' : 'customer.addresses.locationFailed');
    } finally {
      setLocating(false);
    }
  }

  async function handleSave() {
    if (!label.trim() || !addressText.trim()) {
      setError('customer.addresses.required');
      return;
    }
    /*
     * ไม่มีพิกัดแล้วบันทึกไม่ได้ และ **ไม่แทนด้วยจุดกลางโซน** เพราะไรเดอร์จะถูกส่งไปผิดที่
     * โดยที่ทั้งลูกค้าและไรเดอร์ไม่รู้ว่าพิกัดเป็นค่าเดา — ปฏิเสธพร้อมบอกเหตุผลตรงไปตรงมา
     */
    if (!coords) {
      setError('customer.addresses.needLocation');
      return;
    }

    setError(null);
    addAddress.mutate(
      {
        label: label.trim(),
        addressText: addressText.trim(),
        note: note.trim() ? note.trim() : undefined,
        lat: coords.lat,
        lng: coords.lng,
      },
      {
        onSuccess: () => navigation.goBack(),
        onError: () => setError('customer.addresses.saveFailed'),
      },
    );
  }

  return (
    <View testID="screen-add-address" style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <ScreenHeader title={t('customer.addresses.addTitle')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: p.space.screen, paddingTop: 0, gap: p.space.md }}
        >
          <Field label={t('customer.addresses.label')}>
            <Input
              testID="input-address-label"
              accessibilityLabel={t('customer.addresses.label')}
              placeholder={t('customer.addresses.labelPlaceholder')}
              value={label}
              onChangeText={setLabel}
            />
          </Field>

          <Field label={t('customer.addresses.addressText')} hint={t('customer.addresses.addressHint')}>
            <Input
              testID="input-address-text"
              accessibilityLabel={t('customer.addresses.addressText')}
              multiline
              value={addressText}
              onChangeText={setAddressText}
            />
          </Field>

          <Field label={t('customer.addresses.note')} hint={t('auth.register.optional')}>
            <Input
              testID="input-address-note"
              accessibilityLabel={t('customer.addresses.note')}
              placeholder={t('customer.addresses.notePlaceholder')}
              value={note}
              onChangeText={setNote}
            />
          </Field>

          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
            <IconChip name="mapPin" tone={coords ? 'brand' : 'neutral'} size={40} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text variant="small" bold>
                {t('customer.addresses.pinTitle')}
              </Text>
              <Text testID="address-coords" variant="caption" color={coords ? 'muted' : 'faint'}>
                {coords
                  ? t('customer.addresses.pinSet', {
                      lat: coords.lat.toFixed(5),
                      lng: coords.lng.toFixed(5),
                    })
                  : t('customer.addresses.pinMissing')}
              </Text>
            </View>
          </Card>

          <Button
            testID="btn-use-location"
            label={t(locating ? 'customer.addresses.locating' : 'customer.addresses.useLocation')}
            variant="secondary"
            disabled={locating}
            onPress={handleUseCurrentLocation}
          />

          {error ? (
            <Text testID="address-error" variant="small" color="danger" bold>
              {t(error)}
            </Text>
          ) : null}
        </ScrollView>

        <View style={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.screen }}>
          <Button
            testID="btn-save-address"
            label={t('common.save')}
            disabled={addAddress.isPending}
            onPress={handleSave}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
