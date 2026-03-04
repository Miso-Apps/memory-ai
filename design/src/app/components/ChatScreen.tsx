import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setMessages([...messages, newMessage]);
    setInput('');
    setIsTyping(true);
    
    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Mình hiểu bạn đang suy nghĩ về điều này. Để mình xem qua những gì bạn đã từng chia sẻ trước đây...',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // EMPTY STATE - User hasn't started conversation
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Simple header */}
        <div className="pt-safe px-5 py-6 border-b border-border/40">
          <motion.h1
            className="text-2xl font-medium mb-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            Trò chuyện
          </motion.h1>
          <motion.p
            className="text-sm text-muted-foreground/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Mình hiểu những gì bạn đã lưu
          </motion.p>
        </div>

        {/* Empty state */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-48">
          <motion.div
            className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center mb-6 shadow-sm"
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
            <Sparkles className="w-9 h-9 text-accent/60" strokeWidth={2} />
          </motion.div>

          <motion.p
            className="text-center text-foreground/90 text-base leading-relaxed max-w-xs mb-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Khi bạn muốn nói ra điều gì đó,<br />
            mình ở đây.
          </motion.p>

          {/* Pointing down hint */}
          <motion.div
            className="flex flex-col items-center gap-2 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-muted-foreground/40"
              >
                <path
                  d="M12 5v14m0 0l-7-7m7 7l7-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
            <p className="text-xs text-muted-foreground/50">
              Nhập tin nhắn bên dưới
            </p>
          </motion.div>
        </div>

        {/* Input Area - Fixed positioning above tab bar */}
        <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto z-40">
          <div className="bg-background/95 backdrop-blur-xl border-t border-border/40 pl-5 pr-24 py-3 shadow-lg">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Nhắn gì đó..."
                  rows={1}
                  className="w-full bg-secondary/60 border border-border/60 rounded-[20px] px-4 py-3 resize-none outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all text-[15px] max-h-32"
                  style={{
                    boxShadow: 'var(--shadow-sm)',
                  }}
                />
              </div>
              <motion.button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-11 h-11 rounded-full bg-accent disabled:bg-muted disabled:opacity-40 flex items-center justify-center flex-shrink-0 shadow-md disabled:shadow-none"
                whileHover={input.trim() ? { scale: 1.05 } : {}}
                whileTap={input.trim() ? { scale: 0.95 } : {}}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Send className="w-5 h-5 text-accent-foreground" strokeWidth={2.5} />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CONVERSATION MODE
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Simple header */}
      <div className="pt-safe px-5 py-4 border-b border-border/40">
        <h2 className="text-lg font-medium">Trò chuyện</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-5 py-6 pb-40 smooth-scroll">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{
                duration: 0.4,
                delay: index * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`mb-4 flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'ai' ? (
                <div className="flex gap-2.5 max-w-[82%]">
                  <motion.div
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm"
                    whileHover={{ scale: 1.08, rotate: 8 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Sparkles className="w-4 h-4 text-accent" strokeWidth={2.5} />
                  </motion.div>
                  <div>
                    <div className="bg-card rounded-[18px] rounded-tl-md px-4 py-3 border border-border/60 shadow-sm">
                      <p className="text-[15px] text-foreground/95 leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-[82%]">
                  <div className="bg-accent rounded-[18px] rounded-tr-md px-4 py-3 shadow-sm">
                    <p className="text-[15px] text-accent-foreground leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex gap-2.5 mb-4"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Sparkles className="w-4 h-4 text-accent" strokeWidth={2.5} />
            </div>
            <div className="bg-card rounded-[18px] rounded-tl-md px-4 py-3 border border-border/60 shadow-sm">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-muted-foreground/40"
                    animate={{
                      y: [0, -6, 0],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Fixed positioning above tab bar */}
      <div className="fixed bottom-20 left-0 right-0 max-w-md mx-auto z-40">
        <div className="bg-background/95 backdrop-blur-xl border-t border-border/40 px-5 py-3 shadow-lg">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Nhắn gì đó..."
                rows={1}
                className="w-full bg-secondary/60 border border-border/60 rounded-[20px] px-4 py-3 resize-none outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition-all text-[15px] max-h-32"
                style={{
                  boxShadow: 'var(--shadow-sm)',
                }}
              />
            </div>
            <motion.button
              onClick={handleSend}
              disabled={!input.trim()}
              className="w-11 h-11 rounded-full bg-accent disabled:bg-muted disabled:opacity-40 flex items-center justify-center flex-shrink-0 shadow-md disabled:shadow-none"
              whileHover={input.trim() ? { scale: 1.05 } : {}}
              whileTap={input.trim() ? { scale: 0.95 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Send className="w-5 h-5 text-accent-foreground" strokeWidth={2.5} />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}