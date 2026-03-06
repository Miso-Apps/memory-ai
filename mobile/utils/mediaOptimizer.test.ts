import {
  formatBytes,
  IMAGE_MAX_DIMENSION,
  IMAGE_QUALITY,
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  OPTIMIZED_RECORDING_OPTIONS,
} from './mediaOptimizer';

describe('mediaOptimizer', () => {
  // ─── Constants ────────────────────────────────────────────────────────────
  it('has sensible image defaults', () => {
    expect(IMAGE_MAX_DIMENSION).toBe(1920);
    expect(IMAGE_QUALITY).toBe(0.7);
  });

  it('has backend-matching size limits', () => {
    expect(MAX_AUDIO_BYTES).toBe(25 * 1024 * 1024);
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
  });

  // ─── Audio preset ─────────────────────────────────────────────────────────
  it('uses mono 22050 Hz AAC at 64 kbps for iOS', () => {
    const ios = OPTIMIZED_RECORDING_OPTIONS.ios;
    expect(ios.sampleRate).toBe(22050);
    expect(ios.numberOfChannels).toBe(1);
    expect(ios.bitRate).toBe(64000);
    expect(ios.extension).toBe('.m4a');
  });

  it('uses mono 22050 Hz AAC at 64 kbps for Android', () => {
    const android = OPTIMIZED_RECORDING_OPTIONS.android;
    expect(android.sampleRate).toBe(22050);
    expect(android.numberOfChannels).toBe(1);
    expect(android.bitRate).toBe(64000);
    expect(android.extension).toBe('.m4a');
  });

  // ─── formatBytes ──────────────────────────────────────────────────────────
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512.0 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(2.5 * 1048576)).toBe('2.5 MB');
  });

  it('respects custom decimals', () => {
    expect(formatBytes(1536, 2)).toBe('1.50 KB');
    expect(formatBytes(1536, 0)).toBe('2 KB');
  });
});
