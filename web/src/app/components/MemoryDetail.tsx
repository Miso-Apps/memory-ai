import { useState } from 'react';
import { ChevronDown, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MemoryDetailProps {
  onBack: () => void;
}

export function MemoryDetail({ onBack }: MemoryDetailProps) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [currentThought, setCurrentThought] = useState('');

  return (
    <div className="flex-1 overflow-auto pb-24 bg-background">
      {/* Header */}
      <motion.div
        className="px-6 pt-16 pb-6 border-b border-border/30 bg-card/80 backdrop-blur-xl sticky top-0 z-10"
        style={{ boxShadow: 'var(--shadow-sm)' }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.button
          onClick={onBack}
          className="text-muted-foreground/70 mb-4 flex items-center gap-1"
          whileHover={{ x: -2 }}
          whileTap={{ scale: 0.95 }}
        >
          ← Quay lại
        </motion.button>
        <h2 className="leading-tight">Chi tiết ký ức</h2>
      </motion.div>

      <div className="px-6 py-8">
        {/* AI Summary */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-accent" strokeWidth={2.5} />
            </div>
            <p className="text-sm text-muted-foreground/70">Tóm tắt từ AI</p>
          </div>
          <motion.div
            className="relative bg-accent/10 border border-accent/20 rounded-3xl p-6 overflow-hidden shadow-sm hover:shadow-[0_4px_16px_rgba(180,167,214,0.15)] transition-shadow duration-200"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />
            <p className="relative leading-relaxed text-[15px]">
              Bạn đang cân nhắc việc chuyển đổi công việc sang lĩnh vực thiết kế. 
              Bạn cảm thấy hứng thú với UI/UX nhưng lo lắng về thu nhập và sự ổn định. 
              Điều này xuất hiện khi bạn đang trải qua giai đoạn mệt mỏi với công việc hiện tại.
            </p>
          </motion.div>
        </motion.div>

        {/* Original Content */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center gap-2 text-sm text-muted-foreground/70 mb-3 w-full"
            whileHover={{ x: 2 }}
          >
            <span>Nội dung gốc</span>
            <motion.div
              animate={{ rotate: showOriginal ? 180 : 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </motion.button>
          
          <AnimatePresence>
            {showOriginal && (
              <motion.div
                className="bg-muted/70 rounded-3xl p-6 shadow-sm border border-border/50"
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="text-sm text-muted-foreground/70 mb-3">3 tuần trước</p>
                <p className="leading-relaxed text-[15px]">
                  "Mình thấy công việc hiện tại không còn phù hợp nữa. 
                  Ngày nào cũng làm những việc lặp đi lặp lại, không có cảm giác phát triển. 
                  Gần đây mình quan tâm đến thiết kế nhiều hơn, mỗi lần xem app hay website đẹp là muốn học làm. 
                  Nhưng chuyển ngành giờ có muộn không nhỉ? 
                  Thu nhập có ổn định không?"
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Why You Saved This */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm text-muted-foreground/70 mb-3">Vì sao bạn lưu điều này</p>
          <div
            className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow duration-200"
          >
            <p className="leading-relaxed text-[15px]">
              Lúc đó bạn đang trong giai đoạn căng thẳng với công việc và 
              muốn ghi lại cảm xúc này để xem lại sau. Bạn cũng muốn nhắc 
              nhở bản thân về những suy nghĩ nghiêm túc về tương lai.
            </p>
          </div>
        </motion.div>

        {/* Current Reflection */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-sm text-muted-foreground/70 mb-3">Bạn nghĩ gì bây giờ?</p>
          <textarea
            value={currentThought}
            onChange={(e) => setCurrentThought(e.target.value)}
            placeholder="Có thể bây giờ bạn đã nghĩ khác..."
            rows={4}
            className="w-full bg-input-background rounded-3xl px-6 py-4 outline-none focus:ring-2 focus:ring-accent/30 resize-none transition-all border border-transparent focus:border-accent/20 shadow-sm text-[15px]"
          />
        </motion.div>

        {/* Actions */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <motion.button
            className="w-full bg-primary text-primary-foreground py-4 px-6 rounded-full flex items-center justify-center gap-2 font-medium shadow-md"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Check className="w-5 h-5" strokeWidth={2.5} />
            Điều này vẫn đúng
          </motion.button>
          
          <motion.button
            className="w-full bg-secondary text-secondary-foreground py-4 px-6 rounded-full font-medium"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Mình đã nghĩ khác
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}