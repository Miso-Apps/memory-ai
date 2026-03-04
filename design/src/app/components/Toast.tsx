import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  show: boolean;
  message: string;
  onClose: () => void;
}

export function Toast({ show, message, onClose }: ToastProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed bottom-24 left-4 right-4 z-50 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="bg-card border border-border/60 rounded-2xl shadow-lg max-w-sm w-full pointer-events-auto">
            <div className="flex items-start gap-3 p-4">
              <CheckCircle2 className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <p className="flex-1 text-sm text-foreground/90 leading-relaxed">
                {message}
              </p>
              <button
                onClick={onClose}
                className="p-1 hover:bg-secondary/60 rounded-full transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
