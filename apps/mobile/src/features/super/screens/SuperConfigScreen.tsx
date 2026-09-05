import React, { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Dialog } from '../../../ui/Dialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Toggle } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { formatBaht } from '../../../lib/format';
import { errorText } from '../../../lib/errorText';
import { SUPER_TAB_CLEARANCE } from '../../../app/navigators/SuperAdminTabBar';
import type { FeatureFlagKey, PlatformPricing } from '../../../data/types';
import { useSuperConfig, useSetPricing, useSetFlag } from '../hooks';
import { SkeletonCards } from '../../../ui/motion';

type Draft = {
  /** เปอร์เซ็นต์ที่คนอ่านออก เช่น "15" เก็บเป็น bp ตอนส่ง */
  commissionPercent: string;
  deliveryBaseBaht: string;
  deliveryPerKmBaht: string;
  serviceFeeBaht: string;
};

const toDraft = (p: PlatformPricing): Draft => ({
  commissionPercent: String(p.commissionRateBp / 100),
  deliveryBaseBaht: String(p.deliveryBaseSatang / 100),
  deliveryPerKmBaht: String(p.deliveryPerKmSatang / 100),
  serviceFeeBaht: String(p.serviceFeeSatang / 100),
});

/** ค่าที่คนพิมพ์ → หน่วยที่เก็บจริง ซึ่งเป็นหนึ่งในร้อยของหน่วยที่พิมพ์ทั้งคู่ */
function hundredths(text: string): number | null {
  const n = Number(text.trim());
  if (text.trim() === '' || !Number.isFinite(n) || n < 0) return null;
  const value = Math.round(n * 100);
  return Math.abs(n * 100 - value) < 1e-6 ? value : null;
}

