import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../constants/ThemeContext';

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
  titleSize = 26,
  paddingHorizontal = 16,
}: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: colors.textMuted }]}>
          {eyebrow.toUpperCase()}
        </Text>
      ) : null}
      <Text
        style={[
          styles.title,
          { color: colors.textPrimary, fontSize: titleSize },
        ]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {subtitle}
        </Text>
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
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});
