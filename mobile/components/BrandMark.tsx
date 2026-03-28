import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../constants/ThemeContext';

interface BrandMarkProps {
  size?: number;
  foregroundColor?: string;
  backgroundColor?: string;
  filled?: boolean;
}

export function BrandMark({
  size = 52,
  foregroundColor,
  backgroundColor,
  filled = true,
}: BrandMarkProps) {
  const { colors } = useTheme();
  const fg = foregroundColor ?? (filled ? '#FFFFFF' : colors.accent);
  const bg = backgroundColor ?? colors.accent;

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: filled ? bg : 'transparent',
          borderWidth: filled ? 0 : 1.5,
          borderColor: bg,
        },
      ]}
    >
      <View
        style={[
          styles.shell,
          {
            width: size * 0.74,
            height: size * 0.5,
            borderRadius: size * 0.25,
            borderColor: fg,
          },
        ]}
      />

      <View
        style={[
          styles.centerAxis,
          {
            width: 1.8,
            height: size * 0.33,
            backgroundColor: fg,
            opacity: 0.58,
          },
        ]}
      />

      <View
        style={[
          styles.link,
          {
            width: size * 0.22,
            left: size * 0.26,
            top: size * 0.48,
            backgroundColor: fg,
            transform: [{ rotate: '35deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.link,
          {
            width: size * 0.22,
            left: size * 0.52,
            top: size * 0.48,
            backgroundColor: fg,
            transform: [{ rotate: '-35deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.link,
          {
            width: size * 0.24,
            left: size * 0.38,
            top: size * 0.5,
            backgroundColor: fg,
            transform: [{ rotate: '0deg' }],
          },
        ]}
      />

      <View
        style={[
          styles.node,
          {
            width: size * 0.12,
            height: size * 0.12,
            borderRadius: size * 0.06,
            left: size * 0.24,
            top: size * 0.36,
            backgroundColor: fg,
          },
        ]}
      />
      <View
        style={[
          styles.node,
          {
            width: size * 0.12,
            height: size * 0.12,
            borderRadius: size * 0.06,
            left: size * 0.64,
            top: size * 0.36,
            backgroundColor: fg,
          },
        ]}
      />
      <View
        style={[
          styles.node,
          {
            width: size * 0.125,
            height: size * 0.125,
            borderRadius: size * 0.0625,
            left: size * 0.44,
            top: size * 0.58,
            backgroundColor: fg,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  shell: {
    position: 'absolute',
    top: '23%',
    borderWidth: 2.2,
  },
  centerAxis: {
    position: 'absolute',
    top: '28%',
    borderRadius: 2,
  },
  link: {
    position: 'absolute',
    height: 1.8,
    borderRadius: 2,
    opacity: 0.9,
  },
  node: {
    position: 'absolute',
  },
});
