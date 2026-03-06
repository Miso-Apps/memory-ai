/**
 * Production media optimization utilities.
 *
 * Provides client-side image compression/resizing and audio recording
 * configuration constants to minimise upload payload before hitting
 * the backend.
 */

import { Audio } from 'expo-av';
import * as ImageManipulator from 'expo-image-manipulator';

// ─── Image optimization ──────────────────────────────────────────────────────

/** Maximum pixel dimension (width or height) for uploaded images. */
export const IMAGE_MAX_DIMENSION = 1920;

/** Default JPEG compression quality (0–1). */
export const IMAGE_QUALITY = 0.7;

/** Target format for all uploaded images – JPEG is widely supported and
 *  produces small files at acceptable quality. */
export const IMAGE_FORMAT = ImageManipulator.SaveFormat.JPEG;

export interface ImageOptimizeOptions {
    /** Max width or height in pixels.  Defaults to IMAGE_MAX_DIMENSION. */
    maxDimension?: number;
    /** JPEG quality 0–1.  Defaults to IMAGE_QUALITY. */
    quality?: number;
    /** Output format.  Defaults to IMAGE_FORMAT (JPEG). */
    format?: ImageManipulator.SaveFormat;
}

export interface OptimizedImage {
    uri: string;
    width: number;
    height: number;
}

/**
 * Resize and compress an image before upload.
 *
 * - Down-scales the longest side to `maxDimension` (default 1920).
 * - Compresses to JPEG at `quality` (default 0.7).
 * - Returns the optimized URI + dimensions.
 */
export async function optimizeImage(
    sourceUri: string,
    options: ImageOptimizeOptions = {},
): Promise<OptimizedImage> {
    const maxDim = options.maxDimension ?? IMAGE_MAX_DIMENSION;
    const quality = options.quality ?? IMAGE_QUALITY;
    const format = options.format ?? IMAGE_FORMAT;

    const actions: ImageManipulator.Action[] = [
        { resize: { width: maxDim, height: maxDim } },
    ];

    const result = await ImageManipulator.manipulateAsync(sourceUri, actions, {
        compress: quality,
        format,
    });

    return {
        uri: result.uri,
        width: result.width,
        height: result.height,
    };
}

// ─── Audio recording presets ─────────────────────────────────────────────────

/**
 * Production-optimised recording preset.
 *
 * Uses AAC encoding at 64 kbps / 22 050 Hz mono — roughly **4× smaller** than
 * the default HIGH_QUALITY preset while retaining excellent speech clarity
 * (the main use-case for Memory AI voice memos).
 */
export const OPTIMIZED_RECORDING_OPTIONS: Audio.RecordingOptions = {
    isMeteringEnabled: false,
    android: {
        extension: '.m4a',
        outputFormat: Audio.AndroidOutputFormat.MPEG_4,
        audioEncoder: Audio.AndroidAudioEncoder.AAC,
        sampleRate: 22050,
        numberOfChannels: 1,
        bitRate: 64000,
    },
    ios: {
        extension: '.m4a',
        outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
        audioQuality: Audio.IOSAudioQuality.MEDIUM,
        sampleRate: 22050,
        numberOfChannels: 1,
        bitRate: 64000,
    },
    web: {
        mimeType: 'audio/webm',
        bitsPerSecond: 64000,
    },
};

// ─── Size helpers ────────────────────────────────────────────────────────────

/** Maximum allowed audio file size in bytes (25 MB — matches backend). */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Maximum allowed image file size in bytes (10 MB — matches backend). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * Return a human-readable file-size string.
 *
 *   formatBytes(1024)       → "1.0 KB"
 *   formatBytes(1048576)    → "1.0 MB"
 */
export function formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
    return `${(bytes / Math.pow(k, i)).toFixed(decimals)} ${sizes[i]}`;
}
