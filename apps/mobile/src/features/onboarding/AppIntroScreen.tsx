import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Icon, type IconName } from '../../ui/Icon';
import { useOnboardingStore } from './onboardingStore';
import type { AuthStackParamList } from '../../app/navigators/AuthNavigator';

type Props = NativeStackScreenProps<AuthStackParamList, 'AppIntro'>;

/** สามเรื่องที่คนเปิดแอปครั้งแรกต้องรู้ ตรงกับสามจุดใน design A6 */
const SLIDES: { key: string; icon: IconName }[] = [
  { key: 'near', icon: 'burger' },
  { key: 'track', icon: 'bike' },
  { key: 'pay', icon: 'qr' },
];

/** A6 ทัวร์แนะนำแอปครั้งแรก */
export function AppIntroScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const completeIntro = useOnboardingStore((s) => s.completeIntro);
  const [index, setIndex] = useState(0);

  const slide = SLIDES[index]!;
  const isLast = index === SLIDES.length - 1;

  function finish() {
    completeIntro();
    navigation.replace('Login');
  }

  return (
    <SafeAreaView
      testID="screen-app-intro"
      edges={['top', 'bottom']}
      style={{ flex: 1, backgroundColor: tokens.bgSurface }}
    >
      <View style={{ alignItems: 'flex-end', paddingHorizontal: p.space.xl, paddingTop: p.space.sm }}>
        <Pressable
          testID="btn-intro-skip"
          accessibilityRole="button"
          onPress={finish}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: p.space.xs })}
        >
          <Text variant="small" color="muted" bold>
            {t('intro.skip')}
          </Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <View
          style={{
            width: 220,
            height: 220,
            borderRadius: 44,
            backgroundColor: tokens.brandTint,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 36,
          }}
        >
          <Icon name={slide.icon} color={tokens.textOnBrandTint} size={72} strokeWidth={1.4} />
        </View>

        <Text testID="intro-title" variant="h1" style={{ textAlign: 'center' }}>
          {t(`intro.${slide.key}.title`)}
        </Text>
        <Text variant="small" color="muted" style={{ textAlign: 'center', marginTop: p.space.md }}>
          {t(`intro.${slide.key}.body`)}
        </Text>
      </View>

      <View style={{ paddingHorizontal: p.space.xl, paddingBottom: p.space.lg, gap: p.space.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: p.space.xs }}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              testID={`intro-dot-${i}`}
              style={{
                // จุดของหน้าที่อยู่ยืดเป็นขีด ไม่ได้ต่างแค่สี คนตาบอดสีต้องเห็นความต่างด้วย
                width: i === index ? 26 : 8,
                height: 8,
                borderRadius: p.radius.full,
                backgroundColor: i === index ? tokens.brandSolid : tokens.borderSubtle,
              }}
            />
          ))}
        </View>

        <Button
          testID="btn-intro-next"
          label={t(isLast ? 'intro.start' : 'intro.next')}
          onPress={() => (isLast ? finish() : setIndex(index + 1))}
        />
      </View>
    </SafeAreaView>
  );
}
