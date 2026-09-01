import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Surface';
import { RoleSwitcher } from '../../../app/RoleSwitcher';
import { useAuthStore } from '../../auth/authStore';
import { RIDER_TAB_CLEARANCE } from '../../../app/navigators/RiderTabBar';
import type { RiderStackParamList, RiderTabParamList } from '../../../app/navigators/RiderStack';

type Props = CompositeScreenProps<
  BottomTabScreenProps<RiderTabParamList, 'RiderProfile'>,
  NativeStackScreenProps<RiderStackParamList>
>;

/** แท็บโปรไฟล์ของไรเดอร์ */
export function RiderProfileScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const account = useAuthStore((s) => s.account);
  const logout = useAuthStore((s) => s.logout);

  return (
    <SafeAreaView
      testID="screen-rider-profile"
      edges={['top']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <ScrollView
        contentContainerStyle={{
          padding: p.space.screen,
          paddingBottom: RIDER_TAB_CLEARANCE,
          gap: p.space.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="h1">{t('rider.profile.title')}</Text>

        <Card>
          <View style={{ gap: 3 }}>
            <Text testID="rider-profile-name" variant="h3" numberOfLines={1}>
              {account?.fullName ?? ''}
            </Text>
            <Text variant="caption" color="muted" numberOfLines={1}>
              @{account?.username ?? ''}
            </Text>
            <Text variant="small" color="muted">{account?.phone ?? ''}</Text>
          </View>
        </Card>

        {/* R8 §7 บังคับหกชิ้นก่อนอนุมัติ อยู่บนสุดเพราะเป็นสิ่งที่กันไม่ให้เริ่มทำงาน */}
        <Button
          testID="btn-rider-documents"
          variant="secondary"
          label={t('rider.documents.title')}
          onPress={() => navigation.navigate('RiderDocuments')}
        />

        {/* R7 ตั้งเองว่ายอมวิ่งไกลแค่ไหน มีผลกับงานที่ระบบเสนอจริง */}
        <Button
          testID="btn-rider-base"
          variant="secondary"
          label={t('rider.base.open')}
          onPress={() => navigation.navigate('RiderBase')}
        />

        {/* ภาษาและธีมอยู่จอเดียวกันทุกบทบาท ไม่ได้ทำจอตั้งค่าแยกต่อบทบาท */}
        <Button
          testID="btn-go-settings"
          variant="secondary"
          label={t('settings.title')}
          onPress={() => navigation.navigate('Settings')}
        />

        <RoleSwitcher />

        <Button
          testID="btn-logout"
          variant="secondary"
          label={t('customer.profile.logout')}
          onPress={() => logout()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
