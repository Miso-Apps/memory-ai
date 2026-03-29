import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '../constants/ThemeContext';

interface SerifTitleProps {
  children: React.ReactNode;
  size?: number;
  style?: StyleProp<TextStyle>;
}

export function SerifTitle({ children, size = 32, style }: SerifTitleProps) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          fontFamily: 'DMSerifDisplay_400Regular_Italic',
          fontSize: size,
          color: colors.textPrimary,
          lineHeight: size * 1.15,
          letterSpacing: -0.2,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
