import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/Icon';
import { TAB_BAR_CLEARANCE } from '../../../app/navigators/WingdaiTabBar';

export function InboxScreen() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  return (
    <SafeAreaView testID="screen-inbox" edges={['top']} style={{ flex: 1, backgroundColor: tokens.bgSurface }}>
      <View style={{ paddingHorizontal: p.space.screen, paddingTop: p.space.md }}>
        <Text variant="h1">{t('customer.inbox.title')}</Text>
      </View>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 44,
          paddingBottom: TAB_BAR_CLEARANCE,
          gap: p.space.md,
        }}
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
        <Text variant="body" color="muted" style={{ textAlign: 'center' }}>{t('customer.inbox.empty')}</Text>
      </View>
    </SafeAreaView>
  );
}
