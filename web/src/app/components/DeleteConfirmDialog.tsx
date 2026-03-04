import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle } from 'lucide-react';

interface DeleteConfirmDialogProps {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ show, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className="bg-card rounded-3xl max-w-sm w-full overflow-hidden shadow-xl"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Icon */}
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>

              {/* Title */}
              <h3 className="text-lg font-medium text-foreground/95 mb-2">
                Xoá nội dung này khỏi kho?
              </h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground/80 leading-relaxed mb-6">
                Thao tác này không thể hoàn tác.
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <motion.button
                  onClick={onCancel}
                  className="flex-1 bg-secondary/60 text-foreground/90 py-3 rounded-xl text-sm font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Huỷ
                </motion.button>
                <motion.button
                  onClick={onConfirm}
                  className="flex-1 bg-destructive text-destructive-foreground py-3 rounded-xl text-sm font-medium"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Xoá
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