/** SA4 + SA6 feature flag กับค่าธรรมเนียม */
export function SuperConfigScreen() {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const { data: config, isPending } = useSuperConfig();
  const setPricing = useSetPricing();
  const setFlag = useSetFlag();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);

  // ค่าจากเซิร์ฟเวอร์เป็นความจริงตั้งต้น เติมลงฟอร์มครั้งเดียวตอนโหลดเสร็จ
  useEffect(() => {
    if (config && draft === null) setDraft(toDraft(config.pricing));
  }, [config, draft]);

  const next = draft && {
    commissionRateBp: hundredths(draft.commissionPercent),
    deliveryBaseSatang: hundredths(draft.deliveryBaseBaht),
    deliveryPerKmSatang: hundredths(draft.deliveryPerKmBaht),
    serviceFeeSatang: hundredths(draft.serviceFeeBaht),
  };

  const allValid = !!next && Object.values(next).every((v) => v !== null);
  const rateOk = next?.commissionRateBp !== null && next?.commissionRateBp !== undefined
    && next.commissionRateBp >= 100 && next.commissionRateBp <= 3000;
  const changed = !!config && !!next && allValid && (
    next.commissionRateBp !== config.pricing.commissionRateBp
    || next.deliveryBaseSatang !== config.pricing.deliveryBaseSatang
    || next.deliveryPerKmSatang !== config.pricing.deliveryPerKmSatang
    || next.serviceFeeSatang !== config.pricing.serviceFeeSatang
  );

  return (
    <SafeAreaView
      testID="screen-super-config"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: SUPER_TAB_CLEARANCE, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text variant="h1">{t('super.config.title')}</Text>
          <Text variant="small" color="muted">{t('super.config.subtitle')}</Text>
        </View>

        {!config && isPending ? (
          <SkeletonCards testID="super-config-loading" count={2} photoHeight={0} />
        ) : null}
        {!config && !isPending ? (
          <Text variant="body" color="muted">{t('common.errorGeneric')}</Text>
        ) : null}

        {config && draft ? (
          <>
            <Card testID="super-pricing">
              <View style={{ gap: p.space.md }}>
                <Text variant="kicker" color="muted">{t('super.config.pricingTitle')}</Text>

                <Field label={t('super.config.commission')}>
                  <Input
                    testID="input-commission"
                    value={draft.commissionPercent}
                    keyboardType="numeric"
                    onChangeText={(v) => setDraft({ ...draft, commissionPercent: v })}
                  />
                </Field>

                <Field label={t('super.config.deliveryBase')}>
                  <Input
                    testID="input-delivery-base"
                    value={draft.deliveryBaseBaht}
                    keyboardType="numeric"
                    onChangeText={(v) => setDraft({ ...draft, deliveryBaseBaht: v })}
                  />
                </Field>

                <Field label={t('super.config.deliveryPerKm')}>
                  <Input
                    testID="input-delivery-per-km"
                    value={draft.deliveryPerKmBaht}
                    keyboardType="numeric"
                    onChangeText={(v) => setDraft({ ...draft, deliveryPerKmBaht: v })}
                  />
                </Field>

                <Field label={t('super.config.serviceFee')}>
                  <Input
                    testID="input-service-fee"
                    value={draft.serviceFeeBaht}
                    keyboardType="numeric"
                    onChangeText={(v) => setDraft({ ...draft, serviceFeeBaht: v })}
                  />
                </Field>

                {!allValid ? (
                  <Text testID="pricing-error" variant="small" color="danger">
                    {t('super.config.badAmount')}
                  </Text>
                ) : null}
                {allValid && !rateOk ? (
                  <Text testID="pricing-rate-error" variant="small" color="danger">
                    {t('super.config.badRate')}
                  </Text>
                ) : null}

                <Button
                  testID="btn-save-pricing"
                  label={t('common.save')}
                  disabled={!changed || !rateOk || setPricing.isPending}
                  onPress={() => setConfirming(true)}
                />
              </View>
            </Card>

            <Card testID="super-flags">
              <View style={{ gap: p.space.md }}>
                <Text variant="kicker" color="muted">{t('super.config.flagsTitle')}</Text>
                {config.flagKeys.map((key: FeatureFlagKey) => (
                  <View
                    key={key}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      gap: p.space.md,
                    }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="body">{t(`super.config.flag.${key}`)}</Text>
                      <Text variant="small" color="muted">
                        {t(`super.config.flagHint.${key}`)}
                      </Text>
                    </View>
                    <Toggle
                      testID={`flag-${key}`}
                      value={config.flags[key]}
                      accessibilityLabel={t(`super.config.flag.${key}`)}
                      onValueChange={(enabled) => setFlag.mutate({ key, enabled })}
                    />
                  </View>
                ))}

                {/* §6.2 เซิร์ฟเวอร์ปฏิเสธเปิดบัตรตราบใดที่ยังไม่รู้ค่าธรรมเนียม สวิตช์เด้งกลับเอง
                    เพราะค่ามาจากเซิร์ฟเวอร์ แต่ถ้าไม่บอกเหตุผล คนกดจะเห็นแค่สวิตช์ที่กดไม่ติด */}
                {setFlag.isError ? (
                  <Text testID="flag-error" variant="small" color="danger">
                    {errorText(setFlag.error, t, i18n.language)}
                  </Text>
                ) : null}
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>

      <Dialog testID="confirm-config-dialog" visible={confirming} onClose={() => setConfirming(false)}>
            <Text variant="h3">{t('super.config.confirmTitle')}</Text>
            {/* ค่าเก่า → ค่าใหม่ ทีละบรรทัด §6.1 ห้ามให้ตัวเลขนี้เลื่อนแบบที่ไม่มีใครเห็น */}
            {config && next && allValid ? (
              <View style={{ gap: p.space.xs }}>
                <ChangeRow
                  testID="change-commission"
                  label={t('super.config.commission')}
                  before={`${config.pricing.commissionRateBp / 100}%`}
                  after={`${next.commissionRateBp! / 100}%`}
                />
                <ChangeRow
                  testID="change-delivery-base"
                  label={t('super.config.deliveryBase')}
                  before={formatBaht(config.pricing.deliveryBaseSatang)}
                  after={formatBaht(next.deliveryBaseSatang!)}
                />
                <ChangeRow
                  testID="change-delivery-per-km"
                  label={t('super.config.deliveryPerKm')}
                  before={formatBaht(config.pricing.deliveryPerKmSatang)}
                  after={formatBaht(next.deliveryPerKmSatang!)}
                />
                <ChangeRow
                  testID="change-service-fee"
                  label={t('super.config.serviceFee')}
                  before={formatBaht(config.pricing.serviceFeeSatang)}
                  after={formatBaht(next.serviceFeeSatang!)}
                />
              </View>
            ) : null}
            <Text variant="small" color="muted">{t('super.config.confirmNote')}</Text>
            <Button
              testID="confirm-pricing"
              label={t('super.config.confirmSave')}
              onPress={() => {
                if (next && allValid) {
                  setPricing.mutate({
                    commissionRateBp: next.commissionRateBp!,
                    deliveryBaseSatang: next.deliveryBaseSatang!,
                    deliveryPerKmSatang: next.deliveryPerKmSatang!,
                    serviceFeeSatang: next.serviceFeeSatang!,
                  });
                }
                setConfirming(false);
              }}
            />
            <Button
              testID="cancel-pricing"
              variant="secondary"
              label={t('common.cancel')}
              onPress={() => setConfirming(false)}
            />
          </Dialog>
    </SafeAreaView>
  );
}

function ChangeRow({
  label, before, after, testID,
}: { label: string; before: string; after: string; testID: string }) {
  const { primitives: p } = useTheme();
  const same = before === after;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: p.space.md }}>
      <Text variant="small" color="muted">{label}</Text>
      <Text testID={testID} variant="small" bold color={same ? 'muted' : 'primary'}>
        {before} → {after}
      </Text>
    </View>
  );
}
