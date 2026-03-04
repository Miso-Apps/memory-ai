import { Link2, PenLine, Mic, Search, X, ExternalLink, Loader2, Play, Pause, MoreVertical, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef } from 'react';
import { Toast } from './Toast';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface Memory {
  id: string;
  type: 'link' | 'text' | 'voice';
  content: string;
  fullContent?: string;
  date: string;
  url?: string;
  audioUrl?: string;
  duration?: string;
  aiSummary?: string; // AI-generated summary for quick recall
}

interface MemoryItemProps {
  type: 'link' | 'text' | 'voice';
  content: string;
  date: string;
  onClick: () => void;
  index: number;
}

function MemoryItem({ type, content, date, onClick, index }: MemoryItemProps) {
  const iconMap = {
    link: Link2,
    text: PenLine,
    voice: Mic,
  };

  const Icon = iconMap[type];

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left bg-card rounded-2xl p-4 transition-all active:scale-[0.98]"
      style={{ boxShadow: 'var(--shadow-card)' }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay: index * 0.02,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent-subtle flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-accent" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] text-foreground/90 leading-relaxed line-clamp-2 mb-1.5 font-medium">
            {content}
          </p>
          <p className="text-xs text-muted-foreground">{date}</p>
        </div>
      </div>
    </motion.button>
  );
}

