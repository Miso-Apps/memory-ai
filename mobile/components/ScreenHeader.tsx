import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../constants/ThemeContext';
import { SerifTitle } from './SerifTitle';

interface ScreenHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  titleSize?: number;
  paddingHorizontal?: number;
}

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  titleSize = 32,
  paddingHorizontal = 20,
}: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: colors.brandAccent }]}>
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      <SerifTitle size={titleSize}>{title}</SerifTitle>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  eyebrow: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
