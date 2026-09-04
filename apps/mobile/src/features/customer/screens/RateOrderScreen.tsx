import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Chip } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { formatBaht } from '../../../lib/format';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { Stars } from '../../reviews/components/Stars';
import { useOrderReview, useWriteReview } from '../../reviews/hooks';
import { useOrder, useRestaurant, useTipRider } from '../hooks';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';
import { useTippingEnabled } from '../../payment/paymentStore';

type Props = NativeStackScreenProps<CustomerStackParamList, 'RateOrder'>;

/** ยอดทิปให้เลือก (สตางค์) ดีไซน์วาดสองปุ่ม เพิ่มเป็นสามเพื่อให้มีตัวเลือกที่ถูกกว่า */
const TIP_CHOICES = [1_000, 2_000, 4_000];

/** ให้คะแนนออเดอร์ (design C11) */
export function RateOrderScreen({ navigation, route }: Props) {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { orderId } = route.params;

  const { data: order } = useOrder(orderId);
  const { data: restaurant } = useRestaurant(order?.restaurantId ?? '');
  const { data: existing, isPending: loadingExisting } = useOrderReview(orderId);
  const write = useWriteReview();

  const [restaurantRating, setRestaurantRating] = useState(0);
  const [riderRating, setRiderRating] = useState(0);
  const [comment, setComment] = useState('');
  const [tip, setTip] = useState(0);
  const tippingEnabled = useTippingEnabled();
  const sendTip = useTipRider();

  const body = (() => {
    if (loadingExisting) return null;

    // รีวิวไปแล้ว = โชว์ของที่เขียนไว้ ไม่ใช่ฟอร์มเปล่าที่กดส่งแล้วเด้ง error
    if (existing) {
      return (
        <Card testID="rate-already" style={{ gap: p.space.sm }}>
          <Text variant="h3">{t('customer.rate.alreadyTitle')}</Text>
          <Stars testID="rate-existing-stars" value={existing.restaurantRating} />
          {existing.comment ? <Text variant="small" color="muted">{existing.comment}</Text> : null}
          <Text variant="caption" color="faint">{t('customer.rate.alreadyBody')}</Text>
        </Card>
      );
    }

    return (
      <>
        <Card style={{ gap: p.space.sm }}>
          <Text variant="h3">{restaurant?.name ?? t('customer.rate.restaurant')}</Text>
          <Text variant="small" color="muted">{t('customer.rate.restaurantHint')}</Text>
          <Stars testID="rate-restaurant" value={restaurantRating} onChange={setRestaurantRating} size={30} />
        </Card>

        {order?.riderId ? (
          <Card style={{ gap: p.space.sm }}>
            <Text variant="h3">{t('customer.rate.rider')}</Text>
            <Text variant="small" color="muted">{t('customer.rate.riderHint')}</Text>
            <Stars testID="rate-rider" value={riderRating} onChange={setRiderRating} size={30} />
          </Card>
        ) : null}

        <Card>
          <Field label={t('customer.rate.comment')}>
            <Input
              testID="input-review-comment"
              accessibilityLabel={t('customer.rate.comment')}
              value={comment}
              onChangeText={setComment}
              multiline
              placeholder={t('customer.rate.commentPlaceholder')}
            />
          </Field>
        </Card>

        {/* ทิป (design C11) โผล่เฉพาะใบที่มีไรเดอร์ ยังไม่เคยให้ และเก็บเงินได้จริง (§6.2) */}
        {tippingEnabled && order?.riderId && order.tipSatang === 0 ? (
          <Card style={{ gap: p.space.sm }}>
            <Text variant="h3">{t('customer.tip.title')}</Text>
            <Text variant="small" color="muted">{t('customer.tip.allToRider')}</Text>
            <View style={{ flexDirection: 'row', gap: p.space.sm, flexWrap: 'wrap' }}>
              {TIP_CHOICES.map((amount) => (
                <Chip
                  key={amount}
                  testID={`tip-${amount}`}
                  label={formatBaht(amount)}
                  active={tip === amount}
                  // กดซ้ำที่ยอดเดิม = ยกเลิกการเลือก ไม่ต้องมีปุ่ม "ไม่ให้ทิป" แยก
                  onPress={() => setTip(tip === amount ? 0 : amount)}
                />
              ))}
            </View>
            <Text variant="caption" color="faint">{t('customer.tip.optional')}</Text>
          </Card>
        ) : null}

        {write.isError ? (
          <Text testID="rate-error" variant="small" color="danger">
            {errorText(write.error, t, i18n.language)}
          </Text>
        ) : null}

        {sendTip.isError ? (
          <Text testID="tip-error" variant="small" color="danger">
            {errorText(sendTip.error, t, i18n.language)}
          </Text>
        ) : null}

        <Button
          testID="btn-submit-review"
          label={tip > 0
            ? t('customer.rate.submitWithTip', { amount: formatBaht(tip) })
            : t('customer.rate.submit')}
          // ต้องให้ดาวร้านก่อน รีวิวที่ไม่มีดาวคือคอมเมนต์ลอยที่คิดค่าเฉลี่ยไม่ได้
          disabled={restaurantRating === 0 || write.isPending || sendTip.isPending}
          onPress={() =>
            write.mutate(
              {
                orderId,
                restaurantRating,
                riderRating: riderRating > 0 ? riderRating : null,
                comment: comment.trim() || null,
              },
              {
                /** ส่งรีวิวก่อน ค่อยส่งทิป ทิปเป็นเงินจริงที่ย้อนไม่ได้ (ledger append-only) */
                onSuccess: () => {
                  if (tip === 0) {
                    navigation.goBack();
                    return;
                  }
                  sendTip.mutate(
                    { orderId, amountSatang: tip },
                    { onSuccess: () => navigation.goBack() },
                  );
                },
              },
            )}
        />
      </>
    );
  })();

  return (
    <SafeAreaView
      testID="screen-rate-order"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('customer.rate.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen,
          paddingBottom: p.space.xl,
          gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}
