import { useState, useRef, useEffect } from 'react';
import { Sparkles, PenLine, Link2, Mic, Send, Search, Database, Loader2, ExternalLink, X, Play, Pause, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toast } from './Toast';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

interface Memory {
  id: string;
  type: 'note' | 'link' | 'voice';
  content: string;
  fullContent?: string; // Full content for detail view
  date: string;
  url?: string; // For links
  audioUrl?: string; // For voice recordings
  duration?: string; // Audio duration (e.g., "2:34")
}

type LoadingPhase = 'searching' | 'gathering' | 'analyzing' | 'complete';

export function ReflectionScreen() {
  const [thought, setThought] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('searching');
  const [typedText, setTypedText] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');
  const [isWebViewLoading, setIsWebViewLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const sourceRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  // Mock memories found
  const foundMemories: Memory[] = [
    {
      id: 'n1',
      type: 'note',
      content: 'Suy nghĩ về việc chuyển đổi công việc',
      fullContent: 'Mình đang nghĩ đến việc nghỉ công việc hiện tại để theo đuổi dự án riêng. Nhưng lại lo về tài chính và áp lực từ gia đình. Có lẽ mình cần thời gian để chuẩn bị kỹ hơn trước khi quyết định.',
      date: '3 tuần trước',
    },
    {
      id: 'l1',
      type: 'link',
      content: 'How to find balance between passion and financial security',
      fullContent: 'Article về cách cân bằng giữa đam mê và ổn định tài chính',
      date: '3 tuần trước',
      url: 'https://example.com/balance',
    },
    {
      id: 'n2',
      type: 'note',
      content: 'Nhận ra rằng mình đã thay đổi nhiều trong 6 tháng qua',
      fullContent: 'Nhìn lại 6 tháng vừa qua, mình thấy mình đã trưởng thành hơn rất nhiều. Những priority của mình cũng thay đổi - không còn chạy theo title hay lương cao nữa, mà giờ mình tìm kiếm ý nghĩa trong công việc.',
      date: '2 tuần trước',
    },
    {
      id: 'v1',
      type: 'voice',
      content: 'Băn khoăn về việc nên chọn công việc ổn định hay theo đuổi dự án riêng',
      fullContent: '[Ghi âm 2:34] Hôm nay mình lại suy nghĩ về chuyện này. Công việc hiện tại ổn định, lương tốt, nhưng mình cảm thấy như đang lãng phí thời gian. Có quá nhiều ý tưởng muốn thực hiện nhưng không có thời gian...',
      date: '1 tháng trước',
      audioUrl: '#', // Placeholder - would be real audio URL in production
      duration: '2:34',
    },
    {
      id: 'l2',
      type: 'link',
      content: 'Signs you should consider a career change',
      fullContent: 'Article liệt kê các dấu hiệu bạn nên đổi nghề',
      date: '1 tháng trước',
      url: 'https://example.com/career-change',
    },
    {
      id: '3',
      type: 'voice',
      content: 'Ý tưởng về dự án phụ liên quan đến community building',
      fullContent: 'Ý tưởng về dự án phụ liên quan đến community building và kết nối những người có cùng sở thích. Có thể bắt đầu với một group nhỏ, tổ chức meetup định kỳ.',
      date: '2 ngày trước',
      audioUrl: '#', // Placeholder - would be real audio URL in production
      duration: '2:30',
    },
  ];

  const fullAnalysis = `Trong những gì bạn từng lưu, chủ đề công việc xuất hiện nhiều lần, đặc biệt trong những giai đoạn bạn phân vân về hướng đi. 

Bạn có xu hướng quay lại những câu hỏi về đam mê khi cảm thấy cần thay đổi. Điều đáng chú ý là trong vòng 3 tháng qua, bạn đã lưu nhiều nội dung về chuyển đổi sự nghiệp, cho thấy đây là một suy nghĩ lặp đi lặp lại.

Pattern này cho thấy bạn đang trong giai đoạn transition, và câu hỏi về ý nghĩa công việc là mối quan tâm chính của bạn trong thời gian này.`;

  // Scroll to source and highlight
  const scrollToSource = (memoryId: string) => {
    const element = sourceRefs.current[memoryId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Enhanced flash highlight effect with scale
      element.classList.add('!bg-accent/30', '!border-accent/60', 'scale-[1.02]');
      setTimeout(() => {
        element.classList.remove('!bg-accent/30', '!border-accent/60', 'scale-[1.02]');
      }, 2000);
    }
  };

  // Perplexity-style: Map highlighted phrases to memory IDs
  const phraseToMemory: { [phrase: string]: string } = {
    'chủ đề công việc': 'n1',
    'đam mê': 'l1',
    'chuyển đổi sự nghiệp': 'l2',
    'giai đoạn transition': 'v1',
    'ý nghĩa công việc': 'n2',
  };

  // Render text with highlighted clickable phrases (Perplexity style)
  const renderTextWithHighlights = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let processedText = text;
    const foundPhrases: Array<{ phrase: string; memoryId: string; startIndex: number }> = [];

    // Find all phrase occurrences with their positions
    const sortedPhrases = Object.keys(phraseToMemory).sort((a, b) => b.length - a.length);
    
    sortedPhrases.forEach(phrase => {
      const memoryId = phraseToMemory[phrase];
      const lowerText = text.toLowerCase();
      const lowerPhrase = phrase.toLowerCase();
      const index = lowerText.indexOf(lowerPhrase);
      
      if (index !== -1 && index + phrase.length <= text.length) {
        foundPhrases.push({ phrase, memoryId, startIndex: index });
      }
    });

    // Sort by start index to process in order
    foundPhrases.sort((a, b) => a.startIndex - b.startIndex);

    // Build the parts array
    let lastIndex = 0;
    let keyCounter = 0;

    foundPhrases.forEach(({ phrase, memoryId, startIndex }) => {
      // Add text before this phrase
      if (startIndex > lastIndex) {
        parts.push(text.substring(lastIndex, startIndex));
      }

      // Add highlighted phrase
      const actualPhrase = text.substring(startIndex, startIndex + phrase.length);
      parts.push(
        <span
          key={`highlight-${keyCounter++}`}
          onClick={() => scrollToSource(memoryId)}
          className="text-accent underline decoration-dotted decoration-1 underline-offset-2 cursor-pointer hover:bg-accent/10 hover:decoration-solid transition-all rounded-sm px-0.5 -mx-0.5"
        >
          {actualPhrase}
        </span>
      );

      lastIndex = startIndex + phrase.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Agentic loading simulation
  useEffect(() => {
    if (!isSearching) return;

    const phases: LoadingPhase[] = ['searching', 'gathering', 'analyzing', 'complete'];
    let currentPhaseIndex = 0;

    const phaseInterval = setInterval(() => {
      currentPhaseIndex++;
      if (currentPhaseIndex < phases.length) {
        setLoadingPhase(phases[currentPhaseIndex]);
      } else {
        clearInterval(phaseInterval);
        // Start typing effect
        startTypingEffect();
      }
    }, 800); // Each phase lasts 0.8s (OPTIMIZED: was 1200ms)

    return () => clearInterval(phaseInterval);
  }, [isSearching]);

  // Typing effect for AI response - OPTIMIZED for faster typing
  const startTypingEffect = () => {
    let index = 0;
    const typingInterval = setInterval(() => {
      if (index < fullAnalysis.length) {
        setTypedText(fullAnalysis.slice(0, index + 1));
        index++;
      } else {
        clearInterval(typingInterval);
        setShowResults(true);
      }
    }, 8); // 8ms per character for fast, smooth typing (OPTIMIZED: was 15ms)

    return () => clearInterval(typingInterval);
  };

  const handleReflect = () => {
    if (!thought.trim()) return;
    setIsSearching(true);
    setLoadingPhase('searching');
    setTypedText('');
    setShowResults(false);
  };

  const handleReset = () => {
    setIsSearching(false);
    setThought('');
    setTypedText('');
    setShowResults(false);
    setLoadingPhase('searching');
    setSelectedMemory(null);
  };

  // Map citation numbers to memories
  const getCitationText = (index: number) => {
    const memory = foundMemories[index];
    if (!memory) return '';
    return memory.content;
  };

  // Parse text with citations and render as components
  const renderTextWithCitations = (text: string) => {
    const citationRegex = /\[(\d+)\]/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      // Add text before citation
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Add citation badge
      const citationNumber = parseInt(match[1]);
      parts.push(
        <sup
          key={`cite-${match.index}`}
          className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-md bg-accent/20 text-accent text-[10px] font-semibold mx-0.5 cursor-default hover:bg-accent/30 transition-colors"
          title={getCitationText(citationNumber - 1)}
        >
          {citationNumber}
        </sup>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts;
  };

  // EMPTY STATE
  if (!isSearching && !showResults && typedText === '') {
    return (
      <div className="flex-1 flex flex-col bg-background">
        {/* Header */}
        <div className="pt-safe px-5 py-6 border-b border-border/40">
          <motion.h1
            className="text-2xl font-medium mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Suy ngẫm
          </motion.h1>
          <motion.p
            className="text-sm text-muted-foreground/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Hiểu lại chính mình qua những gì bạn đã lưu
          </motion.p>
        </div>

        {/* Empty state - Large input */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          <motion.div
            className="w-24 h-24 rounded-full bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center mb-8 shadow-sm"
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Sparkles className="w-11 h-11 text-accent/60" strokeWidth={2} />
          </motion.div>

          <motion.p
            className="text-center text-foreground/90 text-lg leading-relaxed max-w-sm mb-12"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Gõ điều bạn đang nghĩ,<br />
            mình sẽ gợi lại những gì bạn đã lưu
          </motion.p>

          {/* Input area */}
          <div className="w-full max-w-sm">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={thought}
                onChange={(e) => setThought(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleReflect();
                  }
                }}
                placeholder="Ví dụ: công việc, dự án phụ, học tập…"
                className="w-full bg-card border border-border/60 rounded-3xl px-5 py-4 pr-14 text-base outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all shadow-sm resize-none min-h-[120px]"
                autoFocus
              />
              <motion.button
                onClick={handleReflect}
                disabled={!thought.trim()}
                className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-accent disabled:bg-secondary/60 flex items-center justify-center transition-colors"
                whileTap={{ scale: 0.9 }}
              >
                <Send className="w-4 h-4 text-accent-foreground" strokeWidth={2} />
              </motion.button>
            </div>

            {/* Example prompts */}
            <motion.div
              className="mt-6 space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <p className="text-xs text-muted-foreground/60 mb-3">Ví dụ:</p>
              {[
                'Mình đã từng lưu những gì về công việc?',
                'Có link hoặc ghi chú nào mình từng lưu về dự án phụ không?',
                'Gần đây mình hay lưu về chủ đề gì?',
              ].map((example, i) => (
                <motion.button
                  key={example}
                  onClick={() => setThought(example)}
                  className="block w-full text-left px-4 py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-colors text-sm text-muted-foreground"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {example}
                </motion.button>
              ))}
              
              {/* Meta cue - subtle hint */}
              <motion.p
                className="text-[11px] text-muted-foreground/40 pt-3 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
              >
                Bạn cũng có thể hỏi: mình hay lưu về chủ đề gì?
              </motion.p>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // RESULTS STATE - Agentic AI style
  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      {/* Header with query */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/40 pt-safe flex-shrink-0">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground/70 mb-1.5">Câu hỏi của bạn:</p>
              <p className="text-base text-foreground/90 font-medium leading-relaxed">"{thought}"</p>
            </div>
            <button
              onClick={handleReset}
              className="p-2 hover:bg-secondary/60 rounded-full transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable content - FIX: Add proper overflow and height */}
      <div className="flex-1 overflow-y-auto px-5 py-6 smooth-scroll" style={{ paddingBottom: 'calc(96px + var(--safe-area-bottom))' }}>
        {/* Agentic Loading States */}
        {loadingPhase !== 'complete' && (
          <motion.div
            className="space-y-3 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Search phase */}
            <motion.div
              className="flex items-center gap-2.5 text-sm"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: loadingPhase === 'searching' ? 1 : 0.4, x: 0 }}
            >
              {loadingPhase === 'searching' ? (
                <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5 text-accent" />
              )}
              <span className={loadingPhase === 'searching' ? 'text-foreground/90' : 'text-muted-foreground/60'}>
                Đang tìm kiếm trong ký ức của bạn...
              </span>
            </motion.div>

            {/* Gathering phase */}
            {(loadingPhase === 'gathering' || loadingPhase === 'analyzing' || loadingPhase === 'complete') && (
              <motion.div
                className="flex items-center gap-2.5 text-sm"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: loadingPhase === 'gathering' ? 1 : 0.4, x: 0 }}
              >
                {loadingPhase === 'gathering' ? (
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                ) : (
                  <Database className="w-3.5 h-3.5 text-accent" />
                )}
                <span className={loadingPhase === 'gathering' ? 'text-foreground/90' : 'text-muted-foreground/60'}>
                  Đang tổng hợp {foundMemories.length} mục liên quan...
                </span>
              </motion.div>
            )}

            {/* Analyzing phase */}
            {(loadingPhase === 'analyzing' || loadingPhase === 'complete') && (
              <motion.div
                className="flex items-center gap-2.5 text-sm"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: loadingPhase === 'analyzing' ? 1 : 0.4, x: 0 }}
              >
                {loadingPhase === 'analyzing' ? (
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                )}
                <span className={loadingPhase === 'analyzing' ? 'text-foreground/90' : 'text-muted-foreground/60'}>
                  Đang phân tích và kết nối các mảnh...
                </span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* AI Response with typing effect */}
        {typedText && (
          <motion.div
            className="bg-accent/5 border border-accent/15 rounded-2xl p-4 mb-5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-accent" strokeWidth={2} />
              <span className="text-xs font-medium text-accent">Phân tích</span>
            </div>
            
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                {renderTextWithHighlights(typedText)}
                {loadingPhase !== 'complete' && !showResults && (
                  <motion.span
                    className="inline-block w-1 h-4 bg-accent ml-1"
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
              </p>
            </div>
          </motion.div>
        )}

        {/* Sources - Full-width List Style (like Archive tab) */}
        {showResults && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} />
              <span className="text-xs font-medium text-muted-foreground">Nguồn ({foundMemories.length})</span>
            </div>

            <div className="space-y-2">
              {foundMemories.map((memory, index) => {
                const icons = {
                  note: PenLine,
                  link: Link2,
                  voice: Mic,
                };
                const Icon = icons[memory.type];

                return (
                  <motion.button
                    key={memory.id}
                    ref={(el) => (sourceRefs.current[memory.id] = el)}
                    onClick={() => setSelectedMemory(memory)}
                    className="group w-full bg-card border border-border/60 rounded-2xl p-4 hover:border-accent/40 hover:bg-accent/5 transition-all duration-500 text-left"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.03 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Citation Number + Icon */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-6 h-6 rounded-lg bg-accent/15 flex items-center justify-center">
                          <span className="text-[11px] font-semibold text-accent">{index + 1}</span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                          <Icon className="w-4 h-4 text-accent" strokeWidth={2} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm text-foreground/90 leading-relaxed line-clamp-2">
                          {memory.content}
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground/60">{memory.date}</p>
                          {memory.type === 'voice' && memory.duration && (
                            <>
                              <span className="text-muted-foreground/40">•</span>
                              <p className="text-xs text-muted-foreground/60 font-mono">{memory.duration}</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Arrow/External Link indicator */}
                      {memory.type === 'link' && (
                        <ExternalLink className="w-4 h-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
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
                  {selectedMemory.type === 'note' && <PenLine className="w-5 h-5 text-accent" strokeWidth={2} />}
                  {selectedMemory.type === 'link' && <Link2 className="w-5 h-5 text-accent" strokeWidth={2} />}
                  {selectedMemory.type === 'voice' && <Mic className="w-5 h-5 text-accent" strokeWidth={2} />}
                  <span className="text-sm font-medium text-foreground/90">
                    {selectedMemory.type === 'note' && 'Ghi chú'}
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
                            if (!audioRef.current || selectedMemory.audioUrl === '#') return;
                            if (isPlaying) {
                              audioRef.current.pause();
                              setIsPlaying(false);
                            } else {
                              audioRef.current.play();
                              setIsPlaying(true);
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
                              if (selectedMemory.audioUrl === '#') return;
                              const value = parseFloat(e.target.value);
                              setAudioProgress(value);
                              if (audioRef.current) {
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
                    {selectedMemory.audioUrl !== '#' && (
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
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-accent-foreground rounded-xl hover:bg-accent/90 transition-colors font-medium"
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

              {/* Menu */}
              <div className="absolute top-4 right-4">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-2 hover:bg-secondary/60 rounded-full transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>

                {showMenu && (
                  <motion.div
                    className="absolute top-12 right-0 bg-card border border-border/60 rounded-xl shadow-lg z-10"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      onClick={handleDismiss}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent text-accent-foreground rounded-xl hover:bg-accent/90 transition-colors font-medium"
                    >
                      Ẩn
                    </button>

                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors font-medium"
                    >
                      Xoá
                    </button>
                  </motion.div>
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