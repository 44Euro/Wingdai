import React, { useMemo, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Icon } from '../../../ui/Icon';
import { Card, IconChip } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { haversineKm } from '../../../lib/geo';
import { useRiderStatus, useAdvanceJob } from '../hooks';
import type { RiderJob } from '../../../data/types';
import type { RiderStackParamList } from '../../../app/navigators/RiderStack';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderPickup'>;

/** R10 จุดรับอาหาร */
export function RiderPickupScreen({ navigation, route }: Props) {
  const { orderId } = route.params;
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: status } = useRiderStatus();
  const advance = useAdvanceJob();
  const job = status?.activeJobs.find((j) => j.orderId === orderId);

  const [checked, setChecked] = useState<Set<number>>(new Set());

  const distanceKm = useMemo(() => {
    if (!job || !status?.lastLocation) return null;
    return haversineKm(status.lastLocation, { lat: job.restaurantLat, lng: job.restaurantLng });
  }, [job, status?.lastLocation]);

  if (!job) {
    return (
      <SafeAreaView
        testID="screen-rider-pickup"
        edges={['top']}
        style={{ flex: 1, backgroundColor: tokens.bgSurface }}
      >
        <ScreenHeader title={t('rider.pickup.title')} onBack={() => navigation.goBack()} />
        <View style={{ padding: p.space.screen }}>
          <Text testID="pickup-missing" variant="body" color="muted">{t('rider.job.missing')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const allChecked = checked.size === job.items.length;
  const kitchenStarted = job.status === 'preparing';

  return (
    <SafeAreaView
      testID="screen-rider-pickup"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('rider.pickup.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: p.space.xxl, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={{ flexDirection: 'row', gap: p.space.md }}>
            <IconChip name="store" tone="brand" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="kicker" color="muted">{t('rider.job.pickup')}</Text>
              <Text variant="body" bold>{job.restaurantName}</Text>
              <Text variant="small" color="muted">{job.restaurantAddress}</Text>
              {/* ยังไม่รู้ว่าไรเดอร์อยู่ไหน = ซ่อนไปเลย ห้ามเดาเป็นเลขสวย ๆ */}
              {distanceKm === null ? null : (
                <Text testID="pickup-distance" variant="small" color="muted">
                  {t('rider.pickup.distance', { km: distanceKm.toFixed(1) })}
                </Text>
              )}
            </View>
          </View>
        </Card>

        <KitchenStatus job={job} />

        <View style={{ gap: p.space.sm }}>
          <Text variant="kicker" color="muted">
            {t('rider.pickup.checklist', { done: checked.size, total: job.items.length })}
          </Text>

          {job.items.map((item, idx) => {
            const on = checked.has(idx);
            return (
              <Pressable
                key={`${item.name}-${idx}`}
                testID={`pickup-item-${idx}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={item.name}
                onPress={() => setChecked((prev) => {
                  const next = new Set(prev);
                  if (next.has(idx)) next.delete(idx);
                  else next.add(idx);
                  return next;
                })}
              >
                <Card>
                  <View style={{ flexDirection: 'row', gap: p.space.md, alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        marginTop: 2,
                        borderWidth: on ? 0 : 2,
                        borderColor: tokens.borderSubtle,
                        backgroundColor: on ? tokens.brandAccent : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on ? <Icon name="check" color="#FFFFFF" size={14} strokeWidth={3.4} /> : null}
                    </View>

                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text variant="body" bold>{item.quantity}× {item.name}</Text>

                      {item.choiceNames.length > 0 ? (
                        <Text
                          testID={`pickup-choices-${idx}`}
                          variant="small"
                          color="muted"
                        >
                          {item.choiceNames.join(' · ')}
                        </Text>
                      ) : null}

                      {/* ข้อความจากลูกค้าเน้นให้เห็นชัด จอนี้คือที่สุดท้ายที่มันยังมีผล */}
                      {item.note ? (
                        <View
                          testID={`pickup-note-${idx}`}
                          style={{
                            marginTop: 4,
                            backgroundColor: tokens.brandTint,
                            borderRadius: p.radius.md,
                            paddingHorizontal: p.space.md,
                            paddingVertical: p.space.sm,
                          }}
                        >
                          <Text variant="small" color="onBrandTint" bold>{item.note}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>

        {advance.isError ? (
          <Text testID="pickup-error" variant="small" color="danger">
            {errorText(advance.error, t, i18n.language)}
          </Text>
        ) : null}

        {!kitchenStarted ? (
          <Text testID="pickup-waiting-kitchen" variant="small" color="muted">
            {t('rider.job.waitingKitchen')}
          </Text>
        ) : !allChecked ? (
          <Text testID="pickup-check-all" variant="small" color="muted">
            {t('rider.pickup.checkAllFirst')}
          </Text>
        ) : null}

        <Button
          testID="btn-confirm-pickup"
          label={t('rider.pickup.confirm')}
          disabled={!kitchenStarted || !allChecked || advance.isPending}
          onPress={() => advance.mutate(
            { orderId, status: 'picked_up' },
            { onSuccess: () => navigation.goBack() },
          )}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/** อีกกี่นาทีอาหารเสร็จ (§6.3) */
function KitchenStatus({ job }: { job: RiderJob }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();

  if (job.status === 'picked_up') {
    return (
      <Card>
        <Text testID="pickup-already-taken" variant="body" color="success">
          {t('rider.pickup.alreadyTaken')}
        </Text>
      </Card>
    );
  }

  if (!job.acceptedAt) return null;

  const readyAt = new Date(job.acceptedAt).getTime() + job.prepTimeMinutes * 60_000;
  const minutesLeft = Math.ceil((readyAt - Date.now()) / 60_000);

  return (
    <Card tone="teal">
      <View style={{ gap: p.space.xs }}>
        <Text variant="kicker" color="onTealMuted">{t('rider.pickup.kitchen')}</Text>
        <Text testID="pickup-ready-in" variant="h3" color="onTeal">
          {minutesLeft > 0
            ? t('rider.pickup.readyIn', { minutes: minutesLeft })
            : t('rider.pickup.readyNow')}
        </Text>
        {minutesLeft > 0 ? (
          <Text variant="small" color="onTealMuted">{t('rider.pickup.noRush')}</Text>
        ) : null}
      </View>
    </Card>
  );
}
