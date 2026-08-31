import React from 'react';
import { View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Card, Badge } from '../../ui/Surface';
import { seedAccounts, MOCK_PASSWORD } from '../../data/mock/seed';
import type { DataMode } from '../../data';

// ไรเดอร์ที่ยังรออนุมัติถูกตัดออก กดแล้วจะเจอจอ "รอตรวจสอบ" ซึ่งคนที่เพิ่งเปิดลิงก์มาอ่านว่าแอปพัง
const PICKS = ['somchai', 'rider_ann', 'admin_root', 'super_root'] as const;

/** รหัสผ่านของบัญชีทดลอง ต่างกันสองฝั่งเพราะ seed ของเซิร์ฟเวอร์ตั้งค่าไว้คนละค่ากับของในเครื่อง */
const SERVER_SEED_PASSWORD = 'wingdai1234';

/** บัญชีทดลองบนจอล็อกอิน */
export function DemoAccounts({
  mode,
  onPick,
}: {
  mode: DataMode;
  onPick: (username: string, password: string) => void;
}) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();

  const password = mode === 'demo' ? MOCK_PASSWORD : SERVER_SEED_PASSWORD;
  const accounts = PICKS.map((u) => seedAccounts.find((a) => a.username === u)).filter(
    (a): a is NonNullable<typeof a> => !!a,
  );

  return (
    <Card testID="demo-accounts" style={{ gap: p.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
        <Badge label={t(mode === 'demo' ? 'demo.badge' : 'demo.badgeLive')} tone="teal" />
        <Text variant="caption" color="muted" style={{ flex: 1 }}>
          {t(mode === 'demo' ? 'demo.hint' : 'demo.hintLive')}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: p.space.xs }}>
        {accounts.map((a) => (
          <Pressable
            key={a.username}
            testID={`demo-pick-${a.username}`}
            accessibilityRole="button"
            onPress={() => onPick(a.username, password)}
            style={({ pressed }) => ({
              paddingHorizontal: p.space.md,
              paddingVertical: p.space.xs,
              borderRadius: p.radius.pill,
              borderWidth: 1.4,
              borderColor: tokens.borderSubtle,
              backgroundColor: tokens.bgRaised,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text variant="caption" bold>{t(`demo.role.${a.accountType}`)}</Text>
          </Pressable>
        ))}
      </View>
    </Card>
  );
}
