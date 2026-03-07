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
  MessageCircle,
  User,
  type LucideIcon,
} from 'lucide-react-native';

// ─── LinkedIn-style tab icon with press animation and enhanced states ─────────
function TabIcon({
  Icon,
  focused,
  size = 24,
}: {
  Icon: LucideIcon;
  focused: boolean;
  size?: number;
}) {
  const { colors } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const opacityAnim = React.useRef(new Animated.Value(focused ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0.96,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={styles.iconContainer}>
        {/* Background circle for active state */}
        <Animated.View
          style={[
            styles.iconBackground,
            {
              backgroundColor: colors.accentLight,
              opacity: opacityAnim,
            },
          ]}
        />
        <Icon
          size={size}
          color={focused ? colors.accent : colors.textMuted}
          strokeWidth={focused ? 2.5 : 1.8}
        />
      </View>
    </Animated.View>
  );
}

// ─── Enhanced tab button with haptic feedback ──────────────────────────────────
function EnhancedTabButton({ children, onPress, ...rest }: any) {
  const handlePress = (e: any) => {
    // Haptic feedback on tab press (LinkedIn-style)
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

// ─── Center create button embedded in the tab bar ──────────────────────────────
// LinkedIn-inspired FAB with elevated design and better shadows
function CreateTabButton({ children, style, ...rest }: any) {
  const { colors } = useTheme();
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  return (
    <TouchableOpacity
      {...rest}
      style={[style, styles.createTabWrapper]}
      onPress={() => router.push('/capture')}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        {/* Outer ring for depth */}
        <View style={[styles.createBtnRing, { backgroundColor: colors.accentLight }]}>
          <View style={[styles.createBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
            <Plus size={28} color="#FFFFFF" strokeWidth={2.8} />
          </View>
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
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: colors.tabBarBorder,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 12 : 10,
          height: Platform.OS === 'ios' ? 88 : 76,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            },
            android: {
              elevation: 8,
            },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
          letterSpacing: 0.1,
        },
        tabBarShowLabel: true,
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
          title: '',
          tabBarLabel: () => null,
          tabBarButton: (props) => <CreateTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={MessageCircle} focused={focused} />,
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
      <Tabs.Screen name="insights" options={{ href: null }} />
      <Tabs.Screen name="recall" options={{ href: null }} />
      <Tabs.Screen name="archive" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBackground: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  // LinkedIn-style elevated FAB
  createTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  createBtnRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
  },
  createBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
});
