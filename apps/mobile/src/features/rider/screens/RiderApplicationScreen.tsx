import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Chip, Checkbox } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { repos } from '../../../data';
import { validateDraft, type RiderApplicationDraft } from '../../../lib/riderApplication';
import type { RiderOnboardingParamList } from '../../../app/navigators/RiderOnboardingStack';

type Props = NativeStackScreenProps<RiderOnboardingParamList, 'RiderApplication'>;

const EMPTY: RiderApplicationDraft = {
  nationalId: '', dateOfBirth: '', vehicleRegistration: '',
  licenceExpiry: '', compulsoryInsuranceExpiry: '',
  bankName: '', bankAccountNumber: '', bankAccountName: '',
  emergencyContactName: '', emergencyContactPhone: '',
  acceptContract: false, acceptPdpa: false,
};

/**
 * R5 — ใบสมัครไรเดอร์ (claude.md §7)
 *
 * จอนี้คือสิ่งที่ทำให้บัญชี rider ไม่เป็นทางตัน: ก่อนหน้านี้สมัครบัญชีแล้วเจอ
 * "รอการอนุมัติ" อย่างเดียว โดยที่แอดมินไม่มีใบสมัครให้ตรวจเลย รอไปก็ไม่มีวันได้
 *
 * **รูปเอกสารยังไม่มี** เพราะยังไม่ได้ต่อ Supabase Storage — จอบอกตรง ๆ ว่าต้องเอา
 * ตัวจริงไปให้ดูตอนนัดรับอุปกรณ์ แทนที่จะวางปุ่มอัปโหลดที่กดแล้วไม่มีอะไรเกิดขึ้น
 */
