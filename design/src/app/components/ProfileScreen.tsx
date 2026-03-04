import { Sparkles, ChevronRight, Info, Archive, X, Mail, Lock, LogOut, Trash2, Download, Shield, ExternalLink, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Switch } from './ui/switch';
import { useState } from 'react';
import { DismissedScreen } from './DismissedScreen';

export function ProfileScreen() {
  const [allowRecall, setAllowRecall] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);
  const [activeModal, setActiveModal] = useState<'account' | 'privacy' | 'about' | null>(null);

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      {/* Simple Header */}
      <div className="pt-safe px-5 py-6 flex-shrink-0">
        <motion.h1
          className="text-2xl font-medium mb-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Cá nhân
        </motion.h1>
        <motion.p
          className="text-sm text-muted-foreground/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Quản lý cài đặt của bạn
        </motion.p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto smooth-scroll" style={{ paddingBottom: 'calc(96px + var(--safe-area-bottom))' }}>
        {/* Main Setting - The ONE Toggle */}
        <div className="px-5 mb-6">
          <motion.div
            className="bg-card rounded-[20px] border border-border/60 overflow-hidden shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="p-5">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Sparkles className="w-6 h-6 text-accent" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium mb-1">
                    Cho phép mình nhắc lại khi phù hợp
                  </h3>
                  <p className="text-sm text-muted-foreground/70 leading-relaxed">
                    Mình sẽ chỉ xuất hiện khi thực sự có lý do
                  </p>
                </div>
                <Switch
                  checked={allowRecall}
                  onCheckedChange={setAllowRecall}
                />
              </div>

              {/* Info box */}
              {allowRecall && (
                <motion.div
                  className="bg-accent/5 rounded-2xl p-4 flex gap-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <Info className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" strokeWidth={2} />
                  <p className="text-xs text-muted-foreground/80 leading-relaxed">
                    Mình sẽ phân tích những gì bạn lưu và chỉ gợi ý lại khi có sự kiện liên quan 
                    (ví dụ: bạn lưu nhiều thứ cùng chủ đề, hoặc bạn hỏi về điều từng lưu).
                  </p>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Secondary Options */}
        <div className="px-5">
          <motion.div
            className="bg-card rounded-[20px] border border-border/60 overflow-hidden shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <motion.button
              className="w-full p-5 flex items-center justify-between gap-4 text-left group border-b border-border/40 last:border-0"
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveModal('account')}
            >
              <div className="flex-1">
                <p className="text-[15px] text-foreground font-medium mb-0.5">
                  Tài khoản
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Email, mật khẩu, xóa tài khoản
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </motion.button>

            <motion.button
              className="w-full p-5 flex items-center justify-between gap-4 text-left group border-b border-border/40 last:border-0"
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveModal('privacy')}
            >
              <div className="flex-1">
                <p className="text-[15px] text-foreground font-medium mb-0.5">
                  Quyền riêng tư
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Dữ liệu của bạn luôn được bảo mật
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </motion.button>

            <motion.button
              className="w-full p-5 flex items-center justify-between gap-4 text-left group"
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveModal('about')}
            >
              <div className="flex-1">
                <p className="text-[15px] text-foreground font-medium mb-0.5">
                  Về ứng dụng
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Phiên bản, điều khoản, liên hệ
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          </motion.div>
        </div>

        {/* Hidden "Đã bỏ" button - Subtle, deep placement */}
        <div className="px-5 mt-6">
          <motion.button
            className="w-full p-4 flex items-center justify-center gap-2 text-left group bg-secondary/20 rounded-2xl border border-border/30 hover:bg-secondary/30 transition-colors"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowDismissed(true)}
          >
            <Archive className="w-4 h-4 text-muted-foreground/50" />
            <span className="text-sm text-muted-foreground/70">
              Đã bỏ
            </span>
          </motion.button>
        </div>

        {/* Bottom message - INSIDE scroll area */}
        <motion.div
          className="px-5 pt-12 pb-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          <motion.p
            className="text-sm text-muted-foreground/60 leading-relaxed"
            animate={{
              y: [0, -3, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            Mình ở đây để giúp bạn<br />
            không quên những điều quan trọng
          </motion.p>
        </motion.div>
      </div>

      {/* Dismissed Screen */}
      <AnimatePresence>
        {showDismissed && (
          <DismissedScreen
            onClose={() => setShowDismissed(false)}
          />
        )}
      </AnimatePresence>

      {/* Account Modal */}
      <AnimatePresence>
        {activeModal === 'account' && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              className="bg-card w-full rounded-t-3xl max-h-[85vh] overflow-hidden"
              style={{ boxShadow: 'var(--shadow-modal)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border/40 px-5 py-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">Tài khoản</h2>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(85vh-64px)] pb-safe">
                {/* Email Section */}
                <div className="p-5 border-b border-border/40">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Email</p>
                      <p className="text-base font-medium">user@example.com</p>
                    </div>
                  </div>
                  <button className="w-full bg-secondary/40 text-foreground py-3 rounded-full text-sm font-medium">
                    Thay đổi email
                  </button>
                </div>

                {/* Password Section */}
                <div className="p-5 border-b border-border/40">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center flex-shrink-0">
                      <Lock className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground mb-1">Mật khẩu</p>
                      <p className="text-base font-medium">••••••••</p>
                    </div>
                  </div>
                  <button className="w-full bg-secondary/40 text-foreground py-3 rounded-full text-sm font-medium">
                    Đổi mật khẩu
                  </button>
                </div>

                {/* Sign Out */}
                <div className="p-5 border-b border-border/40">
                  <button className="w-full flex items-center justify-center gap-2 bg-accent/10 text-accent py-3 rounded-full text-sm font-medium">
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>

                {/* Delete Account - Danger Zone */}
                <div className="p-5">
                  <div className="bg-error-bg rounded-2xl p-4 mb-4">
                    <p className="text-sm text-error-foreground/80 leading-relaxed">
                      ⚠️ Xóa tài khoản sẽ xóa vĩnh viễn toàn bộ dữ liệu của bạn. 
                      Hành động này không thể hoàn tác.
                    </p>
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 bg-error/10 text-error py-3 rounded-full text-sm font-medium">
                    <Trash2 className="w-4 h-4" />
                    Xóa tài khoản vĩnh viễn
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Modal */}
      <AnimatePresence>
        {activeModal === 'privacy' && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              className="bg-card w-full rounded-t-3xl max-h-[85vh] overflow-hidden"
              style={{ boxShadow: 'var(--shadow-modal)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border/40 px-5 py-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">Quyền riêng tư</h2>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(85vh-64px)] pb-safe">
                {/* How we protect data */}
                <div className="p-5 border-b border-border/40">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-medium mb-2">
                        Dữ liệu của bạn được bảo vệ
                      </h3>
                      <p className="text-sm text-muted-foreground/80 leading-relaxed">
                        Tất cả nội dung bạn lưu được mã hóa end-to-end. 
                        Chỉ bạn mới có thể truy cập được dữ liệu của mình.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Where data is stored */}
                <div className="p-5 border-b border-border/40">
                  <h3 className="text-sm font-medium mb-3">Lưu trữ dữ liệu</h3>
                  <div className="bg-accent-subtle rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        Dữ liệu được lưu trữ an toàn trên cloud servers với mã hóa AES-256
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        AI chỉ xử lý dữ liệu khi cần thiết và không lưu trữ lịch sử phân tích
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        Bạn có thể export hoặc xóa toàn bộ dữ liệu bất cứ lúc nào
                      </p>
                    </div>
                  </div>
                </div>

                {/* Export data */}
                <div className="p-5 border-b border-border/40">
                  <button className="w-full flex items-center justify-center gap-2 bg-accent/10 text-accent py-3 rounded-full text-sm font-medium">
                    <Download className="w-4 h-4" />
                    Tải xuống dữ liệu của bạn
                  </button>
                </div>

                {/* Privacy Policy */}
                <div className="p-5 border-b border-border/40">
                  <button className="w-full flex items-center justify-between gap-2 bg-secondary/40 text-foreground py-3 px-4 rounded-full text-sm font-medium">
                    <span>Chính sách bảo mật</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Delete all data - Danger Zone */}
                <div className="p-5">
                  <div className="bg-error-bg rounded-2xl p-4 mb-4">
                    <p className="text-sm text-error-foreground/80 leading-relaxed">
                      ⚠️ Xóa toàn bộ dữ liệu sẽ xóa vĩnh viễn mọi nội dung bạn đã lưu. 
                      Tài khoản vẫn được giữ lại.
                    </p>
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 bg-error/10 text-error py-3 rounded-full text-sm font-medium">
                    <Trash2 className="w-4 h-4" />
                    Xóa toàn bộ dữ liệu
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Modal */}
      <AnimatePresence>
        {activeModal === 'about' && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              className="bg-card w-full rounded-t-3xl max-h-[85vh] overflow-hidden"
              style={{ boxShadow: 'var(--shadow-modal)' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card/95 backdrop-blur-xl border-b border-border/40 px-5 py-4 flex items-center justify-between">
                <h2 className="text-lg font-medium">Về ứng dụng</h2>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto max-h-[calc(85vh-64px)] pb-safe">
                {/* App Info */}
                <div className="p-5 border-b border-border/40 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-10 h-10 text-accent" strokeWidth={2} />
                  </div>
                  <h3 className="text-xl font-medium mb-2">AI Living Memory</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Phiên bản 1.0.0
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed max-w-sm mx-auto">
                    AI companion giúp bạn lưu trữ và kết nối những gì quan trọng, 
                    theo philosophy "Lưu là trung tâm. Quên là bình thường."
                  </p>
                </div>

                {/* Philosophy */}
                <div className="p-5 border-b border-border/40">
                  <h3 className="text-sm font-medium mb-3">Triết lý</h3>
                  <div className="bg-accent-subtle rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        <span className="font-medium">Lưu là trung tâm.</span> Bất cứ điều gì bạn thấy quan trọng.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        <span className="font-medium">Quên là bình thường.</span> Mình sẽ nhớ giúp bạn.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent mt-2 flex-shrink-0" />
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        <span className="font-medium">Insight xuất hiện khi có lý do.</span> Không ép buộc.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Legal Links */}
                <div className="p-5 border-b border-border/40 space-y-3">
                  <button className="w-full flex items-center justify-between gap-2 bg-secondary/40 text-foreground py-3 px-4 rounded-full text-sm font-medium">
                    <span>Điều khoản sử dụng</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button className="w-full flex items-center justify-between gap-2 bg-secondary/40 text-foreground py-3 px-4 rounded-full text-sm font-medium">
                    <span>Chính sách riêng tư</span>
                    <ExternalLink className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Contact Support */}
                <div className="p-5 border-b border-border/40">
                  <button className="w-full flex items-center justify-center gap-2 bg-accent/10 text-accent py-3 rounded-full text-sm font-medium">
                    <MessageCircle className="w-4 h-4" />
                    Liên hệ hỗ trợ
                  </button>
                </div>

                {/* Credits */}
                <div className="p-5 text-center">
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    Được xây dựng với ❤️<br />
                    © 2025 AI Living Memory
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}