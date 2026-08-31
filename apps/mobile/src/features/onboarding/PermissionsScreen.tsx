import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Card, IconChip } from '../../ui/Surface';
import type { IconName } from '../../ui/Icon';
import { useOnboardingStore } from './onboardingStore';
import type { CustomerStackParamList } from '../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Permissions'>;

const ASKS: { key: string; icon: IconName; tone: 'brand' | 'teal' }[] = [
  { key: 'location', icon: 'mapPin', tone: 'brand' },
  { key: 'notifications', icon: 'inbox', tone: 'teal' },
];

/** C30 ขออนุญาตตำแหน่งและการแจ้งเตือน ถามครั้งเดียวตอนเข้าแอปครั้งแรก */
export function PermissionsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const completePermissions = useOnboardingStore((s) => s.completePermissions);
  const [busy, setBusy] = useState(false);

  function enter() {
    completePermissions();
    navigation.replace('Tabs');
  }

  async function allow() {
    setBusy(true);
    try {
      // ปฏิเสธก็เข้าแอปได้ ระบบหาร้านจากที่อยู่ที่บันทึกไว้แทนพิกัดสดได้อยู่แล้ว
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // ผู้ใช้ปิดสิทธิ์ไว้ที่ระดับเครื่อง เรียกแล้ว throw ก็ยังต้องเข้าแอปได้
    } finally {
      setBusy(false);
      enter();
    }
  }

  return (
    <SafeAreaView
      testID="screen-permissions"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ flex: 1, paddingHorizontal: p.space.lg, paddingTop: p.space.xl }}>
        <Text variant="h1">{t('permissions.title')}</Text>
        <Text variant="small" color="muted" style={{ marginTop: p.space.sm }}>
          {t('permissions.subtitle')}
        </Text>

        <View style={{ flex: 1, gap: p.space.md, marginTop: p.space.xxl }}>
          {ASKS.map((ask) => (
            <Card key={ask.key} style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.lg }}>
              <IconChip name={ask.icon} tone={ask.tone} size={52} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="bodyLg" bold>{t(`permissions.${ask.key}.title`)}</Text>
                <Text variant="caption" color="muted" style={{ marginTop: 3 }}>
                  {t(`permissions.${ask.key}.body`)}
                </Text>
              </View>
            </Card>
          ))}
        </View>

        <View style={{ gap: p.space.md, paddingBottom: p.space.lg }}>
          <Button
            testID="btn-permissions-allow"
            label={t('permissions.allow')}
            loading={busy}
            onPress={allow}
          />
          <Pressable
            testID="btn-permissions-skip"
            accessibilityRole="button"
            onPress={enter}
            hitSlop={8}
            style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <Text variant="small" color="muted" bold>{t('permissions.later')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
