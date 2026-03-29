import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../constants/ThemeContext';

export interface MemoryCardMemory {
  id: string;
  content: string;
  type: 'text' | 'link' | 'voice' | 'photo';
  createdAt: Date;
  imageUrl?: string;
  thumbnailUrl?: string;
  linkPreviewUrl?: string;
  sourceUrl?: string;
  aiSummary?: string;
}

interface MemoryCardProps {
  memory: MemoryCardMemory;
  tag?: string;
  timeAgo?: string;
  onPress: () => void;
  onDismiss?: () => void;
}

function pickThumbUrl(memory: MemoryCardMemory): string | undefined {
  const candidates = [memory.thumbnailUrl, memory.imageUrl, memory.linkPreviewUrl];
  return candidates.find(
    (v) => typeof v === 'string' && /^(https?:\/\/|file:\/\/|content:\/\/|\/)/i.test(v)
  );
}

function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

const TYPE_LABEL: Record<MemoryCardMemory['type'], string> = {
  text: 'text',
  voice: 'voice',
  link: 'link',
  photo: 'photo',
};

export function MemoryCard({ memory, tag, timeAgo, onPress, onDismiss }: MemoryCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const thumbUrl = pickThumbUrl(memory);
  const domain = memory.type === 'link' ? extractDomain(memory.sourceUrl) : undefined;
  const displayText = memory.aiSummary || memory.content;

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.selectionAsync();
    }
    onPress();
  };

  const handleDismiss = () => {
    if (onDismiss) {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        Haptics.selectionAsync();
      }
      onDismiss();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
          elevation: 1,
        },
      ]}
    >
      {/* Top row: tag + type */}
      <View style={styles.topRow}>
        {tag ? (
          <View style={[styles.tagPill, { backgroundColor: colors.brandAccentLight }]}>
            <Text style={[styles.tagText, { color: colors.brandAccent }]}>
              {tag.toUpperCase()}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.typeLabel, { color: colors.textMuted }]}>
          {TYPE_LABEL[memory.type]}
        </Text>
      </View>

      {/* Body row: text + thumbnail */}
      <View style={styles.bodyRow}>
        <View style={styles.textWrap}>
          <Text
            style={[styles.bodyText, { color: colors.textSecondary }]}
            numberOfLines={3}
          >
            {displayText}
          </Text>
          {domain ? (
            <View style={styles.domainRow}>
              <View style={[styles.favicon, { backgroundColor: colors.border }]} />
              <Text style={[styles.domainText, { color: colors.textMuted }]}>{domain}</Text>
            </View>
          ) : null}
        </View>
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={[styles.thumb, { borderColor: colors.border }]}
            resizeMode="cover"
          />
        ) : null}
      </View>

      {/* Footer: time + actions */}
      <View style={styles.footer}>
        <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo ?? ''}</Text>
        <View style={styles.footerActions}>
          {onDismiss ? (
            <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.dismissText, { color: colors.textMuted }]}>
                {t('common.dismissMemory')}
              </Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.openText, { color: colors.brandAccent }]}>
            {t('common.openMemory')} →
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },
  tagPill: {
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontFamily: 'DMSans_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  typeLabel: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  textWrap: {
    flex: 1,
  },
  bodyText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
  },
  favicon: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  domainText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timeText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 10,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dismissText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
  openText: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
});
