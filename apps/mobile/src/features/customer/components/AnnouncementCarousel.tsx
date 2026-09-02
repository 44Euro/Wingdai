import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme/ThemeProvider';
import { Text } from '../../../ui/Text';
import { Card } from '../../../ui/Surface';

const SLIDE_COUNT = 3;
const AUTO_MS = 5000;

/**
 * แบนเนอร์ประกาศ เลื่อนเองทีละใบ (ข้อมูลล้วน ห้ามส่วนลด/ราคาตัด ตาม product-spec §2/§3)
 * เลื่อนเองหยุดทันทีที่ผู้ใช้ปัดเอง คนกำลังอ่านอยู่แล้วภาพเลื่อนหนีคือสิ่งที่น่ารำคาญที่สุด
 */
export function AnnouncementCarousel({ restaurantCount }: { restaurantCount: number }) {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [frameWidth, setFrameWidth] = useState(0);

  /**
   * วัดกรอบที่ตัวเองอยู่จริง ไม่ใช่ความกว้างหน้าต่าง
   * บนเว็บ useWindowDimensions คืนขนาดของเบราว์เซอร์ทั้งบาน แต่แอปถูกครอบด้วยกรอบมือถือ
   * การ์ดจึงเคยกว้างเกินกรอบ แล้วใบถัดไปโผล่มาชิดขอบโดยไม่มีช่องไฟคั่น
   */
  const slideWidth = Math.max(frameWidth - p.space.screen * 2, 0);
  const gap = p.space.md;
  const step = slideWidth + gap;

  useEffect(() => {
    if (paused || slideWidth === 0) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % SLIDE_COUNT;
        scroller.current?.scrollTo({ x: next * step, animated: true });
        return next;
      });
    }, AUTO_MS);
    return () => clearInterval(timer);
  }, [paused, step, slideWidth]);

  return (
    <View
      testID="home-banner-frame"
      style={{ gap: p.space.sm }}
      onLayout={(e) => setFrameWidth(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scroller}
        testID="home-banner"
        horizontal
        // pagingEnabled หยุดทีละ "หน้าจอ" ซึ่งไม่เท่ากับหนึ่งใบเมื่อมีช่องไฟคั่น จึงค้างคร่อมสองใบ
        snapToInterval={step}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: p.space.screen }}
        onScrollBeginDrag={() => setPaused(true)}
        onMomentumScrollEnd={(e) => {
          if (step > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / step));
        }}
        scrollEventThrottle={16}
      >
        {Array.from({ length: SLIDE_COUNT }, (_, i) => (
          <View
            key={i}
            testID={`banner-slide-${i}`}
            style={{ width: slideWidth, marginRight: i === SLIDE_COUNT - 1 ? 0 : gap }}
          >
            <Card tone="teal" style={{ overflow: 'hidden', minHeight: 108 }}>
              <Text variant="kicker" style={{ color: p.brand[300] }}>
                {t(`customer.home.banner.slides.${i}.kicker`)}
              </Text>
              <Text variant="bodyLg" color="onTeal" bold style={{ marginTop: 6, maxWidth: '82%' }}>
                {t(`customer.home.banner.slides.${i}.title`)}
              </Text>
              <Text variant="caption" color="onTealMuted" style={{ marginTop: 5, maxWidth: '82%' }}>
                {t(`customer.home.banner.slides.${i}.body`, { count: restaurantCount })}
              </Text>
              <View
                style={{
                  position: 'absolute',
                  right: -24,
                  bottom: -24,
                  width: 110,
                  height: 110,
                  borderRadius: 55,
                  backgroundColor: 'rgba(241,90,34,0.35)',
                }}
              />
            </Card>
          </View>
        ))}
      </ScrollView>

      {/* จุดบอกตำแหน่ง กว้างขึ้นเมื่อเป็นใบปัจจุบัน ไม่ได้แยกด้วยสีอย่างเดียว */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {Array.from({ length: SLIDE_COUNT }, (_, i) => (
          <Pressable
            key={i}
            testID={`banner-dot-${i}`}
            accessibilityRole="button"
            onPress={() => {
              setPaused(true);
              setIndex(i);
              scroller.current?.scrollTo({ x: i * step, animated: true });
            }}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? tokens.brandSolid : tokens.borderSubtle,
            }}
          />
        ))}
      </View>
    </View>
  );
}
