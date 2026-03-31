import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../constants/ThemeContext';
import {
  Home,
  BookOpen,
  Plus,
  BarChart3,
  User,
  type LucideIcon,
} from 'lucide-react-native';

// ─── Floating dock icon with subtle active state ───────────────────────────────
function TabIcon({
  Icon,
  focused,
  size = 20,
}: {
  Icon: LucideIcon;
  focused: boolean;
  size?: number;
}) {
  const { colors } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(focused ? 1 : 0.98)).current;
  const opacityAnim = React.useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.98,
        useNativeDriver: true,
        tension: 260,
        friction: 18,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0,
        duration: 170,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={styles.iconContainer}>
        <Animated.View
          style={[
            styles.iconBackground,
            {
              backgroundColor: colors.brandAccentLight,
              opacity: opacityAnim,
            },
          ]}
        />
        <Icon
          size={size}
          color={focused ? colors.textPrimary : colors.textMuted}
          strokeWidth={focused ? 2.3 : 2}
        />
      </View>
    </Animated.View>
  );
}

// ─── Tab button with haptic feedback ────────────────────────────────────────────
function EnhancedTabButton({ children, onPress, ...rest }: any) {
  const handlePress = (e: any) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.selectionAsync();
    }
    onPress?.(e);
  };

  return (
    <TouchableOpacity {...rest} onPress={handlePress} activeOpacity={0.7}>
      {children}
    </TouchableOpacity>
  );
}

// ─── Center add button integrated with label ───────────────────────────────────
function CreateTabButton({ style, ...rest }: any) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.selectionAsync();
    }
    router.push('/capture');
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 280,
      friction: 14,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 280,
      friction: 14,
    }).start();
  };

  return (
    <TouchableOpacity
      {...rest}
      style={[style, styles.createTabWrapper]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={t('tabs.capture')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={[styles.createBtn, { backgroundColor: colors.brandAccent }]}>
          <Plus size={18} color="#FFFFFF" strokeWidth={2.5} />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 1,
          borderColor: colors.tabBarBorder,
          borderRadius: 24,
          marginHorizontal: 12,
          marginBottom: Platform.OS === 'ios' ? 16 : 12,
          height: Platform.OS === 'ios' ? 84 : 78,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 8 : 7,
          position: 'absolute',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
            },
            android: {
              elevation: 10,
            },
          }),
        },
        tabBarItemStyle: {
          paddingTop: 6,
        },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
          tabBarButton: (props) => <EnhancedTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={BookOpen} focused={focused} />,
          tabBarButton: (props) => <EnhancedTabButton {...props} />,
        }}
      />
      {/* ─── Center Create tab ─── */}
      <Tabs.Screen
        name="create"
        options={{
          title: t('tabs.capture'),
          tabBarIcon: () => null,
          tabBarButton: (props) => <CreateTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: t('tabs.insights'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={BarChart3} focused={focused} />,
          tabBarButton: (props) => <EnhancedTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />,
          tabBarButton: (props) => <EnhancedTabButton {...props} />,
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="recall" options={{ href: null }} />
      <Tabs.Screen name="archive" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBackground: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.07,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  createTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
  },
  createBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
