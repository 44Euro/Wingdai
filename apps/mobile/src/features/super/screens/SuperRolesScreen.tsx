import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { errorText } from '../../../lib/errorText';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Badge } from '../../../ui/Surface';
import { Field, Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { Dialog } from '../../../ui/Dialog';
import { useAuthStore } from '../../auth/authStore';
import type { SuperStackParamList } from '../../../app/navigators/SuperAdminStack';
import type { AccountType, AdminAccountRow } from '../../../data/types';
import { useAdminAccounts, useSetAdminRole, useGrantAdmin, useCreateAdmin } from '../hooks';
import { SkeletonCards } from '../../../ui/motion';

type Props = NativeStackScreenProps<SuperStackParamList, 'SuperRoles'>;

/** SA3 ให้และถอนสิทธิ์ผู้ดูแลระบบ */
export function SuperRolesScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const myId = useAuthStore((s) => s.account?.id ?? null);

  const { data: admins = [], isPending } = useAdminAccounts();
  const setRole = useSetAdminRole();
  const grant = useGrantAdmin();
  const [username, setUsername] = useState('');

  const createAdmin = useCreateAdmin();
  const [form, setForm] = useState({ fullName: '', username: '', phone: '', password: '' });
  const setField = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const formReady =
    form.fullName.trim().length > 0
    && form.username.trim().length >= 3
    && /^0[0-9]{8,9}$/.test(form.phone.trim())
    && form.password.length >= 8;

  /** คนที่กดไว้แต่ยังไม่ยืนยัน การเปลี่ยนสิทธิ์คนอื่นต้องผ่านการอ่านทวนหนึ่งจังหวะ */
  const [pending, setPending] = useState<{ row: AdminAccountRow; next: AccountType } | null>(null);

  return (
    <SafeAreaView
      testID="screen-super-roles"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScreenHeader title={t('super.roles.title')} onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen, paddingTop: 0, gap: p.space.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="small" color="muted">{t('super.roles.subtitle')}</Text>

        {/*
          จอนี้ลิสต์เฉพาะคนที่เป็นแอดมินอยู่แล้ว ถอนสิทธิ์คนสุดท้ายออกแล้วเคยกู้กลับไม่ได้เลย
          ต้องมีทางยกบัญชีอื่นขึ้นมาด้วย ไม่งั้นเป็นประตูทางเดียว
        */}
        {/*
          ทางสมัครปกติสร้างได้แค่ user กับ rider ตาม §4.1 แอดมินคนแรกจึงมาจาก seed เท่านั้น
          ไม่มีจอนี้ ทีมงานใหม่ต้องไปสมัครเป็นลูกค้าก่อนแล้วให้คนอื่นยกให้ ซึ่งอ้อมเกินไป
        */}
        <Card testID="create-admin">
          <View style={{ gap: p.space.sm }}>
            <Text variant="body" bold>{t('super.roles.createTitle')}</Text>
            <Text variant="small" color="muted">{t('super.roles.createHint')}</Text>

            <Field label={t('super.roles.createName')}>
              <Input testID="input-admin-name" value={form.fullName} onChangeText={setField('fullName')} />
            </Field>
            <Field label={t('super.roles.createUsername')}>
              <Input
                testID="input-admin-username"
                value={form.username}
                onChangeText={setField('username')}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Field>
            <Field label={t('super.roles.createPhone')}>
              <Input
                testID="input-admin-phone"
                value={form.phone}
                onChangeText={setField('phone')}
                keyboardType="phone-pad"
              />
            </Field>
            <Field label={t('super.roles.createPassword')}>
              <Input
                testID="input-admin-password"
                value={form.password}
                onChangeText={setField('password')}
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>

            <Button
              testID="btn-create-admin"
              label={t('super.roles.createAction')}
              disabled={!formReady || createAdmin.isPending}
              loading={createAdmin.isPending}
              onPress={() => {
                createAdmin.mutate(
                  {
                    fullName: form.fullName.trim(),
                    username: form.username.trim().toLowerCase(),
                    phone: form.phone.trim(),
                    password: form.password,
                    role: 'admin',
                  },
                  { onSuccess: () => setForm({ fullName: '', username: '', phone: '', password: '' }) },
                );
              }}
            />
            {createAdmin.isError ? (
              <Text testID="create-admin-error" variant="small" color="danger">
                {errorText(createAdmin.error, t, i18n.language)}
              </Text>
            ) : null}
            {createAdmin.isSuccess ? (
              <Text testID="create-admin-done" variant="small" color="success">
                {t('super.roles.createDone')}
              </Text>
            ) : null}
          </View>
        </Card>

        <Card testID="grant-admin">
          <View style={{ gap: p.space.sm }}>
            <Text variant="body" bold>{t('super.roles.grantTitle')}</Text>
            <Text variant="small" color="muted">{t('super.roles.grantHint')}</Text>
            <Input
              testID="input-grant-username"
              value={username}
              onChangeText={setUsername}
              placeholder={t('super.roles.grantPlaceholder')}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button
              testID="btn-grant-admin"
              label={t('super.roles.grantAction')}
              disabled={username.trim().length === 0 || grant.isPending}
              loading={grant.isPending}
              onPress={() => {
                grant.mutate(
                  { username: username.trim(), role: 'admin' },
                  { onSuccess: () => setUsername('') },
                );
              }}
            />
            {grant.isError ? (
              <Text testID="grant-admin-error" variant="small" color="danger">
                {t('super.roles.grantNotFound')}
              </Text>
            ) : null}
            {grant.isSuccess ? (
              <Text testID="grant-admin-done" variant="small" color="muted">
                {t('super.roles.grantDone')}
              </Text>
            ) : null}
          </View>
        </Card>

        {admins.length === 0 ? (
          isPending ? (
            <SkeletonCards testID="list-loading" count={3} photoHeight={0} />
          ) : (
            <Text testID="super-roles-empty" variant="body" color="muted">{t('super.roles.empty')}</Text>
          )
        ) : null}

        {admins.map((row) => {
          const isMe = row.accountId === myId;
          const next: AccountType = row.role === 'super_admin' ? 'admin' : 'super_admin';

          return (
            <Card key={row.accountId} testID={`super-admin-${row.accountId}`}>
              <View style={{ gap: p.space.sm }}>
                <View
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    gap: p.space.md,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="body" bold numberOfLines={1}>{row.fullName}</Text>
                    <Text variant="small" color="muted" numberOfLines={1}>
                      @{row.username} · {row.phone}
                    </Text>
                  </View>
                  <Badge
                    label={t(`super.roles.role.${row.role}`)}
                    tone={row.role === 'super_admin' ? 'brand' : 'teal'}
                  />
                </View>

                {isMe ? (
                  /** บอกว่าทำไมไม่มีปุ่ม ไม่ใช่ปล่อยให้เป็นแถวที่ดูเหมือนโหลดไม่ครบ */
                  <Text testID={`super-admin-self-${row.accountId}`} variant="small" color="muted">
                    {t('super.roles.self')}
                  </Text>
                ) : (
                  /*
                    เรียงลงมา ไม่ใช่วางคู่กัน ป้ายอย่าง "Promote to super admin" ยาวเกินกว่าจะ
                    ใส่ครึ่งความกว้างจอ 430 ได้ วางคู่กันแล้วตัวอักษรชนขอบปุ่มทั้งสองใบ
                  */
                  <View style={{ gap: p.space.sm }}>
                    <Button
                      testID={`btn-role-${row.accountId}`}
                      variant="secondary"
                      label={t(`super.roles.action.${next}`)}
                      onPress={() => setPending({ row, next })}
                    />
                    <Button
                      testID={`btn-revoke-${row.accountId}`}
                      variant="secondary"
                      label={t('super.roles.action.user')}
                      onPress={() => setPending({ row, next: 'user' })}
                    />
                  </View>
                )}
              </View>
            </Card>
          );
        })}

        {setRole.isError ? (
          <Text testID="super-roles-error" variant="small" color="danger">
            {t('common.errorGeneric')}
          </Text>
        ) : null}
      </ScrollView>

      <Dialog testID="confirm-role-dialog" visible={pending !== null} onClose={() => setPending(null)}>
        <Text variant="h3">{t('super.roles.confirmTitle')}</Text>
        {/* เขียนชื่อคนกับบทบาทปลายทางให้ครบ ไม่ใช่ถาม "แน่ใจไหม" ที่ตอบไม่ได้ว่าจะเกิดอะไร */}
        <Text variant="body" color="muted">
          {t('super.roles.confirmBody', {
            name: pending?.row.fullName ?? '',
            role: pending ? t(`super.roles.role.${pending.next}`) : '',
          })}
        </Text>
        <Button
          testID="confirm-role"
          label={t('common.save')}
          onPress={() => {
            if (pending) {
              setRole.mutate({ accountId: pending.row.accountId, role: pending.next });
            }
            setPending(null);
          }}
        />
        <Button
          testID="cancel-role"
          variant="secondary"
          label={t('common.cancel')}
          onPress={() => setPending(null)}
        />
      </Dialog>
    </SafeAreaView>
  );
}