export function ThoughtStream() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'text' | 'link' | 'voice'>('text');
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');
  const [isWebViewLoading, setIsWebViewLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const mockPlaybackInterval = useRef<number | null>(null);

  const handleDismiss = () => {
    setShowMenu(false);
    setSelectedMemory(null);
    setToastMessage("Đã ẩn nội dung này. Bạn có thể xem lại trong 'Đã bỏ'.");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 4000);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(false);
    setShowMenu(false);
    setSelectedMemory(null);
    setToastMessage("Đã xoá nội dung khỏi kho.");
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleTabChange = (tab: 'text' | 'link' | 'voice') => {
    setActiveTab(tab);
    // Reset scroll to top when switching tabs
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  const memories: Memory[] = [
    {
      id: '1',
      type: 'text' as const,
      content: 'Suy nghĩ về việc chuyển đổi công việc. Cân nhắc giữa đam mê và ổn định tài chính.',
      fullContent: 'Mình đang nghĩ đến việc nghỉ công việc hiện tại để theo đuổi dự án riêng. Nhưng lại lo về tài chính và áp lực từ gia đình. Có lẽ mình cần thời gian để chuẩn bị kỹ hơn trước khi quyết định.',
      date: 'Hôm nay, 14:30',
    },
    {
      id: '2',
      type: 'link' as const,
      content: 'How to find balance between your passion and financial security',
      date: 'Hôm qua, 09:15',
      url: 'https://example.com/balance-passion-finance',
      aiSummary: 'Bài viết phân tích sự cân bằng giữa đam mê và tài chính, đề xuất 5 bước transition an toàn từ công việc ổn định sang theo đuổi passion.',
    },
    {
      id: '3',
      type: 'voice' as const,
      content: 'Ý tưởng về dự án phụ liên quan đến community building và kết nối những người có cùng sở thích',
      fullContent: 'Recording: Ý tưởng về việc xây dựng một community platform nơi mọi người có thể chia sẻ passion và kết nối với những người có cùng sở thích. Có thể bắt đầu với một group nhỏ trước.',
      date: '2 ngày trước, 21:45',
      audioUrl: 'demo',
      duration: '2:34',
      aiSummary: 'Ghi âm nói về việc xây dựng platform kết nối cộng đồng, bắt đầu từ nhỏ với meetup định kỳ cho người có cùng sở thích.',
    },
    {
      id: '4',
      type: 'text' as const,
      content: 'Nhận ra rằng mình đã thay đổi nhiều trong 6 tháng qua. Cần review lại mục tiêu dài hạn.',
      date: '3 ngày trước, 16:20',
    },
    {
      id: '5',
      type: 'link' as const,
      content: 'The Psychology of Personal Growth and Self-Reflection',
      date: '1 tuần trước',
      url: 'https://example.com/personal-growth-reflection',
    },
    {
      id: '6',
      type: 'text' as const,
      content: 'Ghi chú về cuộc nói chuyện với mentor. Học được nhiều về cách quản lý thời gian.',
      date: '1 tuần trước',
    },
    {
      id: '7',
      type: 'link' as const,
      content: 'Building side projects while working full-time',
      date: '2 tuần trước',
      url: 'https://example.com/side-projects-full-time',
    },
    {
      id: '8',
      type: 'voice' as const,
      content: 'Băn khoăn về việc nên chọn công việc ổn định hay theo đuổi dự án riêng',
      fullContent: 'Recording: Nên tiếp tục công việc ổn định để tích lũy kinh nghiệm và tài chính, hay nên mạo hiểm theo đuổi dự án riêng ngay bây giờ? Đây là câu hỏi khó.',
      date: '1 tháng trước',
      audioUrl: 'demo',
      duration: '3:15',
      aiSummary: 'Ghi âm băn khoăn về lựa chọn giữa công việc ổn định và dự án riêng, cân nhắc yếu tố tài chính và kinh nghiệm.',
    },
  ];

  const handleClick = (memory: Memory) => {
    setSelectedMemory(memory);
  };

  // Filter by active tab AND search query
  const activeMemories = memories
    .filter((m) => m.type === activeTab)
    .filter((m) => 
      searchQuery.trim() 
        ? m.content.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    );

  const typeConfig = [
    { key: 'text' as const, label: 'Ghi chú', icon: PenLine },
    { key: 'link' as const, label: 'Liên kết', icon: Link2 },
    { key: 'voice' as const, label: 'Ghi âm', icon: Mic },
  ];

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/40 pt-safe">
        <div className="px-5 py-4 pb-0">
          <motion.h1
            className="text-2xl font-medium mb-1"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Kho
          </motion.h1>
          <motion.p
            className="text-sm text-muted-foreground/70 leading-relaxed mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Toàn bộ những gì bạn đã lưu
          </motion.p>

          {/* Search bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm từ khóa..."
              className="w-full bg-secondary/40 rounded-full pl-11 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>
        </div>

        {/* Horizontal Tabs */}
        <div className="px-5 pb-3 overflow-x-auto hide-scrollbar">
          <div className="flex gap-2">
            {typeConfig.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              
              return (
                <motion.button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all
                    ${isActive 
                      ? 'bg-accent text-accent-foreground shadow-sm' 
                      : 'bg-secondary/30 text-foreground/70 hover:bg-secondary/50'
                    }
                  `}
                  whileTap={{ scale: 0.96 }}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                  <span className="text-sm font-medium">{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Memory List - Active Tab Only */}
      <div className="flex-1 overflow-auto px-5 py-4 smooth-scroll" style={{ paddingBottom: 'calc(96px + var(--safe-area-bottom))' }} ref={scrollContainerRef}>
        {activeMemories.length === 0 ? (
          <div className="pt-12 text-center">
            <p className="text-sm text-muted-foreground/50">
              {searchQuery.trim() ? 'Không tìm thấy kết quả' : 'Chưa có nội dung nào'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeMemories.map((memory, index) => (
              <MemoryItem
                key={memory.id}
                type={memory.type}
                content={memory.content}
                date={memory.date}
                onClick={() => handleClick(memory)}
                index={index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Memory Detail Modal */}
      <AnimatePresence>
        {selectedMemory && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 pb-safe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedMemory(null)}
          >
            <motion.div
              className="bg-card rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden shadow-xl mb-0 sm:mb-4"
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
                  {selectedMemory.type === 'text' && <PenLine className="w-5 h-5 text-accent" strokeWidth={2} />}
                  {selectedMemory.type === 'link' && <Link2 className="w-5 h-5 text-accent" strokeWidth={2} />}
                  {selectedMemory.type === 'voice' && <Mic className="w-5 h-5 text-accent" strokeWidth={2} />}
                  <span className="text-sm font-medium text-foreground/90">
                    {selectedMemory.type === 'text' && 'Ghi chú'}
                    {selectedMemory.type === 'link' && 'Liên kết'}
                    {selectedMemory.type === 'voice' && 'Ghi âm'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedMemory(null)}
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="px-6 py-6 overflow-auto max-h-[60vh]">
                <p className="text-base text-foreground/90 leading-relaxed mb-4 whitespace-pre-line">
                  {selectedMemory.fullContent || selectedMemory.content}
                </p>

                {/* AI Summary - Only for link and voice types, with low visual hierarchy */}
                {selectedMemory.aiSummary && (selectedMemory.type === 'link' || selectedMemory.type === 'voice') && (
                  <div className="mb-4 pb-4 border-b border-border/20">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-3 h-3 text-muted-foreground/40 flex-shrink-0 mt-0.5" strokeWidth={2} />
                      <p className="text-[13px] text-muted-foreground/60 leading-relaxed italic">
                        {selectedMemory.aiSummary}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t border-border/40">
                  <p className="text-xs text-muted-foreground/60 mb-2">Thời gian lưu:</p>
                  <p className="text-sm text-foreground/80">{selectedMemory.date}</p>
                </div>

                {/* Audio Player for voice recordings */}
                {selectedMemory.type === 'voice' && selectedMemory.audioUrl && (
                  <div className="pt-4 border-t border-border/40 mt-4 pb-2">
                    <p className="text-xs text-muted-foreground/60 mb-3">Ghi âm:</p>
                    
                    <div className="bg-accent/5 rounded-2xl p-4 space-y-3">
                      {/* Play/Pause Button + Progress */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            if (selectedMemory.audioUrl === 'demo') {
                              // Mock playback for demo
                              if (isPlaying) {
                                if (mockPlaybackInterval.current) {
                                  clearInterval(mockPlaybackInterval.current);
                                  mockPlaybackInterval.current = null;
                                }
                                setIsPlaying(false);
                              } else {
                                setIsPlaying(true);
                                // Simulate progress for 2:34 = 154 seconds
                                const totalSeconds = selectedMemory.duration === '2:34' ? 154 : 195;
                                mockPlaybackInterval.current = window.setInterval(() => {
                                  setAudioProgress((prev) => {
                                    const newProgress = prev + (100 / totalSeconds);
                                    if (newProgress >= 100) {
                                      if (mockPlaybackInterval.current) {
                                        clearInterval(mockPlaybackInterval.current);
                                        mockPlaybackInterval.current = null;
                                      }
                                      setIsPlaying(false);
                                      return 0;
                                    }
                                    return newProgress;
                                  });
                                }, 1000);
                              }
                            } else {
                              // Real audio playback
                              if (!audioRef.current) return;
                              if (isPlaying) {
                                audioRef.current.pause();
                                setIsPlaying(false);
                              } else {
                                audioRef.current.play();
                                setIsPlaying(true);
                              }
                            }
                          }}
                          className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center hover:bg-accent/90 transition-colors flex-shrink-0"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4" fill="currentColor" />
                          ) : (
                            <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                          )}
                        </button>

                        {/* Progress Bar */}
                        <div className="flex-1">
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={audioProgress}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              setAudioProgress(value);
                              if (selectedMemory.audioUrl !== 'demo' && audioRef.current) {
                                audioRef.current.currentTime = (value / 100) * audioRef.current.duration;
                              }
                            }}
                            className="w-full h-1.5 bg-secondary/60 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0"
                            style={{
                              background: `linear-gradient(to right, hsl(var(--accent)) 0%, hsl(var(--accent)) ${audioProgress}%, hsl(var(--secondary) / 0.6) ${audioProgress}%, hsl(var(--secondary) / 0.6) 100%)`
                            }}
                          />
                        </div>

                        {/* Duration */}
                        <span className="text-xs text-muted-foreground/70 font-mono flex-shrink-0 min-w-[48px] text-right">
                          {selectedMemory.duration || '0:00'}
                        </span>
                      </div>
                    </div>

                    {/* Hidden audio element - only render if real URL */}
                    {selectedMemory.audioUrl !== '#' && selectedMemory.audioUrl !== 'demo' && (
                      <audio
                        ref={audioRef}
                        src={selectedMemory.audioUrl}
                        onTimeUpdate={() => {
                          if (audioRef.current) {
                            const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
                            setAudioProgress(progress || 0);
                            setCurrentTime(audioRef.current.currentTime);
                          }
                        }}
                        onEnded={() => {
                          setIsPlaying(false);
                          setAudioProgress(0);
                        }}
                        onError={() => setAudioError(true)}
                      />
                    )}
                  </div>
                )}

                {selectedMemory.url && (
                  <div className="pt-4 border-t border-border/40 mt-4 space-y-3 pb-2">
                    <button
                      onClick={() => {
                        setWebViewUrl(selectedMemory.url!);
                        setShowWebView(true);
                        setIsWebViewLoading(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-accent-foreground rounded-full hover:bg-accent/90 transition-colors font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Xem nội dung
                    </button>
                    
                    <a
                      href={selectedMemory.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-xs text-muted-foreground/60 hover:text-accent transition-colors pb-1"
                    >
                      hoặc mở trong trình duyệt
                    </a>
                  </div>
                )}
              </div>

              {/* Menu - Better dropdown design */}
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>

                {showMenu && (
                  <>
                    {/* Backdrop to close menu */}
                    <div 
                      className="fixed inset-0 z-[-1]" 
                      onClick={() => setShowMenu(false)}
                    />
                    
                    {/* Menu dropdown */}
                    <motion.div
                      className="absolute top-12 right-0 bg-card border border-border/60 rounded-2xl shadow-xl overflow-hidden min-w-[180px] z-10"
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <button
                        onClick={handleDismiss}
                        className="w-full text-left px-4 py-3.5 hover:bg-secondary/40 transition-colors text-sm font-medium text-foreground/90 border-b border-border/30"
                      >
                        Không cần nữa
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full text-left px-4 py-3.5 hover:bg-destructive/10 transition-colors text-sm font-medium text-destructive"
                      >
                        Xoá khỏi kho
                      </button>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WebView Modal - Full screen in-app browser */}
      <AnimatePresence>
        {showWebView && webViewUrl && (
          <motion.div
            className="fixed inset-0 z-[60] bg-background"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* WebView Header */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/40 pt-safe">
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setShowWebView(false);
                    setWebViewUrl('');
                  }}
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-foreground" />
                </button>
                
                <div className="flex-1 min-w-0 px-3">
                  <p className="text-xs text-muted-foreground/70 truncate">
                    {webViewUrl}
                  </p>
                </div>

                <a
                  href={webViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                  title="Mở trong trình duyệt"
                >
                  <ExternalLink className="w-5 h-5 text-muted-foreground" />
                </a>
              </div>
            </div>

            {/* Loading state */}
            {isWebViewLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-accent animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Đang tải nội dung...</p>
                </div>
              </div>
            )}

            {/* iFrame WebView */}
            <iframe
              src={webViewUrl}
              className="w-full h-full border-0"
              title="Web Content"
              onLoad={() => setIsWebViewLoading(false)}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        show={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Toast */}
      <Toast
        show={showToast}
        message={toastMessage}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}