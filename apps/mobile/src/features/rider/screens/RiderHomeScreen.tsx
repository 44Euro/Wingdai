import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Badge, Card, Toggle } from '../../../ui/Surface';
import { RoleSwitcher } from '../../../app/RoleSwitcher';
import { formatBaht } from '../../../lib/format';
import { useTicker } from '../../merchant/hooks';
import { getCurrentCoords } from '../../customer/currentLocation';
import { useRiderStatus, useSetRiderOnline, useRespondToOffer, useRiderStats } from '../hooks';
import { secondsLeftToRespond } from '../offerWindow';
import type { RiderJob, RiderOffer } from '../../../data/types';
import type { RiderStackParamList } from '../../../app/navigators/RiderStack';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderHome'>;

/**
 * R1 — จอหลักของไรเดอร์: เปิด/ปิดรับงาน · งานที่ถืออยู่ · ข้อเสนอ 15 วินาที
 *
 * claude.md §10 ห้ามใช้ blur ที่จอรับงาน — พื้นทึบล้วนเท่านั้น
 * และ §3 ข้อ 4 ห้ามมี KPI/อันดับ/ตัวกระตุ้นให้ขับเร็ว จอนี้จึงโชว์แค่รายได้กับชั่วโมง
 */
export function RiderHomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: status } = useRiderStatus();
  const { data: stats } = useRiderStats();
  const setOnline = useSetRiderOnline();
  const respond = useRespondToOffer();

  const [locationError, setLocationError] = React.useState(false);
  const offer = status?.offer ?? null;
  const now = useTicker(!!offer);

  async function toggleOnline(next: boolean) {
    if (!next) {
      setLocationError(false);
      setOnline.mutate({ isOnline: false });
      return;
    }
    /*
     * ไม่รู้พิกัดก็จ่ายงานให้ไม่ได้ — ขอตำแหน่งก่อนเสมอ แล้วค่อยบอกเซิร์ฟเวอร์ว่าออนไลน์
     * ผู้ใช้ปฏิเสธสิทธิ์ = ยังออฟไลน์อยู่เหมือนเดิม ไม่ใช่ออนไลน์แบบไม่มีพิกัด
     */
    try {
      const at = await getCurrentCoords();
      setOnline.mutate({ isOnline: true, at });
    } catch {
      setLocationError(true);
    }
  }

  const nearCashLimit =
    !!status && status.cashHeldSatang >= status.cashLimitSatang * 0.8;

  return (
    <SafeAreaView
      testID="screen-rider-home"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: p.space.xxl, gap: p.space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}>
          <Text variant="h1">{t('rider.home.title')}</Text>
        </View>

        <View style={{ paddingHorizontal: p.space.screen }}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
              <View style={{ flex: 1 }}>
                <Text variant="h3">
                  {status?.isOnline ? t('rider.home.online') : t('rider.home.offline')}
                </Text>
                <Text variant="small" color="muted">
                  {status?.isOnline ? t('rider.home.onlineHint') : t('rider.home.offlineHint')}
                </Text>
              </View>
              <Toggle
                testID="toggle-rider-online"
                value={status?.isOnline ?? false}
                accessibilityLabel={t('rider.home.toggle')}
                onValueChange={(v) => void toggleOnline(v)}
              />
            </View>
          </Card>
        </View>

        {setOnline.isError || locationError ? (
          <View style={{ paddingHorizontal: p.space.screen }}>
            <Text testID="rider-online-error" variant="small" color="danger">
              {locationError
                ? t('rider.home.locationNeeded')
                : (setOnline.error as Error).message}
            </Text>
          </View>
        ) : null}

        {offer ? (
          <View style={{ paddingHorizontal: p.space.screen }}>
            <OfferCard
              offer={offer}
              secondsLeft={secondsLeftToRespond(offer.expiresAt, now)}
              busy={respond.isPending}
              onAccept={() => respond.mutate({ orderId: offer.orderId, accept: true })}
              onDecline={() => respond.mutate({ orderId: offer.orderId, accept: false })}
            />
          </View>
        ) : null}

        <View style={{ paddingHorizontal: p.space.screen, gap: p.space.md }}>
          <Text variant="kicker" color="muted">{t('rider.home.activeJobs')}</Text>
          {(status?.activeJobs ?? []).length === 0 ? (
            <Text testID="rider-no-jobs" variant="body" color="muted">
              {t('rider.home.noJobs')}
            </Text>
          ) : (
            status!.activeJobs.map((j) => (
              <JobCard
                key={j.orderId}
                job={j}
                onPress={() => navigation.navigate('RiderJob', { orderId: j.orderId })}
              />
            ))
          )}
        </View>

        {/*
          §8 North Star คือ Orders per Rider Hour — โชว์เป็นข้อมูลให้ไรเดอร์เห็นรายได้ตัวเอง
          **ไม่ใช่** อันดับหรือเป้าที่ต้องไล่ตาม เพราะ §3 ข้อ 4 ห้ามสร้างแรงกดดันให้ขับเร็ว
        */}
        <View style={{ paddingHorizontal: p.space.screen }}>
          <Card>
            <View style={{ gap: p.space.sm }}>
              <Text variant="kicker" color="muted">{t('rider.home.summary')}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body" color="muted">{t('rider.home.deliveredCount')}</Text>
                <Text variant="body" bold testID="rider-delivered">{stats?.delivered ?? 0}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body" color="muted">{t('rider.home.hoursOnline')}</Text>
                <Text variant="body" bold>{stats?.hours ?? 0}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body" color="muted">{t('rider.home.cashHeld')}</Text>
                <Text variant="body" bold color={nearCashLimit ? 'danger' : 'primary'}>
                  {formatBaht(status?.cashHeldSatang ?? 0)} / {formatBaht(status?.cashLimitSatang ?? 0)}
                </Text>
              </View>
              {nearCashLimit ? (
                /* §6.2 บอกล่วงหน้า ดีกว่าปล่อยให้งงว่าทำไมงานเงินสดหายไปเฉย ๆ */
                <Text testID="cash-limit-warning" variant="small" color="danger">
                  {t('rider.home.cashLimitWarning')}
                </Text>
              ) : null}
            </View>
          </Card>
        </View>

        <View style={{ paddingHorizontal: p.space.screen }}>
          <RoleSwitcher />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * ⭐ การ์ดข้อเสนอ 15 วินาที (claude.md §6.3 · §10 ห้าม blur)
 * ปฏิเสธได้โดยไม่มีบทลงโทษ — §3 ข้อ 4 ห้ามกดดันไรเดอร์
 */
