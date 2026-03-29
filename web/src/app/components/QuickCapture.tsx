import { useState, useEffect } from 'react';
import { Link, PenLine, Mic, Check, X, Clipboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { memoriesApi } from '../services/api';

type CaptureMode = 'menu' | 'link' | 'text' | 'audio' | 'success';

interface QuickCaptureProps {
  onClose: () => void;
}

export function QuickCapture({ onClose }: QuickCaptureProps) {
  const [mode, setMode] = useState<CaptureMode>('menu');
  const [linkValue, setLinkValue] = useState('');
  const [textValue, setTextValue] = useState('');
  const [clipboardContent, setClipboardContent] = useState<string | null>(null);
  const [clipboardType, setClipboardType] = useState<'url' | 'text' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Smart clipboard detection on mount
  useEffect(() => {
    const detectClipboard = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          // Check if it's a URL
          const urlPattern = /^(https?:\/\/|www\.)/i;
          if (urlPattern.test(text.trim())) {
            setClipboardContent(text.trim());
            setClipboardType('url');
          } else if (text.length > 10) {
            // Text content (min 10 chars to be meaningful)
            setClipboardContent(text.trim());
            setClipboardType('text');
          }
        }
      } catch (err) {
        // Clipboard permission denied or not available
        console.log('Clipboard not available');
      }
    };

    detectClipboard();
  }, []);

  const handleSaveClipboard = () => {
    if (!clipboardContent) return;
    setMode('success');
    setTimeout(() => {
      onClose();
    }, 1800); // Faster than before (2000 → 1800)
  };

  const handleSaveLink = async () => {
    if (!linkValue.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await memoriesApi.create({ type: 'link', content: linkValue.trim() });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Khong the luu link.');
      setIsSaving(false);
      return;
    }
    setMode('success');
    setTimeout(() => {
      onClose();
    }, 1800);
  };

  const handleSaveText = async () => {
    if (!textValue.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await memoriesApi.create({ type: 'text', content: textValue.trim() });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Khong the luu ghi chu.');
      setIsSaving(false);
      return;
    }
    setMode('success');
    setTimeout(() => {
      onClose();
    }, 1800);
  };

  const handleSaveAudio = () => {
    setMode('success');
    setTimeout(() => {
      onClose();
    }, 1800);
  };

  // SUCCESS STATE
  if (mode === 'success') {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="text-center px-6">
          <motion.div
            className="w-24 h-24 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center mx-auto mb-6 shadow-lg"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 15,
            }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <Check className="w-12 h-12 text-accent" strokeWidth={3} />
            </motion.div>
          </motion.div>

          <motion.p
            className="text-lg text-foreground/90 leading-relaxed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Xong rồi.<br />
            Mình đã ghi nhớ giúp bạn.
          </motion.p>
        </div>
      </motion.div>
    );
  }

  // LINK MODE
  if (mode === 'link') {
    return (
      <motion.div
        className="fixed inset-0 z-50 bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <motion.button
              onClick={() => setMode('menu')}
              className="w-9 h-9 rounded-full bg-secondary/80 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </motion.button>
            <h3 className="text-base font-medium">Lưu link</h3>
            <div className="w-9" /> {/* Spacer */}
          </div>

          {/* Input */}
          <div className="flex-1 flex items-start pt-8 px-5">
            <input
              type="url"
              value={linkValue}
              onChange={(e) => setLinkValue(e.target.value)}
              placeholder="Dán link vào đây..."
              autoFocus
              className="w-full bg-transparent text-lg outline-none placeholder:text-muted-foreground/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && linkValue.trim() && !isSaving) {
                  void handleSaveLink();
                }
              }}
            />
          </div>

          {/* Action */}
          <div className="px-5 pb-8 pb-safe">
            <motion.button
              onClick={handleSaveLink}
              disabled={!linkValue.trim() || isSaving}
              className="w-full bg-accent text-accent-foreground py-4 rounded-full font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: linkValue.trim() ? 'var(--shadow-fab)' : 'none' }}
              whileHover={{ scale: linkValue.trim() ? 1.02 : 1 }}
              whileTap={{ scale: linkValue.trim() ? 0.98 : 1 }}
            >
              {isSaving ? 'Dang luu...' : 'Luu'}
            </motion.button>
            {saveError && <p className="text-xs text-destructive mt-2 text-center">{saveError}</p>}
          </div>
        </div>
      </motion.div>
    );
  }

  // TEXT MODE
  if (mode === 'text') {
    return (
      <motion.div
        className="fixed inset-0 z-50 bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <motion.button
              onClick={() => setMode('menu')}
              className="w-9 h-9 rounded-full bg-secondary/80 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </motion.button>
            <h3 className="text-base font-medium">Viết nhanh</h3>
            <div className="w-9" /> {/* Spacer */}
          </div>

          {/* Input */}
          <div className="flex-1 flex items-start pt-8 px-5">
            <textarea
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              placeholder="Bạn đang nghĩ gì..."
              autoFocus
              rows={10}
              className="w-full bg-transparent text-base outline-none resize-none placeholder:text-muted-foreground/40 leading-relaxed"
            />
          </div>

          {/* Action */}
          <div className="px-5 pb-8">
            <motion.button
              onClick={handleSaveText}
              disabled={!textValue.trim() || isSaving}
              className="w-full bg-accent text-accent-foreground py-4 rounded-full font-medium shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              whileHover={{ scale: textValue.trim() ? 1.02 : 1 }}
              whileTap={{ scale: textValue.trim() ? 0.98 : 1 }}
            >
              {isSaving ? 'Dang luu...' : 'Luu'}
            </motion.button>
            {saveError && <p className="text-xs text-destructive mt-2 text-center">{saveError}</p>}
          </div>
        </div>
      </motion.div>
    );
  }

  // AUDIO MODE
  if (mode === 'audio') {
    return (
      <motion.div
        className="fixed inset-0 z-50 bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="h-full flex flex-col items-center justify-center px-6">
          {/* Close button */}
          <div className="absolute top-4 right-4">
            <motion.button
              onClick={() => setMode('menu')}
              className="w-9 h-9 rounded-full bg-secondary/80 flex items-center justify-center"
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </motion.button>
          </div>

          {/* Recording animation */}
          <motion.div
            className="w-32 h-32 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center mb-8 shadow-xl relative overflow-hidden"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <motion.div
              className="absolute inset-0 bg-accent/10"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Mic className="w-14 h-14 text-accent" strokeWidth={2.5} />
            </motion.div>
          </motion.div>

          <h3 className="text-xl font-medium mb-2">Đang ghi âm...</h3>
          <p className="text-muted-foreground/80 text-center mb-12">
            Nói những gì bạn đang nghĩ
          </p>

          <motion.button
            onClick={handleSaveAudio}
            className="w-full max-w-xs bg-accent text-accent-foreground py-4 rounded-full font-medium shadow-md"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Hoàn tất
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // MENU (Default)
  const captureOptions = [
    {
      id: 'link' as CaptureMode,
      icon: Link,
      label: 'Lưu link',
    },
    {
      id: 'text' as CaptureMode,
      icon: PenLine,
      label: 'Viết nhanh',
    },
    {
      id: 'audio' as CaptureMode,
      icon: Mic,
      label: 'Ghi âm',
    },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />

      {/* Menu */}
      <motion.div
        className="relative w-full max-w-md mx-auto bg-card rounded-t-[32px] pb-safe"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-border/60" />
        </div>

        {/* Title */}
        <div className="px-6 pb-4">
          <h3 className="text-xl font-medium">Lưu nhanh</h3>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Chọn cách bạn muốn lưu
          </p>
        </div>

        {/* Options */}
        <div className="px-6 pb-6 space-y-3">
          {/* Smart Clipboard Quick Action */}
          {clipboardContent && (
            <motion.button
              onClick={handleSaveClipboard}
              className="w-full p-4 rounded-2xl bg-accent/10 border-2 border-accent/30 hover:border-accent/50 transition-all relative overflow-hidden"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Glow effect */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-accent/5 via-accent/10 to-accent/5"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
              
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Clipboard className="w-6 h-6 text-accent" strokeWidth={2.5} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-medium text-accent">
                      {clipboardType === 'url' ? 'Lưu link từ clipboard' : 'Lưu ghi chú từ clipboard'}
                    </span>
                    <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">
                      1 tap
                    </span>
                  </div>
                  <p className="text-sm text-foreground/70 truncate">
                    {clipboardContent.slice(0, 60)}{clipboardContent.length > 60 ? '...' : ''}
                  </p>
                </div>
              </div>
            </motion.button>
          )}
          
          {clipboardContent && (
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="flex-1 h-px bg-border/40" />
              <span className="text-xs text-muted-foreground/60">hoặc chọn loại khác</span>
              <div className="flex-1 h-px bg-border/40" />
            </div>
          )}

          {captureOptions.map((option, index) => {
            const Icon = option.icon;
            return (
              <motion.button
                key={option.id}
                onClick={() => setMode(option.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-secondary/40 hover:bg-secondary/60 transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-accent" strokeWidth={2.5} />
                </div>
                <span className="text-base font-medium">{option.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}