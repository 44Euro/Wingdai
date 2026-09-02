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
import { repos } from '../../../data';
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

  const changePassword = useAuthStore((s) => s.changePassword);
  const changePhone = useAuthStore((s) => s.changePhone);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwDone, setPwDone] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  /** เบอร์ใหม่ต้องผ่าน OTP ก่อน เหมือนตอนสมัคร ไม่ใช่พิมพ์แล้วบันทึกได้เลย */
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneDone, setPhoneDone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  async function savePassword() {
    setPwBusy(true); setPwError(null); setPwDone(false);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setPwDone(true);
    } catch (e) {
      setPwError((e as Error).message);
    } finally {
      setPwBusy(false);
    }
  }

  async function sendCode() {
    setPhoneBusy(true); setPhoneError(null);
    try {
      await repos.auth.requestOtp(newPhone.trim());
      setCodeSent(true);
    } catch (e) {
      setPhoneError((e as Error).message);
    } finally {
      setPhoneBusy(false);
    }
  }

  async function savePhone() {
    setPhoneBusy(true); setPhoneError(null); setPhoneDone(false);
    try {
      const verificationToken = await repos.auth.verifyOtp(newPhone.trim(), code.trim());
      await changePhone({ phone: newPhone.trim(), verificationToken });
      setNewPhone(''); setCode(''); setCodeSent(false); setPhoneDone(true);
    } catch (e) {
      setPhoneError((e as Error).message);
    } finally {
      setPhoneBusy(false);
    }
  }

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

        {/* ชื่อผู้ใช้แก้ไม่ได้จริง ๆ โชว์พร้อมเหตุผล ไม่ใช่ทำเป็นช่องกรอกที่กดแล้วไม่มีอะไรเกิดขึ้น */}
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

        <Card testID="change-password">
          <View style={{ gap: p.space.md }}>
            <Text variant="body" bold>{t('customer.editProfile.passwordTitle')}</Text>
            <Field label={t('customer.editProfile.currentPassword')}>
              <Input
                testID="input-current-password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>
            <Field label={t('customer.editProfile.newPassword')}>
              <Input
                testID="input-new-password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>
            <Button
              testID="btn-save-password"
              label={t('customer.editProfile.passwordTitle')}
              disabled={currentPassword.length === 0 || newPassword.length < 8 || pwBusy}
              loading={pwBusy}
              onPress={() => void savePassword()}
            />
            {pwDone ? (
              <Text testID="password-saved" variant="small" color="success">
                {t('customer.editProfile.passwordSaved')}
              </Text>
            ) : null}
            {pwError ? (
              <Text testID="password-error" variant="small" color="danger">{pwError}</Text>
            ) : null}
          </View>
        </Card>

        <Card testID="change-phone">
          <View style={{ gap: p.space.md }}>
            <Text variant="body" bold>{t('customer.editProfile.phoneTitle')}</Text>
            <Field label={t('customer.editProfile.newPhone')}>
              <Input
                testID="input-new-phone"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
            </Field>

            {codeSent ? (
              <>
                <Text variant="small" color="muted">{t('customer.editProfile.codeSent')}</Text>
                <Field label={t('customer.editProfile.code')}>
                  <Input
                    testID="input-phone-code"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </Field>
                <Button
                  testID="btn-confirm-phone"
                  label={t('customer.editProfile.confirmPhone')}
                  disabled={code.trim().length < 6 || phoneBusy}
                  loading={phoneBusy}
                  onPress={() => void savePhone()}
                />
              </>
            ) : (
              <Button
                testID="btn-send-code"
                variant="secondary"
                label={t('customer.editProfile.sendCode')}
                disabled={newPhone.trim().length < 9 || phoneBusy}
                loading={phoneBusy}
                onPress={() => void sendCode()}
              />
            )}

            {phoneDone ? (
              <Text testID="phone-saved" variant="small" color="success">
                {t('customer.editProfile.phoneSaved')}
              </Text>
            ) : null}
            {phoneError ? (
              <Text testID="phone-error" variant="small" color="danger">{phoneError}</Text>
            ) : null}
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
