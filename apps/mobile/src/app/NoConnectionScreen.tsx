import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { useConnectionStore } from './connectionStore';

/** คลื่นสัญญาณที่ถูกขีดฆ่า ตาม SY1 ไม่มีในชุดไอคอนกลางเพราะใช้ที่จอนี้จอเดียว */
function NoSignalMark({ color, slash }: { color: string; slash: string }) {
  return (
    <Svg width={118} height={118} viewBox="0 0 24 24" fill="none">
      {[
        'M5 12.55a11 11 0 0 1 14.08 0',
        'M1.42 9a16 16 0 0 1 21.16 0',
        'M8.53 16.11a6 6 0 0 1 6.95 0',
        'M12 20h.01',
      ].map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      ))}
      <Path d="M4 4 20 20" stroke={slash} strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

/** SY1 ต่อเซิร์ฟเวอร์ไม่ได้ ตะกร้าและเซสชันยังอยู่ครบ */
export function NoConnectionScreen({ onRetry }: { onRetry: () => Promise<boolean> }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const reconnecting = useConnectionStore((s) => s.reconnecting);
  const retry = useConnectionStore((s) => s.retry);

  return (
    <SafeAreaView
      testID="screen-no-connection"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 44 }}>
        <View
          style={[
            {
              width: 118,
              height: 118,
              borderRadius: 59,
              backgroundColor: tokens.bgRaised,
              alignItems: 'center',
              justifyContent: 'center',
            },
            p.shadow.card,
          ]}
        >
          <NoSignalMark color={tokens.borderSubtle} slash={tokens.brandSolid} />
        </View>

        <Text variant="h2" style={{ textAlign: 'center', marginTop: p.space.xl }}>
          {t('connection.title')}
        </Text>
        <Text variant="small" color="muted" style={{ textAlign: 'center', marginTop: p.space.sm }}>
          {t('connection.body')}
        </Text>
      </View>

      <View style={{ paddingHorizontal: p.space.lg, paddingBottom: p.space.lg, gap: p.space.sm }}>
        <Button
          testID="btn-retry-connection"
          label={t('connection.retry')}
          loading={reconnecting}
          onPress={() => retry(onRetry)}
        />
        <Text variant="caption" color="faint" bold style={{ textAlign: 'center', minHeight: 18 }}>
          {reconnecting ? t('connection.reconnecting') : ''}
        </Text>
      </View>
    </SafeAreaView>
  );
}
