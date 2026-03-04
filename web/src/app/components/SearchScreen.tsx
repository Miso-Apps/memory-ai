import { useState, useRef } from 'react';
import { Search, Sparkles, Link2, PenLine, Mic, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SearchResult {
  id: string;
  type: 'link' | 'text' | 'voice';
  content: string;
  date: string;
  relevance?: number;
}

export function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showInsight, setShowInsight] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mock search function
  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      setShowInsight(false);
      return;
    }

    setHasSearched(true);

    // Mock results - semantic search simulation
    const mockResults: SearchResult[] = [
      {
        id: '1',
        type: 'text',
        content: 'Suy nghĩ về việc chuyển đổi công việc. Cân nhắc giữa đam mê và ổn định tài chính.',
        date: '3 tuần trước',
      },
      {
        id: '2',
        type: 'link',
        content: 'How to find balance between your passion and financial security',
        date: '3 tuần trước',
      },
      {
        id: '3',
        type: 'text',
        content: 'Nhận ra rằng mình đã thay đổi nhiều trong 6 tháng qua. Cần review lại mục tiêu dài hạn.',
        date: '2 tuần trước',
      },
      {
        id: '4',
        type: 'voice',
        content: 'Băn khoăn về việc nên chọn công việc ổn định hay theo đuổi dự án riêng',
        date: '1 tháng trước',
      },
    ];

    setResults(mockResults);
    
    // Show insight if pattern is strong enough
    if (mockResults.length >= 3) {
      setShowInsight(true);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setShowInsight(false);
    inputRef.current?.focus();
  };

  const iconMap = {
    link: Link2,
    text: PenLine,
    voice: Mic,
  };

  // EMPTY STATE - No search yet
  if (!hasSearched) {
    return (
      <div className="flex-1 flex flex-col bg-background">
        {/* Header */}
        <div className="pt-safe px-5 py-6 border-b border-border/40">
          <motion.h1
            className="text-2xl font-medium mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Tìm lại
          </motion.h1>
          <motion.p
            className="text-sm text-muted-foreground/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Tìm kiếm bằng ý nghĩa, không phải từ khóa
          </motion.p>
        </div>

        {/* Empty state - Large search */}
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
            <Search className="w-11 h-11 text-accent/60" strokeWidth={2} />
          </motion.div>

          <motion.p
            className="text-center text-foreground/90 text-lg leading-relaxed max-w-sm mb-12"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Nhập suy nghĩ,<br />
            mình sẽ tìm lại những gì bạn từng lưu.
          </motion.p>

          {/* Search bar */}
          <div className="w-full max-w-sm">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  handleSearch(e.target.value);
                }}
                placeholder="Bạn đang nhớ lại điều gì?"
                className="w-full bg-card border border-border/60 rounded-full pl-14 pr-5 py-4 text-base outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all shadow-sm"
                autoFocus
              />
            </div>

            {/* Example queries */}
            <motion.div
              className="mt-6 space-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <p className="text-xs text-muted-foreground/60 mb-3">Ví dụ:</p>
              {[
                'chuyển việc',
                'ý tưởng dự án phụ',
                'growth bản thân',
              ].map((example, i) => (
                <motion.button
                  key={example}
                  onClick={() => {
                    setQuery(example);
                    handleSearch(example);
                  }}
                  className="block w-full text-left px-4 py-2.5 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-colors text-sm text-muted-foreground"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {example}
                </motion.button>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  // RESULTS VIEW
  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header with search bar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/40 pt-safe">
        <div className="px-5 py-4">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder="Bạn đang nhớ lại điều gì?"
              className="w-full bg-secondary/40 border border-border/60 rounded-full pl-12 pr-12 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 transition-all"
            />
            {query && (
              <motion.button
                onClick={handleClear}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto px-5 py-4 pb-24 smooth-scroll">
        {/* Results count */}
        <motion.p
          className="text-sm text-muted-foreground/70 mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Tìm thấy {results.length} kết quả
        </motion.p>

        {/* Results list */}
        <div className="space-y-3 mb-6">
          {results.map((result, index) => {
            const Icon = iconMap[result.type];
            return (
              <motion.button
                key={result.id}
                className="w-full text-left bg-card rounded-2xl p-4 border border-border/40 group hover:border-accent/30 transition-colors"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.06,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground/90 leading-relaxed mb-2">
                      {result.content}
                    </p>
                    <p className="text-xs text-muted-foreground/60">{result.date}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Optional insight - 1 line only, after results */}
        <AnimatePresence>
          {showInsight && (
            <motion.div
              className="bg-accent/5 border border-accent/20 rounded-2xl p-4"
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-sm text-foreground/90 leading-relaxed">
                  Bạn đã nhiều lần quay lại chủ đề này trong vài tháng gần đây.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
