import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { IconChip } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import {
  usePaymentStore,
  PAYMENT_METHODS,
  PAYMENT_ICON,
  isPayable,
  type PaymentMethod,
} from '../../payment/paymentStore';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'PaymentMethod'>;

/** C18 — เลือกช่องทางจ่ายเงินที่จะใช้เป็นค่าเริ่มต้น */
export function PaymentMethodScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const method = usePaymentStore((s) => s.method);
  const setMethod = usePaymentStore((s) => s.setMethod);

  return (
    <SafeAreaView testID="screen-payment-method" edges={['top', 'bottom']} style={{ flex: 1 }}>
      <ScreenHeader title={t('customer.payment.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.xl, gap: p.space.md }}
      >
        {PAYMENT_METHODS.map((m) => (
          <PaymentRow
            key={m}
            method={m}
            selected={m === method}
            onPress={() => setMethod(m)}
          />
        ))}
        <Text variant="caption" color="muted" style={{ marginTop: p.space.sm }}>
          {t('customer.payment.note')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/** แถวช่องทางจ่ายเงินตาม C18 — ตัวที่เลือกได้ขอบสีแบรนด์ + วงติ๊กถูก */
function PaymentRow({
  method,
  selected,
  onPress,
}: {
  method: PaymentMethod;
  selected: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const usable = isPayable(method);

  return (
    <Pressable
      testID={`payment-${method}`}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !usable }}
      disabled={!usable}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 13,
          backgroundColor: tokens.bgRaised,
          borderRadius: p.radius.lg,
          borderWidth: selected ? 2 : 0,
          borderColor: tokens.brandAccent,
          padding: 15,
          opacity: !usable ? 0.55 : pressed ? 0.9 : 1,
        },
        p.shadow.card,
      ]}
    >
      <IconChip name={PAYMENT_ICON[method]} tone={selected ? 'brand' : 'neutral'} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="small" bold>
          {t(`customer.payment.method.${method}.title`)}
        </Text>
        <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
          {t(`customer.payment.method.${method}.subtitle`)}
        </Text>
      </View>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: selected ? 0 : 2,
          borderColor: tokens.borderSubtle,
          backgroundColor: selected ? tokens.brandAccent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <Icon name="check" color={tokens.textOnBrand} size={14} strokeWidth={3.4} /> : null}
      </View>
    </Pressable>
  );
}
