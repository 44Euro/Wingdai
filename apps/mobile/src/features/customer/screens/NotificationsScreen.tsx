import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { IconChip } from '../../../ui/Surface';
import { relativeTime } from '../../../lib/format';
import { useNotifications } from '../hooks';
import { useNotificationStore } from '../notificationStore';
import type { AppNotification, NotificationGroup } from '../notifications';
import type { CustomerStackParamList } from '../../../app/navigators/CustomerStack';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Notifications'>;

const GROUPS: NotificationGroup[] = ['today', 'earlier'];

/** C20 กล่องแจ้งเตือนในแอป เข้าจากกระดิ่งบนหัวจอหน้าแรก */
export function NotificationsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const list = useNotifications();
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  return (
    <SafeAreaView testID="screen-notifications" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: p.space.md,
          paddingHorizontal: p.space.screen,
          paddingTop: p.space.md,
          paddingBottom: p.space.md,
        }}
      >
        <Text variant="h1">{t('customer.notifications.title')}</Text>
        {list.length > 0 ? (
          <Pressable
            testID="link-mark-all-read"
            accessibilityRole="button"
            onPress={markAllRead}
            hitSlop={10}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="caption" color="link" bold>
              {t('customer.notifications.markAllRead')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {list.length === 0 ? (
        <View
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44, gap: p.space.md }}
        >
          <View
            style={[
              {
                width: 112,
                height: 112,
                borderRadius: 56,
                backgroundColor: tokens.bgRaised,
                alignItems: 'center',
                justifyContent: 'center',
              },
              p.shadow.raised,
            ]}
          >
            <Icon name="inbox" color={tokens.textFaint} size={50} strokeWidth={1.7} />
          </View>
          <Text testID="notifications-empty" variant="h3" style={{ textAlign: 'center' }}>
            {t('customer.notifications.empty')}
          </Text>
          <Text variant="small" color="muted" style={{ textAlign: 'center' }}>
            {t('customer.notifications.emptyBody')}
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: p.space.screen, paddingBottom: p.space.xl, gap: p.space.lg }}
        >
          {GROUPS.map((g) => {
            const items = list.filter((n) => n.group === g);
            if (items.length === 0) return null;
            return (
              <View key={g} style={{ gap: p.space.sm }}>
                <Text variant="kicker" color="muted">
                  {t(`customer.notifications.${g}`)}
                </Text>
                {items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    n={n}
                    onPress={() => navigation.navigate('OrderTracking', { orderId: n.orderId })}
                  />
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** การ์ดแจ้งเตือนตาม C20: ชิปไอคอน + หัวข้อ + คำอธิบาย + เวลา (+ จุดส้มถ้ายังไม่อ่าน) */
function NotificationRow({ n, onPress }: { n: AppNotification; onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const rel = relativeTime(n.at);
  return (
    <Pressable
      testID={`notification-${n.id}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: p.space.md,
          backgroundColor: tokens.bgRaised,
          borderRadius: p.radius.lg,
          padding: 14,
          opacity: pressed ? 0.9 : 1,
        },
        p.shadow.card,
      ]}
    >
      <IconChip name="burger" tone="brand" size={38} />
      <View style={{ flex: 1, minWidth: 0, paddingRight: n.unread ? 14 : 0 }}>
        <Text variant="small" bold numberOfLines={1}>
          {t(n.titleKey)}
        </Text>
        <Text variant="caption" color="muted" style={{ marginTop: 2 }}>
          {t(n.bodyKey, { restaurant: n.restaurantName })}
        </Text>
        <Text variant="kicker" color="faint" style={{ marginTop: 6 }}>
          {t(rel.key, { count: rel.count })}
        </Text>
      </View>
      {n.unread ? (
        <View
          testID={`notification-unread-${n.id}`}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: tokens.brandAccent,
          }}
        />
      ) : null}
    </Pressable>
  );
}
