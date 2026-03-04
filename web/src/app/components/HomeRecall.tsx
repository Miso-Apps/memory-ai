import { Link2, PenLine, Mic, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { Toast } from './Toast';

interface ReminderContent {
  id: string;
  type: 'link' | 'note' | 'voice';
  preview: string;
  aiSummary?: string; // AI summary - very subtle
  fullContent?: string;
  savedDate: string;
  url?: string;
  audioUrl?: string;
  duration?: string;
}

export function HomeRecall() {
  // Toggle between states: null (no reminder) | ReminderContent (has reminder)
  const [reminderContent] = useState<ReminderContent | null>({
    id: '1',
    type: 'note',
    preview: 'Suy nghĩ về việc chuyển đổi công việc. Cân nhắc giữa đam mê và ổn định tài chính.',
    aiSummary: 'Về việc cân bằng giữa đam mê và ổn định', // Very light AI summary
    fullContent: 'Mình đang nghĩ đến việc nghỉ công việc hiện tại để theo đuổi dự án riêng. Nhưng lại lo về tài chính và áp lực từ gia đình. Có lẽ mình cần thời gian để chuẩn bị kỹ hơn trước khi quyết định.',
    savedDate: '3 tuần trước',
  });

  const [showDetail, setShowDetail] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showInsight, setShowInsight] = useState(true); // Show insight occasionally

  const handleDismiss = () => {
    // Hide content without asking why
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  // STATE 1: NO REMINDER (DEFAULT - VERY OK)
  if (!reminderContent) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32 bg-background">
        {/* Calm icon */}
        <motion.div
          className="w-20 h-20 rounded-full bg-secondary/30 flex items-center justify-center mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
          </div>
        </motion.div>

        <motion.p
          className="text-center text-foreground/70 text-base leading-relaxed max-w-[260px]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Hiện chưa có nội dung nào cần nhắc.
        </motion.p>
      </div>
    );
  }

  // STATE 2: HAS REMINDER (1 card only)
  const iconMap = {
    link: Link2,
    note: PenLine,
    voice: Mic,
  };

  const Icon = iconMap[reminderContent.type];

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="pt-safe px-5 py-6 border-b border-border/40 flex-shrink-0">
        <motion.h1
          className="text-2xl font-medium mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Nhắc
        </motion.h1>
        <motion.p
          className="text-sm text-muted-foreground/70 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Những gì bạn lưu có thể hữu ích trở lại
        </motion.p>
      </div>

      {/* Single Reminder Card - Centered with max width */}
      <div className="flex-1 overflow-auto px-5 py-8 flex flex-col items-center" style={{ paddingBottom: 'calc(96px + var(--safe-area-bottom))' }}>
        <motion.div
          className="w-full max-w-sm bg-card rounded-2xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="p-5 space-y-4">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center">
                <Icon className="w-5 h-5 text-accent" strokeWidth={2} />
              </div>
            </div>

            {/* Main copy - centered */}
            <p className="text-center text-sm text-muted-foreground/80 leading-relaxed px-2">
              Một điều bạn từng lưu có thể liên quan đến suy nghĩ gần đây của bạn
            </p>

            {/* Preview */}
            <div className="pt-2">
              <p className="text-base text-foreground/90 leading-relaxed text-center">
                {reminderContent.preview}
              </p>
            </div>

            {/* AI Summary - very subtle */}
            {reminderContent.aiSummary && (
              <div className="pt-2 flex items-center justify-center gap-1.5">
                <Sparkles className="w-3 h-3 text-muted-foreground/40" strokeWidth={2} />
                <p className="text-[13px] text-muted-foreground/60 italic">
                  {reminderContent.aiSummary}
                </p>
              </div>
            )}

            {/* CTAs - Only 2 options */}
            <div className="flex gap-3 pt-2">
              <motion.button
                onClick={() => setShowDetail(true)}
                className="flex-1 bg-accent text-accent-foreground py-3 rounded-full text-sm font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Xem
              </motion.button>
              <motion.button
                onClick={handleDismiss}
                className="flex-1 bg-secondary/60 text-foreground/80 py-3 rounded-full text-sm font-medium"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Không cần nữa
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Insight - Occasionally, very light */}
        {showInsight && (
          <motion.div
            className="mt-8 max-w-sm w-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="relative">
              {/* Close button */}
              <button
                onClick={() => setShowInsight(false)}
                className="absolute -top-1 -right-1 p-1.5 hover:bg-secondary/60 rounded-full transition-colors"
              >
                <X className="w-3 h-3 text-muted-foreground/50" />
              </button>
              
              <div className="bg-accent/5 border border-accent/10 rounded-xl px-4 py-3">
                <p className="text-[13px] text-muted-foreground/70 leading-relaxed text-center">
                  Bạn đã lưu khá nhiều nội dung liên quan đến công việc trong thời gian gần đây.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showDetail && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 pb-safe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowDetail(false)}
          >
            <motion.div
              className="bg-card rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-xl"
              style={{ marginBottom: 'calc(64px + var(--safe-area-bottom))' }}
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border/40 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-accent" strokeWidth={2} />
                  <span className="text-sm font-medium text-foreground/90">
                    {reminderContent.type === 'note' && 'Ghi chú'}
                    {reminderContent.type === 'link' && 'Liên kết'}
                    {reminderContent.type === 'voice' && 'Ghi âm'}
                  </span>
                </div>
                <button
                  onClick={() => setShowDetail(false)}
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 overflow-auto max-h-[60vh]">
                <p className="text-base text-foreground/90 leading-relaxed mb-4 whitespace-pre-line">
                  {reminderContent.fullContent || reminderContent.preview}
                </p>
                
                {/* AI Summary in detail view - very subtle */}
                {reminderContent.aiSummary && (
                  <div className="mb-4 flex items-start gap-2 bg-accent/5 rounded-xl px-3 py-2.5">
                    <Sparkles className="w-3 h-3 text-muted-foreground/40 mt-0.5 flex-shrink-0" strokeWidth={2} />
                    <p className="text-[13px] text-muted-foreground/60 italic leading-relaxed">
                      {reminderContent.aiSummary}
                    </p>
                  </div>
                )}
                
                <div className="pt-4 border-t border-border/40">
                  <p className="text-xs text-muted-foreground/60 mb-2">Thời gian lưu:</p>
                  <p className="text-sm text-foreground/80">{reminderContent.savedDate}</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <Toast
        show={showToast}
        message="Đã ẩn nội dung này. Bạn có thể xem lại trong 'Đã bỏ'."
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}