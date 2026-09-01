import React, { type ReactNode } from 'react';
import { View, Image, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Surface';
import { getDataMode } from '../data';

/** ความกว้างจอมือถือที่ออกแบบไว้ (iPhone 16/17 Pro) เกินกว่านี้เลย์เอาต์จะยืดจนอ่านยาก */
const PHONE_WIDTH = 430;

/** ต่ำกว่านี้วางสองคอลัมน์แล้วแผงข้างจะบีบจนอ่านไม่ออก ปล่อยให้เป็นกรอบเปล่าดีกว่า */
const ASIDE_MIN_WIDTH = 1024;

/** ชื่อบัญชีทดลองชุดเดียวกับที่จอล็อกอินโชว์ ไม่ได้ตั้งใหม่ */
const ACCOUNTS = [
  { role: 'user', username: 'somchai' },
  { role: 'merchant', username: 'malee' },
  { role: 'rider', username: 'rider_ann' },
  { role: 'admin', username: 'admin_root' },
  { role: 'super_admin', username: 'super_root' },
] as const;

/** กรอบมือถือสำหรับ เว็บ Metro หยิบไฟล์ `.web.tsx` แทน `WebFrame.tsx` ให้เอง */
export function WebFrame({ children }: { children: ReactNode }) {
  const { tokens, primitives: p } = useTheme();
  const { width } = useWindowDimensions();
  const framed = width > PHONE_WIDTH;
  const withAside = width >= ASIDE_MIN_WIDTH;

  const phone = (
    <View
      style={{
        // flex คุมความกว้างในแถว ส่วนความสูงต้องบอกเอง ไม่งั้นกรอบยุบเหลือศูนย์แล้วจอดำทั้งใบ
        flex: 1,
        height: '100%',
        maxWidth: PHONE_WIDTH,
        backgroundColor: tokens.bgSurface,
        overflow: 'hidden',
        // เงา/มุมโค้งเฉพาะตอนมีพื้นที่เหลือรอบ ๆ ให้เห็น
        ...(framed
          ? {
              borderRadius: p.radius.xl,
              maxHeight: 932,
              alignSelf: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.28)',
            }
          : null),
      }}
    >
      {children}
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        // นอกกรอบใช้พื้นจมของธีม เพื่อให้ตัวแอปดูลอยขึ้นมาโดยไม่ต้องเพิ่มสีใหม่นอกระบบโทเคน
        backgroundColor: framed ? tokens.bgSunken : tokens.bgSurface,
        flexDirection: 'row',
        // ต้องเป็น stretch ลูกในแถวจึงได้ความสูงเต็ม แผงข้างค่อยจัดกลางด้วย alignSelf ของตัวเอง
        alignItems: 'stretch',
        justifyContent: 'center',
        gap: withAside ? 72 : 0,
      }}
    >
      {withAside ? <Aside /> : null}
      {phone}
    </View>
  );
}

/**
 * คนที่เปิดลิงก์บนแล็ปท็อปเห็นกรอบมือถือแคบ ๆ กลางพื้นเปล่า แล้วไม่รู้ว่านี่คืออะไร
 * แผงนี้บอกว่าแอปคืออะไรและจะเข้าดูบทบาทไหนได้บ้าง โดยไม่แตะเลย์เอาต์ในกรอบเลย
 */
function Aside() {
  const { t } = useTranslation();
  const { tokens, primitives: p } = useTheme();
  const live = getDataMode() === 'live';

  return (
    <View
      testID="web-aside"
      style={{ width: 380, flexShrink: 0, alignSelf: 'center', gap: p.space.lg }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.md }}>
        <Image
          source={require('../../assets/logo-mark.png')}
          resizeMode="contain"
          style={{ width: 52, height: 52 }}
        />
        <Text variant="h1">{t('web.title')}</Text>
      </View>

      <Text variant="bodyLg" color="muted">{t('web.tagline')}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: p.space.sm }}>
        <Badge label={t(live ? 'demo.badgeLive' : 'demo.badge')} tone={live ? 'teal' : 'neutral'} />
        <Text variant="caption" color="muted" style={{ flex: 1 }}>
          {t(live ? 'demo.hintLive' : 'demo.hint')}
        </Text>
      </View>

      <View
        style={{
          borderRadius: p.radius.lg,
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          backgroundColor: tokens.bgRaised,
          padding: p.space.md,
          gap: p.space.sm,
        }}
      >
        <Text variant="kicker" color="muted">{t('web.accountsTitle')}</Text>
        {ACCOUNTS.map((a) => (
          <View
            key={a.username}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text variant="small" color="muted">{t(`web.role.${a.role}`)}</Text>
            <Text variant="small" bold>{a.username}</Text>
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: tokens.borderSubtle }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="small" color="muted">{t('web.password')}</Text>
          <Text variant="small" bold>{live ? 'wingdai1234' : '1234'}</Text>
        </View>
      </View>

      <Text variant="caption" color="muted">{t('web.hint')}</Text>
    </View>
  );
}
