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
import type { PaymentGate } from '../../../data/types';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'PaymentMethod'>;

/** C18 เลือกช่องทางจ่ายเงินที่จะใช้เป็นค่าเริ่มต้น */
export function PaymentMethodScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const method = usePaymentStore((s) => s.method);
  const setMethod = usePaymentStore((s) => s.setMethod);
  const available = usePaymentStore((s) => s.available);
  const unavailable = usePaymentStore((s) => s.unavailable);

  /**
   * §6.5 ช่องทางที่ปิดอยู่ยังต้องเห็น แต่กดไม่ได้และบอกเหตุผล การซ่อนทิ้งทำให้ลูกค้า
   * อ่านว่าแอปไม่รองรับเลย ทั้งที่มันแค่ยังไม่เปิด
   */
  const gateOf = new Map<PaymentMethod, PaymentGate>(
    unavailable.map((u) => [u.method, u.gate]),
  );
  const shown = PAYMENT_METHODS.filter((m) => isPayable(m, available) || gateOf.has(m));

  return (
    <SafeAreaView testID="screen-payment-method" edges={['top', 'bottom']} style={{ flex: 1 }}>
      <ScreenHeader title={t('customer.payment.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.xl, gap: p.space.md }}
      >
        {shown.map((m) => (
          <PaymentRow
            key={m}
            method={m}
            selected={m === method}
            gate={gateOf.get(m)}
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

/** แถวช่องทางจ่ายเงินตาม C18 ตัวที่เลือกได้ขอบสีแบรนด์ + วงติ๊กถูก */
function PaymentRow({
  method,
  selected,
  gate,
  onPress,
}: {
  method: PaymentMethod;
  selected: boolean;
  /** มีค่า = ช่องทางนี้ถูกปิดอยู่ ค่าคือคีย์ที่ใช้หาข้อความบอกเหตุผล */
  gate?: PaymentGate;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const disabled = gate !== undefined;

  return (
    <Pressable
      testID={`payment-${method}`}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
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
          opacity: disabled ? 0.55 : pressed ? 0.9 : 1,
        },
        p.shadow.card,
      ]}
    >
      <IconChip name={PAYMENT_ICON[method]} tone={selected && !disabled ? 'brand' : 'neutral'} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="small" bold>
          {t(`customer.payment.method.${method}.title`)}
        </Text>
        <Text
          testID={disabled ? `payment-${method}-reason` : undefined}
          variant="caption"
          color="muted"
          style={{ marginTop: 2 }}
        >
          {disabled
            ? t(`customer.payment.unavailable.${gate}`)
            : t(`customer.payment.method.${method}.subtitle`)}
        </Text>
      </View>
      {disabled ? null : (
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
      )}
    </Pressable>
  );
}
