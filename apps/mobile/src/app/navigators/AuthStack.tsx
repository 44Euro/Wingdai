import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { useAuthStore } from '../../features/auth/authStore';
import type { AuthStackParamList } from './AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export function LoginScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  return (
    <View
      testID="screen-login"
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h1">{t('auth.login.title')}</Text>

      <TextInput
        testID="input-identifier"
        accessibilityLabel={t('auth.login.identifier')}
        placeholder={t('auth.login.identifier')}
        placeholderTextColor={tokens.textMuted}
        autoCapitalize="none"
        allowFontScaling={false}
        value={identifier}
        onChangeText={setIdentifier}
        style={{
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: primitives.radius.md,
          padding: primitives.space.lg,
          color: tokens.textPrimary,
          minHeight: 48,
        }}
      />

      <TextInput
        testID="input-password"
        accessibilityLabel={t('auth.login.password')}
        placeholder={t('auth.login.password')}
        placeholderTextColor={tokens.textMuted}
        secureTextEntry
        allowFontScaling={false}
        value={password}
        onChangeText={setPassword}
        style={{
          borderWidth: 1,
          borderColor: tokens.borderSubtle,
          borderRadius: primitives.radius.md,
          padding: primitives.space.lg,
          color: tokens.textPrimary,
          minHeight: 48,
        }}
      />

      {error ? (
        <Text testID="login-error" variant="small" style={{ color: tokens.danger }}>
          {t(error)}
        </Text>
      ) : null}

      <Button
        testID="btn-login"
        label={t('auth.login.submit')}
        onPress={() => login(identifier, password)}
      />

      <Button
        testID="link-register"
        label={t('auth.login.toRegister')}
        variant="secondary"
        onPress={() => navigation.navigate('Register')}
      />

      <Button
        testID="link-forgot"
        label={t('auth.login.forgot')}
        variant="secondary"
        onPress={() => navigation.navigate('ForgotPassword')}
      />
    </View>
  );
}

export function PendingApprovalScreen() {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();
  const logout = useAuthStore((s) => s.logout);

  return (
    <View
      testID="screen-pending"
      style={{
        flex: 1,
        backgroundColor: tokens.bgSurface,
        alignItems: 'center',
        justifyContent: 'center',
        padding: primitives.space.xl,
        gap: primitives.space.lg,
      }}
    >
      <Text variant="h2">{t('auth.pending.title')}</Text>
      <Text variant="body" color="muted" style={{ textAlign: 'center' }}>
        {t('auth.pending.description')}
      </Text>
      <Button
        testID="btn-logout"
        label={t('auth.pending.logout')}
        variant="secondary"
        onPress={() => logout()}
      />
    </View>
  );
}
