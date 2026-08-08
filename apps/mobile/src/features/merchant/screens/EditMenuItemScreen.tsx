import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Toggle } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { useMenu } from '../../customer/hooks';
import { useUpdateMenuItem } from '../hooks';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'EditMenuItem'>;

const toSatang = (baht: string) => Math.round((parseFloat(baht) || 0) * 100);
const toBaht = (satang: number) => String(satang / 100);

/** M13 แก้เมนูที่มีอยู่แล้ว */
export function EditMenuItemScreen({ navigation, route }: Props) {
  const { restaurantId, menuItemId } = route.params;
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: menu = [] } = useMenu(restaurantId);
  const item = menu.find((m) => m.id === menuItemId);
  const update = useUpdateMenuItem(restaurantId);

  /** `undefined` = ยังไม่ได้แตะช่องนั้น ต่างจาก `''` ที่แปลว่าลบทิ้ง */
  const [name, setName] = useState<string | undefined>();
  const [desc, setDesc] = useState<string | undefined>();
  const [price, setPrice] = useState<string | undefined>();
  const [available, setAvailable] = useState<boolean | undefined>();

  if (!item) {
    return (
      <SafeAreaView
        testID="screen-edit-menu-item"
        edges={['top']}
        style={{ flex: 1, backgroundColor: tokens.bgSurface }}
      >
        <ScreenHeader title={t('merchant.editItem.title')} onBack={() => navigation.goBack()} />
        <View style={{ padding: p.space.screen }}>
          <Text testID="item-missing" variant="body" color="muted">
            {t('merchant.editItem.missing')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const nameValue = name ?? item.name;
  const descValue = desc ?? item.description ?? '';
  const priceValue = price ?? toBaht(item.price);
  const availableValue = available ?? item.isAvailable;

  const priceSatang = toSatang(priceValue);
  const canSave = nameValue.trim().length > 0 && priceSatang > 0 && !update.isPending;

  return (
    <SafeAreaView
      testID="screen-edit-menu-item"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('merchant.editItem.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen,
          paddingBottom: p.space.xl,
          gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Field label={t('merchant.editItem.name')}>
          <Input testID="input-item-name" value={nameValue} onChangeText={setName} maxLength={80} />
        </Field>

        <Field label={t('merchant.editItem.description')}>
          <Input
            testID="input-item-desc"
            value={descValue}
            onChangeText={setDesc}
            maxLength={200}
            multiline
            style={{ minHeight: 72, textAlignVertical: 'top' }}
          />
        </Field>

        <Field label={t('merchant.editItem.price')}>
          <Input
            testID="input-item-price"
            value={priceValue}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            maxLength={7}
          />
        </Field>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body" bold>{t('merchant.editItem.available')}</Text>
            <Text variant="caption" color="muted">
              {availableValue
                ? t('merchant.editItem.availableOn')
                : t('merchant.editItem.availableOff')}
            </Text>
          </View>
          <Toggle
            testID="toggle-item-available"
            value={availableValue}
            accessibilityLabel={t('merchant.editItem.available')}
            onValueChange={setAvailable}
          />
        </Card>

        {/* ตัวเลือกเสริม (เผ็ดกลาง/ไข่ดาว) แก้ที่นี่ไม่ได้ บอกตรง ๆ ว่าทำไม */}
        {item.optionGroups?.length ? (
          <Text testID="options-note" variant="caption" color="faint">
            {t('merchant.editItem.optionsNote', { count: item.optionGroups.length })}
          </Text>
        ) : null}

        {update.isError ? (
          <Text testID="edit-item-error" variant="small" color="danger">
            {(update.error as Error).message}
          </Text>
        ) : null}

        <Button
          testID="btn-save-item"
          label={t('merchant.editItem.save')}
          disabled={!canSave}
          onPress={() =>
            update.mutate(
              {
                menuItemId,
                patch: {
                  name: nameValue.trim(),
                  description: descValue.trim(),
                  price: priceSatang,
                  isAvailable: availableValue,
                },
              },
              { onSuccess: () => navigation.goBack() },
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
