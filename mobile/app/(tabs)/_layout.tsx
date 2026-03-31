import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Text,
} from 'react-native';
import { Tabs, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../constants/ThemeContext';
import { useRecallBadgeStore } from '../../store/recallBadgeStore';
import {
  Home,
  Grid2x2,
  Bell,
  User,
  Plus,
  type LucideIcon,
} from 'lucide-react-native';

// ─── Tab icon: filled when active + amber dot, no background box ──────────────
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

  return (
    <View style={styles.iconWrap}>
      <Icon
        size={size}
        color={focused ? colors.textPrimary : colors.textMuted}
        strokeWidth={focused ? 2.2 : 1.6}
        fill={focused ? colors.textPrimary : 'none'}
      />
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
      )}
    </View>
  );
}

// ─── Recall tab with badge ────────────────────────────────────────────────────
function RecallTabIcon({ focused }: { focused: boolean }) {
  const { colors } = useTheme();
  const count = useRecallBadgeStore((s) => s.count);

  return (
    <View style={styles.iconWrap}>
      <Bell
        size={24}
        color={focused ? colors.textPrimary : colors.textMuted}
        strokeWidth={focused ? 2.2 : 1.6}
        fill={focused ? colors.textPrimary : 'none'}
      />
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.badgeRed }]}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
      {focused && (
        <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
      )}
    </View>
  );
}

// ─── Tab button with haptic feedback ─────────────────────────────────────────
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

// ─── Circular dark FAB ────────────────────────────────────────────────────────
function CreateTabButton({ style, ...rest }: any) {
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
      toValue: 0.93,
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
      style={[style, styles.fabWrapper]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel="Lưu nhanh"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Animated.View style={[styles.fab, { transform: [{ scale: scaleAnim }] }]}>
        <Plus size={22} color="#FFFFFF" strokeWidth={2.2} />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopWidth: 1,
          borderColor: colors.tabBarBorder,
          height: Platform.OS === 'ios' ? 82 : 72,
          paddingTop: 4,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          position: 'absolute',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarItemStyle: { paddingTop: 4 },
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
          tabBarIcon: ({ focused }) => <TabIcon Icon={Grid2x2} focused={focused} />,
          tabBarButton: (props) => <EnhancedTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t('tabs.capture'),
          tabBarIcon: () => null,
          tabBarButton: (props) => <CreateTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="recall"
        options={{
          title: t('tabs.recall'),
          tabBarIcon: ({ focused }) => <RecallTabIcon focused={focused} />,
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
      {/* Hidden screens — not shown in tab bar */}
      <Tabs.Screen name="insights" options={{ href: null }} />
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
          tabBarStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen name="archive" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    position: 'relative',
  },
  activeDot: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FBF7F2',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 12,
  },
  fabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
  },
  fab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2C1810',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2C1810',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 18,
      },
      android: { elevation: 6 },
    }),
  },
});
