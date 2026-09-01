import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { PressScale } from '../../../ui/motion';
import { TrackingMap } from '../../customer/components/TrackingMap';
import { useRiderStatus, useWorkBase, useSetWorkBase } from '../hooks';
import type { RiderStackParamList } from '../../../app/navigators/RiderStack';
import { SkeletonCards } from '../../../ui/motion';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderBase'>;

/** ตัวเลือกรัศมี 5 กม. คือระยะสูงสุดที่ลูกค้าสั่งได้ กว้างกว่านั้นไม่มีงานเพิ่ม */
const RADIUS_OPTIONS = [1, 2, 3, 5] as const;

/** R7 จุดตั้งทำงาน */
export function RiderBaseScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const { data: status } = useRiderStatus(false);
  const { data: base, isLoading } = useWorkBase();
  const save = useSetWorkBase();

  const [radiusKm, setRadiusKm] = useState<number>(5);

  useEffect(() => {
    if (base) setRadiusKm(base.radiusKm);
  }, [base]);

  /** ปักหมุดที่ไหน: ใช้จุดที่ตั้งไว้เดิมก่อน ถ้ายังไม่เคยตั้งค่อยใช้ตำแหน่งปัจจุบัน */
  const point = base ?? status?.lastLocation ?? null;

  return (
    <SafeAreaView
      testID="screen-rider-base"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('rider.base.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen,
          paddingBottom: p.space.xxl,
          gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="small" color="muted">{t('rider.base.subtitle')}</Text>

        <TrackingMap height={220} />

        {isLoading ? (
          <SkeletonCards testID="list-loading" count={3} photoHeight={0} />
        ) : point === null ? (
          <Card>
            <Text testID="base-no-location" variant="body" color="muted">
              {t('rider.base.needLocation')}
            </Text>
          </Card>
        ) : (
          <>
            <Card>
              <View style={{ gap: 3 }}>
                <Text variant="kicker" color="muted">{t('rider.base.pinnedAt')}</Text>
                <Text testID="base-coords" variant="body" bold>
                  {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                </Text>
                {base === null ? (
                  <Text testID="base-not-set" variant="caption" color="faint">
                    {t('rider.base.notSetYet')}
                  </Text>
                ) : null}
              </View>
            </Card>

            <View style={{ gap: p.space.sm }}>
              <Text variant="kicker" color="muted">{t('rider.base.radiusLabel')}</Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
                {RADIUS_OPTIONS.map((km) => {
                  const on = radiusKm === km;
                  return (
                    <PressScale
                      key={km}
                      testID={`radius-${km}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={t('rider.base.radiusOption', { km })}
                      onPress={() => setRadiusKm(km)}
                    >
                      <View
                        style={{
                          paddingHorizontal: p.space.lg,
                          paddingVertical: 12,
                          minHeight: 44,
                          justifyContent: 'center',
                          borderRadius: p.radius.full,
                          backgroundColor: on ? tokens.tealSolid : tokens.bgRaised,
                        }}
                      >
                        <Text variant="body" bold color={on ? 'onTeal' : 'primary'}>
                          {t('rider.base.radiusOption', { km })}
                        </Text>
                      </View>
                    </PressScale>
                  );
                })}
              </View>

              <Text variant="caption" color="faint">{t('rider.base.radiusHint')}</Text>
            </View>

            {save.isError ? (
              <Text testID="base-error" variant="small" color="danger">
                {(save.error as Error).message}
              </Text>
            ) : null}

            <Button
              testID="btn-save-work-base"
              label={t('rider.base.save')}
              disabled={save.isPending}
              onPress={() => save.mutate({ lat: point.lat, lng: point.lng, radiusKm })}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
