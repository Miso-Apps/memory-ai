import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

export function LoadingCard() {
  return (
    <motion.div
      className="relative bg-card rounded-3xl p-6 border border-border overflow-hidden mb-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Animated shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent"
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      <div className="relative flex items-start gap-3">
        {/* Icon skeleton with pulse */}
        <motion.div
          className="w-11 h-11 rounded-full bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center flex-shrink-0"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <motion.div
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <Sparkles className="w-5 h-5 text-accent/40" strokeWidth={2} />
          </motion.div>
        </motion.div>

        <div className="flex-1 space-y-3">
          {/* Title skeleton */}
          <div className="space-y-2">
            <motion.div
              className="h-5 bg-gradient-to-r from-muted/40 to-muted/20 rounded-full w-3/4"
              animate={{
                opacity: [0.4, 0.6, 0.4],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="h-5 bg-gradient-to-r from-muted/40 to-muted/20 rounded-full w-1/2"
              animate={{
                opacity: [0.4, 0.6, 0.4],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 0.2,
                ease: 'easeInOut',
              }}
            />
          </div>

          {/* Context skeleton */}
          <div className="space-y-2">
            <motion.div
              className="h-4 bg-gradient-to-r from-muted/30 to-muted/15 rounded-full w-full"
              animate={{
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 0.1,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              className="h-4 bg-gradient-to-r from-muted/30 to-muted/15 rounded-full w-5/6"
              animate={{
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: 0.3,
                ease: 'easeInOut',
              }}
            />
          </div>

          {/* Date skeleton */}
          <motion.div
            className="h-3 bg-gradient-to-r from-muted/25 to-muted/10 rounded-full w-1/4"
            animate={{
              opacity: [0.25, 0.4, 0.25],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: 0.4,
              ease: 'easeInOut',
            }}
          />
        </div>
      </div>

      {/* Button skeletons */}
      <div className="flex gap-3 mt-5 relative">
        <motion.div
          className="flex-1 h-12 bg-gradient-to-r from-muted/30 to-muted/20 rounded-full"
          animate={{
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: 0.5,
            ease: 'easeInOut',
          }}
        />
        <motion.div
          className="flex-1 h-12 bg-gradient-to-r from-muted/25 to-muted/15 rounded-full"
          animate={{
            opacity: [0.25, 0.45, 0.25],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: 0.6,
            ease: 'easeInOut',
          }}
        />
      </div>
    </motion.div>
  );
}

// Full page loading state
export function FullPageLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8">
      <motion.div
        className="relative mb-8"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {/* Orbiting particles */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full bg-gradient-to-br from-accent/60 to-accent/30"
            style={{
              left: '50%',
              top: '50%',
              marginLeft: -6,
              marginTop: -6,
            }}
            animate={{
              rotate: [0, 360],
              x: [0, Math.cos((i * Math.PI * 2) / 3) * 50],
              y: [0, Math.sin((i * Math.PI * 2) / 3) * 50],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'linear',
              delay: i * 0.3,
            }}
          />
        ))}

        {/* Central icon */}
        <motion.div
          className="w-24 h-24 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center shadow-xl relative"
          animate={{
            y: [0, -8, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            y: {
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            },
            rotate: {
              duration: 4,
              repeat: Infinity,
              ease: 'linear',
            },
          }}
        >
          <Sparkles className="w-10 h-10 text-accent" strokeWidth={2} />
        </motion.div>
      </motion.div>

      <motion.p
        className="text-muted-foreground/70 text-[15px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        Đang suy nghĩ...
      </motion.p>
    </div>
  );
}