import React, { useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Field';
import { Badge, Card, Chip, Toggle } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { WEEKDAYS, todayHours } from '../../../lib/openingHours';
import {
  useMyRestaurants, usePauseRestaurant, useSetRestaurantHours, useSetRestaurantOpen,
} from '../hooks';
import type { DayHours, Weekday, WeeklyHours } from '../../../data/types';
import type { MerchantStackParamList } from '../../../app/navigators/MerchantStack';

type Props = NativeStackScreenProps<MerchantStackParamList, 'MerchantHours'>;

/** ตัวเลือกพักที่ดีไซน์วาดไว้ ยาวกว่านี้คือปิดร้าน ไม่ใช่พัก */
const PAUSE_CHOICES = [15, 30, 60] as const;

/** M11 เวลาเปิด-ปิดร้าน และพักรับออร์เดอร์ชั่วคราว */
export function MerchantHoursScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: shops = [] } = useMyRestaurants();
  const shop = shops.find((s) => s.id === route.params.restaurantId);

  const setOpen = useSetRestaurantOpen();
  const setHours = useSetRestaurantHours();
  const pause = usePauseRestaurant();

  /** ร่างในหน้าจอเริ่มจากค่าที่เซิร์ฟเวอร์ส่งมา แล้วแก้ในเครื่องจนกว่าจะกดบันทึก */
  const [draft, setDraft] = useState<WeeklyHours | null>(null);
  const hours = draft ?? shop?.openingHours ?? {};
  const dirty = draft !== null;

  const today = useMemo(() => todayHours(hours, new Date()), [hours]);

  if (!shop) {
    return (
      <SafeAreaView
        testID="screen-merchant-hours"
        edges={['top']}
        style={{ flex: 1, backgroundColor: tokens.bgSurface }}
      >
        <ScreenHeader title={t('merchant.hours.title')} onBack={() => navigation.goBack()} />
        <View style={{ padding: p.space.screen }}>
          <Text testID="hours-missing" variant="body" color="muted">
            {t('merchant.hours.missing')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const setDay = (day: Weekday, value: DayHours) => setDraft({ ...hours, [day]: value });

  const pausedMinutesLeft = shop.pausedUntil
    ? Math.max(0, Math.ceil((new Date(shop.pausedUntil).getTime() - Date.now()) / 60_000))
    : 0;

  return (
    <SafeAreaView
      testID="screen-merchant-hours"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('merchant.hours.title')} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: p.space.screen,
          paddingBottom: p.space.xxl,
          gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* สถานะจริงมาจากเซิร์ฟเวอร์ (`isAcceptingOrders`) ไม่ใช่ค่าสวิตช์ */}
        <Card>
          <View style={{ gap: p.space.sm }}>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                gap: p.space.md,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="kicker" color="muted">{t('merchant.hours.switchLabel')}</Text>
                <Text testID="hours-live-status" variant="body" bold>
                  {shop.isAcceptingOrders
                    ? t('merchant.hours.accepting')
                    : t('merchant.hours.notAccepting')}
                </Text>
              </View>
              <Toggle
                testID="toggle-shop-open"
                value={shop.isOpen}
                accessibilityLabel={t('merchant.hours.switchLabel')}
                onValueChange={(v) => setOpen.mutate({ restaurantId: shop.id, isOpen: v })}
              />
            </View>
            <Text testID="hours-today" variant="small" color="muted">
              {today
                ? t('merchant.hours.todayRange', { open: today.open, close: today.close })
                : t('merchant.hours.todayUnset')}
            </Text>
          </View>
        </Card>

        {/* พักชั่วคราว ต่างจากกดปิดตรงที่เปิดกลับมาเอง ครัวที่ยุ่งจนต้องกดพักคือครัวที่จะลืมกดกลับ */}
        <Card>
          <View style={{ gap: p.space.sm }}>
            <Text variant="kicker" color="muted">{t('merchant.hours.pauseTitle')}</Text>
            {pausedMinutesLeft > 0 ? (
              <>
                <View testID="pause-active" style={{ flexDirection: 'row' }}>
                  <Badge
                    label={t('merchant.hours.pausedFor', { minutes: pausedMinutesLeft })}
                    tone="teal"
                  />
                </View>
                <Button
                  testID="btn-resume"
                  variant="secondary"
                  label={t('merchant.hours.resume')}
                  disabled={pause.isPending}
                  onPress={() => pause.mutate({ restaurantId: shop.id, minutes: 0 })}
                />
              </>
            ) : (
              <>
                <Text variant="small" color="muted">{t('merchant.hours.pauseHint')}</Text>
                <View style={{ flexDirection: 'row', gap: p.space.sm, flexWrap: 'wrap' }}>
                  {PAUSE_CHOICES.map((m) => (
                    <Chip
                      key={m}
                      testID={`btn-pause-${m}`}
                      label={t('merchant.hours.pauseMinutes', { minutes: m })}
                      onPress={() => pause.mutate({ restaurantId: shop.id, minutes: m })}
                    />
                  ))}
                </View>
              </>
            )}
          </View>
        </Card>

        <Text variant="kicker" color="muted">{t('merchant.hours.weeklyTitle')}</Text>

        {WEEKDAYS.map((day) => (
          <DayRow
            key={day}
            day={day}
            value={hours[day] ?? null}
            label={t(`merchant.hours.day.${day}`)}
            closedLabel={t('merchant.hours.closedAllDay')}
            onChange={(v) => setDay(day, v)}
          />
        ))}

        {setHours.isError ? (
          <Text testID="hours-error" variant="small" color="danger">
            {(setHours.error as Error).message}
          </Text>
        ) : null}

        <Button
          testID="btn-save-hours"
          label={t('merchant.hours.save')}
          disabled={!dirty || setHours.isPending}
          onPress={() =>
            setHours.mutate(
              { restaurantId: shop.id, hours },
              { onSuccess: () => setDraft(null) },
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** หนึ่งวันหนึ่งแถว ปิดทั้งวันคือ `null` ไม่ใช่ `00:00–00:00` */
function DayRow({
  day, value, label, closedLabel, onChange,
}: {
  day: Weekday;
  value: DayHours;
  label: string;
  closedLabel: string;
  onChange: (v: DayHours) => void;
}) {
  const { primitives: p } = useTheme();
  const open = value?.open ?? '09:00';
  const close = value?.close ?? '21:00';

  return (
    <Card testID={`hours-row-${day}`}>
      <View style={{ gap: p.space.sm }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            gap: p.space.md,
          }}
        >
          <Text variant="body" bold>{label}</Text>
          <Toggle
            testID={`toggle-day-${day}`}
            value={value !== null}
            accessibilityLabel={label}
            onValueChange={(on) => onChange(on ? { open, close } : null)}
          />
        </View>

        {value === null ? (
          <Text variant="small" color="muted">{closedLabel}</Text>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
            <Input
              testID={`input-open-${day}`}
              value={value.open}
              onChangeText={(v) => onChange({ open: v, close: value.close })}
              placeholder="09:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              style={{ flex: 1, textAlign: 'center' }}
            />
            <Text variant="body" color="muted">–</Text>
            <Input
              testID={`input-close-${day}`}
              value={value.close}
              onChangeText={(v) => onChange({ open: value.open, close: v })}
              placeholder="21:00"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              style={{ flex: 1, textAlign: 'center' }}
            />
          </View>
        )}
      </View>
    </Card>
  );
}
