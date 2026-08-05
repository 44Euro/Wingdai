import React, { useState } from 'react';
import { View, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card, Badge } from '../../../ui/Surface';
import { ScreenHeader } from '../../../ui/ScreenHeader';
import { useAuthStore } from '../../auth/authStore';
import type { SuperStackParamList } from '../../../app/navigators/SuperAdminStack';
import type { AccountType, AdminAccountRow } from '../../../data/types';
import { useAdminAccounts, useSetAdminRole } from '../hooks';

type Props = NativeStackScreenProps<SuperStackParamList, 'SuperRoles'>;

/** SA3 ให้และถอนสิทธิ์ผู้ดูแลระบบ */
export function SuperRolesScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const myId = useAuthStore((s) => s.account?.id ?? null);

  const { data: admins = [], isPending } = useAdminAccounts();
  const setRole = useSetAdminRole();

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

        {admins.length === 0 ? (
          <Text testID="super-roles-empty" variant="body" color="muted">
            {isPending ? t('common.loading') : t('super.roles.empty')}
          </Text>
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

      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPending(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(27,25,23,0.55)',
            justifyContent: 'center',
            padding: p.space.xl,
          }}
        >
          <Card style={{ gap: p.space.md, padding: p.space.xl }}>
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
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
