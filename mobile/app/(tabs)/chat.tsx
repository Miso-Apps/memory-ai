import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { chatApi, ChatMessage, ChatSource } from '../../services/api';
import { useTheme, type ThemeColors } from '../../constants/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettingsStore } from '../../store/settingsStore';
import { SimpleMarkdown } from '../../components/SimpleMarkdown';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
}

// SourcePill removed – sources shown as lean footnote count only

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

function ChatBubble({
  message,
  colors,
  t,
}: {
  message: DisplayMessage;
  colors: ThemeColors;
  t: Function;
}) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <View style={[styles.bubbleRow, styles.bubbleRowUser]}>
        <LinearGradient
          colors={['#6366F1', '#818CF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.bubbleUser]}
        >
          <Text style={styles.bubbleTextUser}>{message.content}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
      <View style={styles.assistantAvatar}>
        <Text style={styles.avatarEmoji}>🧠</Text>
      </View>
      <View style={styles.assistantContent}>
        <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          {message.content.length === 0 ? (
            // Empty placeholder while first streaming token hasn't arrived
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={{ fontSize: 13, color: colors.textMuted }}>...</Text>
            </View>
          ) : (
            <SimpleMarkdown
              content={message.content}
              textColor={colors.textPrimary}
              colors={colors}
            />
          )}
        </View>
        {/* Lean source reference – just a subtle count, no list */}
        {message.sources && message.sources.length > 0 && (
          <Text style={[styles.sourcesFootnote, { color: colors.textMuted }]}>
            📎 {message.sources.length} {message.sources.length === 1 ? 'memory' : 'memories'} referenced
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Suggestion Chip ──────────────────────────────────────────────────────────

function SuggestionChip({
  text,
  onPress,
  colors,
}: {
  text: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      style={[styles.suggestionChip, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.suggestionText, { color: colors.accent }]}>{text}</Text>
    </TouchableOpacity>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ colors }: { colors: ThemeColors }) {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAssistant]}>
      <View style={styles.assistantAvatar}>
        <Text style={styles.avatarEmoji}>🧠</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View style={styles.typingDots}>
          <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
          <View style={[styles.dot, styles.dotDelay1, { backgroundColor: colors.textMuted }]} />
          <View style={[styles.dot, styles.dotDelay2, { backgroundColor: colors.textMuted }]} />
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const { preferences } = useSettingsStore();
  const { language } = useSettingsStore();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // Load suggestions on first focus
  useFocusEffect(
    useCallback(() => {
      if (suggestions.length === 0 && messages.length === 0) {
        loadSuggestions();
      }
    }, [])
  );

  // Reload suggestions when language changes (so they show in the right language)
  useEffect(() => {
    if (messages.length === 0) {
      loadSuggestions();
    }
  }, [language]);

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const data = await chatApi.getSuggestions();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      console.warn('Failed to load suggestions', err);
      setSuggestions([
        t('chat.defaultSuggestion1'),
        t('chat.defaultSuggestion2'),
        t('chat.defaultSuggestion3'),
      ]);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    Keyboard.dismiss();
    setInputText('');

    // Add user message
    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    scrollToBottom();
    setLoading(true);

    // Build conversation history from previous messages
    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const useStreaming = preferences?.streaming_responses !== false; // default true

    if (useStreaming) {
      // Add a placeholder assistant message that we'll fill in progressively
      const assistantId = `assistant-${Date.now()}`;
      const placeholderMsg: DisplayMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        sources: [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, placeholderMsg]);
      setIsStreaming(true);

      try {
        await chatApi.stream(
          trimmed,
          history,
          (sources) => {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, sources } : m)
            );
          },
          (token) => {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: m.content + token } : m)
            );
            scrollToBottom();
          },
          () => {
            setLoading(false);
            setIsStreaming(false);
            scrollToBottom();
          },
          (err) => {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: t('chat.error') } : m)
            );
            setLoading(false);
            setIsStreaming(false);
          },
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: t('chat.error') } : m)
        );
        setLoading(false);
        setIsStreaming(false);
      }
    } else {
      // Non-streaming fallback
      try {
        const response = await chatApi.send(trimmed, history);
        const assistantMsg: DisplayMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errorMsg: DisplayMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: t('chat.error'),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    }
  };

  const clearChat = () => {
    setMessages([]);
    loadSuggestions();
  };

  const showWelcome = messages.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {t('chat.title')}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              {t('chat.subtitle')}
            </Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
              <Text style={[styles.clearBtnText, { color: colors.textMuted }]}>
                {t('chat.newChat')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Welcome state */}
          {showWelcome && (
            <View style={styles.welcome}>
              <View style={styles.welcomeIconWrap}>
                <LinearGradient
                  colors={['#6366F1', '#818CF8', '#A78BFA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.welcomeIconGradient}
                >
                  <Text style={styles.welcomeIcon}>🧠</Text>
                </LinearGradient>
              </View>
              <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>
                {t('chat.welcomeTitle')}
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
                {t('chat.welcomeSubtitle')}
              </Text>

              {/* Suggestions */}
              <View style={styles.suggestionsWrap}>
                {suggestionsLoading ? (
                  <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
                ) : (
                  suggestions.map((s, i) => (
                    <SuggestionChip
                      key={i}
                      text={s}
                      onPress={() => sendMessage(s)}
                      colors={colors}
                    />
                  ))
                )}
              </View>
            </View>
          )}

          {/* Chat messages */}
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} colors={colors} t={t} />
          ))}

          {/* Typing indicator – only shown in non-streaming mode */}
          {loading && !isStreaming && <TypingIndicator colors={colors} />}
        </ScrollView>

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
          <View style={[styles.inputWrap, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: colors.textPrimary }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={1000}
              onSubmitEditing={() => sendMessage(inputText)}
              returnKeyType="send"
              blurOnSubmit
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: inputText.trim() && !loading ? colors.accent : colors.textMuted + '40' },
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendIcon}>↑</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTextWrap: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  headerSubtitle: { fontSize: 14 },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  clearBtnText: { fontSize: 13, fontWeight: '500' },

  // Keyboard avoid
  keyboardAvoid: { flex: 1 },

  // Messages
  messagesList: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },

  // Welcome
  welcome: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  welcomeIconWrap: { marginBottom: 20 },
  welcomeIconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeIcon: { fontSize: 40 },
  welcomeTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  welcomeSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 300,
  },
  suggestionsWrap: {
    marginTop: 28,
    width: '100%',
    gap: 10,
  },

  // Suggestion chips
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 14, fontWeight: '500' },

  // Bubble common
  bubbleRow: { marginBottom: 16 },
  bubbleRowUser: { alignItems: 'flex-end' },
  bubbleRowAssistant: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bubble: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, maxWidth: '85%' },

  // User bubble
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleTextUser: { fontSize: 15, lineHeight: 22, color: '#FFFFFF', fontWeight: '400' },

  // Assistant bubble
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F120',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarEmoji: { fontSize: 16 },
  assistantContent: { flex: 1, maxWidth: '85%' },
  bubbleAssistant: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleTextAssistant: { fontSize: 15, lineHeight: 22 },

  // Sources (lean – just a footnote)
  sourcesFootnote: { fontSize: 11, marginTop: 6, marginLeft: 4, opacity: 0.7 },

  // Typing indicator
  typingBubble: { paddingVertical: 16, paddingHorizontal: 20 },
  typingDots: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.5,
  },
  dotDelay1: { opacity: 0.35 },
  dotDelay2: { opacity: 0.2 },

  // Input bar
  inputBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 100,
    paddingVertical: 6,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendIcon: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
});
