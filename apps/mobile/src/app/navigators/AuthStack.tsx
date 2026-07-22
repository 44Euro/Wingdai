import React, { useState } from 'react';
import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme/ThemeProvider';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { useAuthStore } from '../../features/auth/authStore';

export function LoginScreen() {
  const { t } = useTranslation();
  const { tokens, primitives } = useTheme();
  const login = useAuthStore((s) => s.login);
  const error = useAuthStore((s) => s.error);
  const [username, setUsername] = useState('');
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
        testID="input-username"
        accessibilityLabel={t('auth.login.username')}
        placeholder={t('auth.login.username')}
        placeholderTextColor={tokens.textMuted}
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
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
          {error}
        </Text>
      ) : null}

      <Button
        testID="btn-login"
        label={t('auth.login.submit')}
        onPress={() => login(username, password)}
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
