import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Badge } from '../../../ui/Surface';
import { Input } from '../../../ui/Field';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { Dialog } from '../../../ui/Dialog';
import { useAuthStore } from '../../auth/authStore';
import type { SuperStackParamList } from '../../../app/navigators/SuperAdminStack';
import type { AccountType, AdminAccountRow } from '../../../data/types';
import { useAdminAccounts, useSetAdminRole, useGrantAdmin } from '../hooks';
import { SkeletonCards } from '../../../ui/motion';

type Props = NativeStackScreenProps<SuperStackParamList, 'SuperRoles'>;

/** SA3 ให้และถอนสิทธิ์ผู้ดูแลระบบ */
export function SuperRolesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const myId = useAuthStore((s) => s.account?.id ?? null);

  const { data: admins = [], isPending } = useAdminAccounts();
  const setRole = useSetAdminRole();
  const grant = useGrantAdmin();
  const [username, setUsername] = useState('');

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
                  <View style={{ flexDirection: 'row', gap: p.space.sm }}>
                    <Button
                      testID={`btn-role-${row.accountId}`}
                      variant="secondary"
                      label={t(`super.roles.action.${next}`)}
                      onPress={() => setPending({ row, next })}
                      style={{ flex: 1 }}
                    />
                    <Button
                      testID={`btn-revoke-${row.accountId}`}
                      variant="secondary"
                      label={t('super.roles.action.user')}
                      onPress={() => setPending({ row, next: 'user' })}
                      style={{ flex: 1 }}
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