function OfferCard({
  offer,
  secondsLeft,
  busy,
  onAccept,
  onDecline,
}: {
  offer: RiderOffer;
  secondsLeft: number;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const count = offer.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <Card tone="teal" testID="rider-offer">
      <View style={{ gap: p.space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="kicker" color="onTealMuted">{t('rider.offer.title')}</Text>
          <Text testID="offer-countdown" variant="h2" color="onTeal" bold>
            {secondsLeft}
          </Text>
        </View>

        <View>
          <Text variant="h3" color="onTeal">{offer.restaurantName}</Text>
          <Text variant="small" color="onTealMuted">{offer.restaurantAddress}</Text>
        </View>

        <View>
          <Text variant="kicker" color="onTealMuted">{t('rider.offer.dropoff')}</Text>
          <Text variant="small" color="onTeal">{offer.dropoffAddress}</Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="small" color="onTealMuted">{t('rider.offer.items', { count })}</Text>
          <Text variant="body" color="onTeal" bold>
            {t('rider.offer.pay')} {formatBaht(offer.riderPaySatang)}
          </Text>
        </View>

        {offer.collectCashSatang > 0 ? (
          <Text testID="offer-collect-cash" variant="small" color="onTeal" bold>
            {t('rider.offer.collectCash', { amount: formatBaht(offer.collectCashSatang) })}
          </Text>
        ) : null}

        <View style={{ gap: p.space.sm }}>
          <Button
            testID="btn-accept-offer"
            label={t('rider.offer.accept')}
            disabled={busy || secondsLeft === 0}
            onPress={onAccept}
          />
          <Button
            testID="btn-decline-offer"
            variant="ghostOnDark"
            label={t('rider.offer.decline')}
            disabled={busy}
            onPress={onDecline}
          />
        </View>
      </View>
    </Card>
  );
}

function JobCard({ job, onPress }: { job: RiderJob; onPress: () => void }) {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  return (
    <Pressable testID={`rider-job-${job.orderId}`} onPress={onPress}>
      <Card>
        <View style={{ gap: p.space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="h3">{job.reference}</Text>
              <Text variant="small" color="muted">{job.restaurantName}</Text>
            </View>
            <Badge label={t(`rider.status.${job.status}`)} tone="teal" />
          </View>
          <Text variant="small" color="muted">{job.dropoffAddress}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
