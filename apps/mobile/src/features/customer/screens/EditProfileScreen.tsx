import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { useAuthStore } from '../../auth/authStore';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'EditProfile'>;

/** C21 แก้โปรไฟล์ */
export function EditProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const account = useAuthStore((s) => s.account);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  const [fullName, setFullName] = useState(account?.fullName ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const nameOk = fullName.trim() !== '';
  // ว่างได้ (= ลบอีเมลออก) แต่ถ้ากรอกมาต้องเป็นอีเมลจริง
  const emailOk = email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const changed =
    fullName.trim() !== (account?.fullName ?? '') || email.trim() !== (account?.email ?? '');

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ fullName: fullName.trim(), email: email.trim() || null });
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView
      testID="screen-edit-profile"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('customer.editProfile.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingBottom: p.space.xxl, gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Field label={t('customer.editProfile.fullName')}>
          <Input
            testID="input-full-name"
            accessibilityLabel={t('customer.editProfile.fullName')}
            value={fullName}
            onChangeText={(v) => { setFullName(v); setSaved(false); }}
          />
        </Field>

        <Field
          label={t('customer.editProfile.email')}
          hint={
            email.trim() !== '' && !emailOk
              ? t('customer.editProfile.emailInvalid')
              : t('customer.editProfile.emailHint')
          }
        >
          <Input
            testID="input-email"
            accessibilityLabel={t('customer.editProfile.email')}
            value={email}
            onChangeText={(v) => { setEmail(v); setSaved(false); }}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>

        {/* ช่องที่แก้ไม่ได้ โชว์พร้อมเหตุผล ไม่ใช่ทำเป็นช่องกรอกที่กดแล้วไม่มีอะไรเกิดขึ้น */}
        <Card>
          <View style={{ gap: p.space.md }}>
            <View style={{ gap: 2 }}>
              <Text variant="kicker" color="muted">{t('customer.editProfile.username')}</Text>
              <Text testID="readonly-username" variant="body">{account?.username ?? '—'}</Text>
            </View>
            <View style={{ gap: 2 }}>
              <Text variant="kicker" color="muted">{t('customer.editProfile.phone')}</Text>
              <Text testID="readonly-phone" variant="body">{account?.phone ?? '—'}</Text>
            </View>
            <Text variant="caption" color="faint">{t('customer.editProfile.lockedNote')}</Text>
          </View>
        </Card>

        <Button
          testID="btn-save-profile"
          label={t('common.save')}
          disabled={!nameOk || !emailOk || !changed || saving}
          onPress={() => void save()}
        />

        {saved ? (
          <Text testID="profile-saved" variant="small" color="success" style={{ textAlign: 'center' }}>
            {t('customer.editProfile.saved')}
          </Text>
        ) : null}

        {error ? (
          <Text testID="profile-error" variant="small" color="danger" style={{ textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
