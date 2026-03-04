import { motion, AnimatePresence } from 'motion/react';
import { X, RotateCcw, Trash2, Link2, PenLine, Mic, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Toast } from './Toast';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface DismissedItem {
  id: string;
  type: 'link' | 'text' | 'voice';
  content: string;
  fullContent?: string;
  date: string;
  dismissedDate: string;
  url?: string;
  audioUrl?: string;
  duration?: string;
}

interface DismissedScreenProps {
  onClose: () => void;
}

export function DismissedScreen({ onClose }: DismissedScreenProps) {
  const [selectedItem, setSelectedItem] = useState<DismissedItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Mock data - would come from backend
  const [dismissedItems, setDismissedItems] = useState<DismissedItem[]>([
    {
      id: '1',
      type: 'text',
      content: 'Ghi chú cũ về ý tưởng startup đã không còn phù hợp',
      fullContent: 'Ý tưởng về app tìm kiếm nhà hàng. Đã nghiên cứu và thấy thị trường quá cạnh tranh.',
      date: '2 tháng trước',
      dismissedDate: '3 ngày trước',
    },
    {
      id: '2',
      type: 'link',
      content: 'Article about crypto trading strategies',
      date: '3 tuần trước',
      dismissedDate: '1 tuần trước',
      url: 'https://example.com/crypto-trading',
    },
  ]);

  const handleRestore = (item: DismissedItem) => {
    setDismissedItems(dismissedItems.filter(i => i.id !== item.id));
    setSelectedItem(null);
    setToastMessage('Đã khôi phục nội dung.');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleDelete = (item: DismissedItem) => {
    setDismissedItems(dismissedItems.filter(i => i.id !== item.id));
    setSelectedItem(null);
    setShowDeleteConfirm(false);
    setToastMessage('Đã xoá vĩnh viễn.');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'link': return Link2;
      case 'voice': return Mic;
      default: return PenLine;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'link': return 'Liên kết';
      case 'voice': return 'Ghi âm';
      default: return 'Ghi chú';
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-background"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/40 pt-safe">
        <div className="px-5 py-4 flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-secondary/60 rounded-full transition-colors -ml-2"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-medium">Đã bỏ</h1>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              {dismissedItems.length} nội dung
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-5 py-4 smooth-scroll" style={{ paddingBottom: 'calc(96px + var(--safe-area-bottom))' }}>
        {dismissedItems.length === 0 ? (
          <div className="pt-20 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/40 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground/60 leading-relaxed">
              Chưa có nội dung nào được bỏ
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {dismissedItems.map((item, index) => {
              const Icon = getIcon(item.type);
              return (
                <motion.button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="w-full text-left bg-card rounded-2xl p-4 hover:bg-card/80 transition-colors"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-accent" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2 mb-2">
                        {item.content}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                        <span>Đã bỏ {item.dismissedDate}</span>
                        <span>•</span>
                        <span>Lưu {item.date}</span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 pb-safe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedItem(null)}
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
                  {(() => {
                    const Icon = getIcon(selectedItem.type);
                    return <Icon className="w-5 h-5 text-accent" strokeWidth={2} />;
                  })()}
                  <span className="text-sm font-medium text-foreground/90">
                    {getTypeLabel(selectedItem.type)}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 overflow-auto max-h-[50vh]">
                <p className="text-base text-foreground/90 leading-relaxed mb-4 whitespace-pre-line">
                  {selectedItem.fullContent || selectedItem.content}
                </p>
                
                <div className="pt-4 border-t border-border/40 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground/60 mb-1">Đã bỏ:</p>
                    <p className="text-sm text-foreground/80">{selectedItem.dismissedDate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground/60 mb-1">Thời gian lưu:</p>
                    <p className="text-sm text-foreground/80">{selectedItem.date}</p>
                  </div>
                </div>

                {selectedItem.url && (
                  <div className="pt-4 border-t border-border/40 mt-4">
                    <a
                      href={selectedItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary/40 text-foreground/90 rounded-xl hover:bg-secondary/60 transition-colors text-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Mở link
                    </a>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border/40 px-6 py-4 flex gap-3">
                <motion.button
                  onClick={() => handleRestore(selectedItem)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent text-accent-foreground rounded-xl font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Khôi phục
                </motion.button>
                <motion.button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-3 bg-destructive/10 text-destructive rounded-xl font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <DeleteConfirmDialog
        show={showDeleteConfirm}
        onConfirm={() => selectedItem && handleDelete(selectedItem)}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Toast */}
      <Toast
        show={showToast}
        message={toastMessage}
        onClose={() => setShowToast(false)}
      />
    </motion.div>
  );
}