export function RiderApplicationScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const qc = useQueryClient();

  const [draft, setDraft] = useState<RiderApplicationDraft>(EMPTY);
  const [zoneId, setZoneId] = useState<string | undefined>(undefined);
  const [touched, setTouched] = useState(false);

  const { data: zones = [] } = useQuery({
    queryKey: ['rider', 'zones'],
    queryFn: () => repos.rider.zones(),
  });

  const submit = useMutation({
    mutationFn: () => repos.rider.submitApplication({ ...draft, preferredZoneId: zoneId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rider'] }),
  });

  const errors = validateDraft(draft, new Date());
  const ready = Object.keys(errors).length === 0;
  const set = <K extends keyof RiderApplicationDraft>(k: K, v: RiderApplicationDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  /** โชว์ error ต่อเมื่อผู้ใช้กดส่งแล้วครั้งหนึ่ง — ไม่ขึ้นสีแดงใส่ตั้งแต่ยังไม่ได้พิมพ์ */
  const errorFor = (k: string) => (touched && errors[k] ? t(errors[k]!) : undefined);

  if (submit.isSuccess) {
    return (
      <SafeAreaView
        testID="screen-rider-apply"
        edges={['top']}
        style={{ flex: 1, backgroundColor: tokens.bgSurface }}
      >
        <ScreenHeader title={t('rider.apply.title')} onBack={() => navigation.goBack()} />
        <View style={{ padding: p.space.screen, gap: p.space.lg }}>
          <Card testID="application-sent">
            <View style={{ gap: p.space.sm }}>
              <Text variant="h3">{t('rider.apply.sentTitle')}</Text>
              <Text variant="body" color="muted">{t('rider.apply.sentBody')}</Text>
              <Text variant="small" color="muted">{t('rider.apply.documentsNote')}</Text>
              <Button
                testID="btn-apply-done"
                label={t('common.back')}
                onPress={() => navigation.goBack()}
              />
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      testID="screen-rider-apply"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('rider.apply.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: p.space.xxl, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="kicker" color="muted">{t('rider.apply.sectionIdentity')}</Text>

        <Field label={t('rider.apply.nationalId')} hint={errorFor('nationalId')}>
          <Input
            testID="input-national-id"
            accessibilityLabel={t('rider.apply.nationalId')}
            value={draft.nationalId}
            onChangeText={(v) => set('nationalId', v)}
            keyboardType="number-pad"
          />
        </Field>

        <Field
          label={t('rider.apply.dateOfBirth')}
          hint={errorFor('dateOfBirth') ?? t('rider.apply.dateFormat')}
        >
          <Input
            testID="input-dob"
            accessibilityLabel={t('rider.apply.dateOfBirth')}
            value={draft.dateOfBirth}
            onChangeText={(v) => set('dateOfBirth', v)}
            placeholder="2000-01-31"
          />
        </Field>

        <Text variant="kicker" color="muted">{t('rider.apply.sectionVehicle')}</Text>

        <Field label={t('rider.apply.vehicleRegistration')} hint={errorFor('vehicleRegistration')}>
          <Input
            testID="input-vehicle-reg"
            accessibilityLabel={t('rider.apply.vehicleRegistration')}
            value={draft.vehicleRegistration}
            onChangeText={(v) => set('vehicleRegistration', v)}
            autoCapitalize="characters"
          />
        </Field>

        <Field
          label={t('rider.apply.licenceExpiry')}
          hint={errorFor('licenceExpiry') ?? t('rider.apply.dateFormat')}
        >
          <Input
            testID="input-licence-expiry"
            accessibilityLabel={t('rider.apply.licenceExpiry')}
            value={draft.licenceExpiry}
            onChangeText={(v) => set('licenceExpiry', v)}
            placeholder="2029-12-31"
          />
        </Field>

        <Field
          label={t('rider.apply.insuranceExpiry')}
          hint={errorFor('compulsoryInsuranceExpiry') ?? t('rider.apply.dateFormat')}
        >
          <Input
            testID="input-insurance-expiry"
            accessibilityLabel={t('rider.apply.insuranceExpiry')}
            value={draft.compulsoryInsuranceExpiry}
            onChangeText={(v) => set('compulsoryInsuranceExpiry', v)}
            placeholder="2027-06-30"
          />
        </Field>

        <Text variant="kicker" color="muted">{t('rider.apply.sectionPayout')}</Text>

        <Field label={t('rider.apply.bankName')} hint={errorFor('bankName')}>
          <Input
            testID="input-bank-name"
            accessibilityLabel={t('rider.apply.bankName')}
            value={draft.bankName}
            onChangeText={(v) => set('bankName', v)}
          />
        </Field>

        <Field label={t('rider.apply.bankAccountNumber')} hint={errorFor('bankAccountNumber')}>
          <Input
            testID="input-bank-number"
            accessibilityLabel={t('rider.apply.bankAccountNumber')}
            value={draft.bankAccountNumber}
            onChangeText={(v) => set('bankAccountNumber', v)}
            keyboardType="number-pad"
          />
        </Field>

        {/* §7 ชื่อบัญชีควรตรงกับชื่อตามกฎหมาย เป็นด่านกันบัญชีม้า — แอดมินตรวจตอนอนุมัติ */}
        <Field
          label={t('rider.apply.bankAccountName')}
          hint={errorFor('bankAccountName') ?? t('rider.apply.bankNameNote')}
        >
          <Input
            testID="input-bank-holder"
            accessibilityLabel={t('rider.apply.bankAccountName')}
            value={draft.bankAccountName}
            onChangeText={(v) => set('bankAccountName', v)}
          />
        </Field>

        <Text variant="kicker" color="muted">{t('rider.apply.sectionSafety')}</Text>

        <Field label={t('rider.apply.emergencyName')} hint={errorFor('emergencyContactName')}>
          <Input
            testID="input-emergency-name"
            accessibilityLabel={t('rider.apply.emergencyName')}
            value={draft.emergencyContactName}
            onChangeText={(v) => set('emergencyContactName', v)}
          />
        </Field>

        <Field label={t('rider.apply.emergencyPhone')} hint={errorFor('emergencyContactPhone')}>
          <Input
            testID="input-emergency-phone"
            accessibilityLabel={t('rider.apply.emergencyPhone')}
            value={draft.emergencyContactPhone}
            onChangeText={(v) => set('emergencyContactPhone', v)}
            keyboardType="phone-pad"
          />
        </Field>

        {zones.length > 0 ? (
          <View style={{ gap: p.space.sm }}>
            <Text variant="kicker" color="muted">{t('rider.apply.preferredZone')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.sm }}>
              {zones.map((z) => (
                <Chip
                  key={z.id}
                  testID={`zone-${z.id}`}
                  label={z.name}
                  active={z.id === zoneId}
                  onPress={() => setZoneId(z.id === zoneId ? undefined : z.id)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/*
          รูปบัตร/ใบขับขี่/เล่มทะเบียน/พ.ร.บ. ยังอัปโหลดไม่ได้ เพราะยังไม่ได้ต่อ Storage
          บอกตรง ๆ ว่าต้องเอาตัวจริงไปให้ดู ดีกว่าวางปุ่มอัปโหลดที่กดแล้วไม่เกิดอะไร
        */}
        <Card>
          <View style={{ gap: p.space.xs }}>
            <Text variant="kicker" color="muted">{t('rider.apply.documentsTitle')}</Text>
            <Text variant="small" color="muted">{t('rider.apply.documentsNote')}</Text>
          </View>
        </Card>

        {/* §7 ต้องมีทั้งสัญญาผู้รับจ้างอิสระและความยินยอม PDPA ก่อนอนุมัติ */}
        <View style={{ gap: p.space.md }}>
          <Checkbox
            testID="check-contract"
            checked={draft.acceptContract}
            onChange={(v) => set('acceptContract', v)}
            label={t('rider.apply.acceptContract')}
          />
          <Checkbox
            testID="check-pdpa"
            checked={draft.acceptPdpa}
            onChange={(v) => set('acceptPdpa', v)}
            label={t('rider.apply.acceptPdpa')}
          />
        </View>

        <Button
          testID="btn-submit-application"
          label={t('rider.apply.submit')}
          disabled={submit.isPending}
          onPress={() => {
            setTouched(true);
            if (ready) submit.mutate();
          }}
        />

        {touched && !ready ? (
          <Text testID="apply-incomplete" variant="small" color="danger" style={{ textAlign: 'center' }}>
            {t('rider.apply.incomplete')}
          </Text>
        ) : null}

        {submit.isError ? (
          <Text testID="apply-error" variant="small" color="danger" style={{ textAlign: 'center' }}>
            {(submit.error as Error).message}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
