import React from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../constants/ThemeContext';
import {
  Home,
  BookOpen,
  Plus,
  MessageCircle,
  User,
  type LucideIcon,
} from 'lucide-react-native';

// ─── Standard tab icon with LinkedIn-style line/fill ───────────────────────────
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
    <View style={[styles.iconContainer, focused && { backgroundColor: colors.accentLight }]}>
      <Icon
        size={size}
        color={focused ? colors.accent : colors.textMuted}
        strokeWidth={focused ? 2.5 : 1.8}
      />
    </View>
  );
}

// ─── Center create button embedded in the tab bar ──────────────────────────────
function CreateTabButton({ children, style, ...rest }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      {...rest}
      style={[style, styles.createTabWrapper]}
      onPress={() => router.push('/capture')}
      activeOpacity={0.8}
    >
      <View style={[styles.createBtn, { backgroundColor: colors.accent, shadowColor: colors.accent }]}>
        <Plus size={26} color="#FFFFFF" strokeWidth={2.5} />
      </View>
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
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 10 : 8,
          height: Platform.OS === 'ios' ? 84 : 72,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: t('tabs.library'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={BookOpen} focused={focused} />,
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
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ focused }) => <TabIcon Icon={User} focused={focused} />,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Center create button
  createTabWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  createBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
