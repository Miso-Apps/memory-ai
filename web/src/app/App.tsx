import { useState } from 'react';
import { Bell, Archive, Menu, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HomeRecall } from './components/HomeRecall';
import { UnifiedSearchScreen } from './components/UnifiedSearchScreen';
import { QuickCapture } from './components/QuickCapture';
import { ProfileScreen } from './components/ProfileScreen';
import { WelcomeScreen } from './components/WelcomeScreen';
import { AuthGate } from './components/AuthGate';
import { authApi, type AuthSession } from './services/api';

type Tab = 'recall' | 'archive' | 'menu';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('recall');
  const [showWelcome, setShowWelcome] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(() => authApi.getStoredSession());

  if (!session) {
    return <AuthGate onAuthenticated={(next) => setSession(next)} />;
  }

  if (showWelcome) {
    return (
      <div className="h-screen max-w-md mx-auto">
        <WelcomeScreen onGetStarted={() => setShowWelcome(false)} />
      </div>
    );
  }

  const tabs = [
    { id: 'recall' as Tab, icon: Bell, label: 'Nhắc' },
    { id: 'archive' as Tab, icon: Archive, label: 'Kho' },
    { id: 'menu' as Tab, icon: Menu, label: 'Menu' },
  ];

  return (
    <div className="h-screen flex flex-col max-w-md mx-auto bg-background relative">
      {/* Main Content - Proper safe area handling */}
      <div className="flex-1 overflow-hidden" style={{ paddingTop: 'var(--safe-area-top)' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'recall' && (
            <motion.div
              key="recall"
              className="h-full"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <HomeRecall />
            </motion.div>
          )}
          {activeTab === 'archive' && (
            <motion.div
              key="archive"
              className="h-full"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <UnifiedSearchScreen />
            </motion.div>
          )}
          {activeTab === 'menu' && (
            <motion.div
              key="menu"
              className="h-full"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <ProfileScreen
                onSignOut={() => {
                  authApi.clearSession();
                  setSession(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global FAB - Mobile optimized */}
      <motion.button
        onClick={() => setShowQuickCapture(true)}
        className="fixed right-6 w-16 h-16 rounded-full bg-accent flex items-center justify-center z-40"
        style={{
          bottom: 'calc(80px + var(--safe-area-bottom))',
          boxShadow: 'var(--shadow-fab)',
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 20,
          delay: 0.2,
        }}
      >
        {/* Pulsing rings */}
        <motion.div
          className="absolute inset-0 rounded-full bg-accent"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeOut',
          }}
        />
        <motion.div
          className="absolute inset-0 rounded-full bg-accent"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeOut',
            delay: 1,
          }}
        />
        <Plus className="w-7 h-7 text-accent-foreground relative z-10" strokeWidth={2.5} />
      </motion.button>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50">
        <div className="relative bg-card/95 backdrop-blur-xl border-t border-border/50 pb-safe">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
          
          <div className="flex items-center justify-around py-2.5 px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative flex flex-col items-center gap-1.5 px-3 py-3 min-w-[72px]"
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <div className="relative">
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 bg-accent/15 rounded-full blur-lg"
                        layoutId="tabGlow"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 2, opacity: 1 }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <Icon
                      className={`w-[22px] h-[22px] transition-all duration-200 relative z-10 ${
                        isActive ? 'text-accent' : 'text-muted-foreground/70'
                      }`}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {isActive && (
                      <motion.div
                        layoutId="activeTabDot"
                        className="absolute -bottom-1 left-1/2 w-1 h-1 rounded-full bg-accent"
                        style={{ x: '-50%' }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                  </div>
                  <motion.span
                    className={`text-[11px] font-medium whitespace-nowrap transition-colors duration-200 ${
                      isActive ? 'text-accent' : 'text-muted-foreground/70'
                    }`}
                    animate={{
                      scale: isActive ? 1 : 0.95,
                      opacity: isActive ? 1 : 0.8,
                    }}
                  >
                    {tab.label}
                  </motion.span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Capture Modal */}
      <AnimatePresence>
        {showQuickCapture && (
          <QuickCapture onClose={() => setShowQuickCapture(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;