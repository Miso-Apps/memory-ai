import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center px-8 py-16"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Animated illustration */}
      <motion.div
        className="relative mb-8"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.2, type: 'spring' }}
      >
        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 rounded-full bg-accent/40"
            style={{
              left: `${Math.cos((i * Math.PI * 2) / 6) * 80}px`,
              top: `${Math.sin((i * Math.PI * 2) / 6) * 80}px`,
            }}
            animate={{
              y: [0, -15, 0],
              opacity: [0.2, 0.8, 0.2],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Main icon container */}
        <motion.div
          className="relative w-32 h-32 rounded-full bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center shadow-xl backdrop-blur-sm border border-accent/20"
          animate={{
            y: [0, -12, 0],
            rotate: [0, 2, -2, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Inner glow */}
          <motion.div
            className="absolute inset-0 rounded-full bg-accent/10"
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          
          {/* Icon */}
          <motion.div
            animate={{
              rotate: [0, 5, -5, 0],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Sparkles className="w-14 h-14 text-accent" strokeWidth={2} />
          </motion.div>
        </motion.div>

        {/* Orbiting dots */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={`orbit-${i}`}
            className="absolute w-3 h-3 rounded-full bg-gradient-to-br from-accent/60 to-accent/30 shadow-lg"
            style={{
              left: '50%',
              top: '50%',
              marginLeft: -6,
              marginTop: -6,
            }}
            animate={{
              rotate: [0, 360],
              x: [0, Math.cos((i * Math.PI * 2) / 3) * 70],
              y: [0, Math.sin((i * Math.PI * 2) / 3) * 70],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.3,
            }}
          />
        ))}
      </motion.div>

      {/* Text content with stagger */}
      <motion.div
        className="text-center max-w-sm space-y-3"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <motion.h3
          className="text-foreground/90"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {title}
        </motion.h3>
        
        <motion.p
          className="text-muted-foreground/80 leading-relaxed text-[15px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {description}
        </motion.p>
      </motion.div>

      {/* Gentle pulsing hint */}
      <motion.div
        className="mt-8 flex items-center gap-2 text-sm text-accent/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <motion.div
          className="w-2 h-2 rounded-full bg-accent"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        />
        <span>Nhấn + để bắt đầu</span>
      </motion.div>
    </motion.div>
  );
}