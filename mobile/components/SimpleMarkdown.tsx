/**
 * Lightweight Markdown Renderer for React Native
 * Supports: **bold**, *italic*, `code`, [text](url), bare http URLs,
 *           # headings, bullet lists (- / *), numbered lists
 */
import React from 'react';
import { View, Text, Platform, Linking } from 'react-native';
import type { ThemeColors } from '../constants/ThemeContext';

// ─── Token types ─────────────────────────────────────────────────────────────

export type Token =
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'text'; text: string };

// ─── Inline tokenizer ────────────────────────────────────────────────────────

export function tokenizeInline(raw: string): Token[] {
  const tokens: Token[] = [];
  // Order matters: code > bold > italic > link > bare-url > plain
  const pattern =
    /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/\S+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(raw)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', text: raw.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ kind: 'code', text: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: 'bold', text: m[2] });
    else if (m[3] !== undefined) tokens.push({ kind: 'italic', text: m[3] });
    else if (m[4] !== undefined) tokens.push({ kind: 'link', text: m[4], url: m[5] });
    else if (m[6] !== undefined) tokens.push({ kind: 'link', text: m[6], url: m[6] });
    last = m.index + m[0].length;
  }
  if (last < raw.length) tokens.push({ kind: 'text', text: raw.slice(last) });
  return tokens;
}

// ─── Inline renderer ─────────────────────────────────────────────────────────

export function InlineLine({
  tokens,
  textColor,
  colors,
}: {
  tokens: Token[];
  textColor: string;
  colors: ThemeColors;
}) {
  return (
    <Text>
      {tokens.map((tok, i) => {
        if (tok.kind === 'bold')
          return (
            <Text key={i} style={{ fontWeight: '700', color: textColor }}>
              {tok.text}
            </Text>
          );
        if (tok.kind === 'italic')
          return (
            <Text key={i} style={{ fontStyle: 'italic', color: textColor }}>
              {tok.text}
            </Text>
          );
        if (tok.kind === 'code')
          return (
            <Text
              key={i}
              style={{
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                fontSize: 13,
                backgroundColor: colors.inputBg,
                color: colors.accent,
              }}
            >
              {' '}
              {tok.text}{' '}
            </Text>
          );
        if (tok.kind === 'link')
          return (
            <Text
              key={i}
              style={{ color: colors.accent, textDecorationLine: 'underline' }}
              onPress={() => Linking.openURL(tok.url)}
            >
              {tok.text}
            </Text>
          );
        return (
          <Text key={i} style={{ color: textColor }}>
            {tok.text}
          </Text>
        );
      })}
    </Text>
  );
}

// ─── Block renderer ──────────────────────────────────────────────────────────

export function SimpleMarkdown({
  content,
  textColor,
  colors,
  fontSize = 15,
  lineHeight = 22,
}: {
  content: string;
  textColor: string;
  colors: ThemeColors;
  /** Override base font size (default 15) */
  fontSize?: number;
  /** Override line height (default 22) */
  lineHeight?: number;
}) {
  const lines = content.split('\n');
  const elements: React.ReactElement[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Blank lines → spacing
    if (line.trim() === '') {
      if (elements.length > 0) elements.push(<View key={`gap-${i}`} style={{ height: 6 }} />);
      i++;
      continue;
    }
    // Heading: # / ## / ###
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const size = level === 1 ? 18 : level === 2 ? 16 : 15;
      elements.push(
        <Text key={i} style={{ fontSize: size, fontWeight: '700', color: textColor, marginBottom: 4 }}>
          {headingMatch[2]}
        </Text>,
      );
      i++;
      continue;
    }
    // Bullet list: - item  or  * item
    if (/^[-*]\s/.test(line)) {
      const bulletContent = line.replace(/^[-*]\s/, '');
      elements.push(
        <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
          <Text style={{ color: textColor, marginRight: 6, marginTop: 1 }}>{'•'}</Text>
          <Text style={{ flex: 1, color: textColor, fontSize, lineHeight }}>
            <InlineLine tokens={tokenizeInline(bulletContent)} textColor={textColor} colors={colors} />
          </Text>
        </View>,
      );
      i++;
      continue;
    }
    // Numbered list: 1. item
    if (/^\d+\.\s/.test(line)) {
      const numMatch = line.match(/^(\d+)\.\s(.*)/);
      elements.push(
        <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
          <Text style={{ color: textColor, marginRight: 6, minWidth: 18, fontWeight: '600' }}>
            {numMatch![1]}.
          </Text>
          <Text style={{ flex: 1, color: textColor, fontSize, lineHeight }}>
            <InlineLine tokens={tokenizeInline(numMatch![2])} textColor={textColor} colors={colors} />
          </Text>
        </View>,
      );
      i++;
      continue;
    }
    // Normal paragraph
    elements.push(
      <Text key={i} style={{ fontSize, lineHeight, color: textColor, marginBottom: 2 }}>
        <InlineLine tokens={tokenizeInline(line)} textColor={textColor} colors={colors} />
      </Text>,
    );
    i++;
  }
  return <View>{elements}</View>;
}
