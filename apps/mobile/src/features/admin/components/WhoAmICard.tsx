import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card, Badge } from '../../../ui/Surface';
import { useAuthStore } from '../../auth/authStore';
import { isSuperAdmin } from '../../../lib/capabilities';

/**
 * บอกว่ากำลังทำงานในนามใครและสิทธิ์ระดับไหน
 *
 * จอแรกของแอดมินกับซูเปอร์แอดมินท้ายจอเหมือนกันเป๊ะ (ตั้งค่า · สลับโหมด · ออกจากระบบ)
 * เปิดมาแล้วแยกไม่ออกว่าอยู่บทบาทไหน ซึ่งอันตรายเพราะซูเปอร์แอดมินแก้ค่าคอมกับสิทธิ์คนอื่นได้
 */
export function WhoAmICard() {
  const { t } = useTranslation();
  const { primitives: p } = useTheme();
  const account = useAuthStore((s) => s.account);
  if (!account) return null;

  const isSuper = isSuperAdmin(account.accountType);

  return (
    <Card testID="who-am-i">
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          gap: p.space.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="body" bold numberOfLines={1}>{account.fullName}</Text>
          <Text variant="small" color="muted" numberOfLines={1}>
            @{account.username} · {account.phone}
          </Text>
        </View>
        {/* สีต่างกันด้วย ไม่ได้ต่างแค่ตัวหนังสือ */}
        <Badge
          label={t(`super.roles.role.${isSuper ? 'super_admin' : 'admin'}`)}
          tone={isSuper ? 'brand' : 'teal'}
        />
      </View>
    </Card>
  );
}
