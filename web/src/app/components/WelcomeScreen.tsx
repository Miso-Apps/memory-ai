import { Sparkles, Brain, Heart, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      icon: Brain,
      title: 'Bộ não thứ hai\ncủa bạn',
      description: 'Mình sẽ nhớ mọi thứ bạn chia sẻ, từ suy nghĩ đến khoảnh khắc quan trọng',
      gradient: 'from-purple-500/20 to-blue-500/20',
    },
    {
      icon: Heart,
      title: 'Hiểu bạn\ntheo thời gian',
      description: 'Càng dùng, mình càng hiểu bạn sâu hơn và gợi ý đúng lúc hơn',
      gradient: 'from-pink-500/20 to-rose-500/20',
    },
    {
      icon: Zap,
      title: 'Không phải\nproductivity tool',
      description: 'Mình là người bạn đồng hành đáng tin cậy, không phán xét, luôn ở đây',
      gradient: 'from-amber-500/20 to-orange-500/20',
    },
  ];

  if (step < steps.length) {
    const currentStep = steps[step];
    const Icon = currentStep.icon;

    return (
      <div className="h-screen flex flex-col bg-background px-6 relative overflow-hidden">
        {/* Animated background gradient */}
        <motion.div
          className={`absolute inset-0 bg-gradient-to-br ${currentStep.gradient} opacity-50`}
          key={step}
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: 0.5, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Progress dots */}
        <motion.div
          className="flex gap-2 justify-center pt-16 relative z-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {steps.map((_, index) => (
            <motion.div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === step ? 'w-8 bg-accent' : 'w-1.5 bg-accent/30'
              }`}
              animate={{
                scale: index === step ? 1 : 0.8,
              }}
            />
          ))}
        </motion.div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 -mt-16">
          {/* Icon with breathing animation */}
          <motion.div
            className="relative mb-12"
            key={`icon-${step}`}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 20,
              delay: 0.1,
            }}
          >
            {/* Pulsing rings */}
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border-2 border-accent/20"
                animate={{
                  scale: [1, 1.5, 2],
                  opacity: [0.5, 0.2, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: 'easeOut',
                }}
                style={{ width: 120, height: 120, left: '50%', top: '50%', marginLeft: -60, marginTop: -60 }}
              />
            ))}
            
            <motion.div
              className="w-32 h-32 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center shadow-2xl backdrop-blur-xl relative"
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Icon className="w-16 h-16 text-accent" strokeWidth={1.5} />
            </motion.div>
          </motion.div>

          {/* Text content */}
          <motion.div
            className="text-center px-8"
            key={`text-${step}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="mb-6 whitespace-pre-line leading-tight">
              {currentStep.title}
            </h1>
            <motion.p
              className="text-muted-foreground/90 leading-relaxed text-[17px] max-w-sm mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {currentStep.description}
            </motion.p>
          </motion.div>
        </div>

        {/* Navigation buttons */}
        <motion.div
          className="pb-12 relative z-10 space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <motion.button
            onClick={() => setStep(step + 1)}
            className="w-full bg-accent text-accent-foreground py-4 rounded-full font-medium shadow-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {step === steps.length - 1 ? 'Bắt đầu' : 'Tiếp tục'}
          </motion.button>

          {step > 0 && (
            <motion.button
              onClick={() => setStep(step - 1)}
              className="w-full text-muted-foreground py-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileTap={{ scale: 0.95 }}
            >
              Quay lại
            </motion.button>
          )}
        </motion.div>
      </div>
    );
  }

  // Final step - Name input
  return (
    <div className="h-screen flex flex-col bg-background px-6 relative overflow-hidden">
      {/* Subtle animated background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-accent/5"
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <div className="flex-1 flex flex-col justify-center relative z-10">
        {/* Sparkles icon */}
        <motion.div
          className="flex justify-center mb-8"
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: 'spring',
            stiffness: 200,
            damping: 20,
          }}
        >
          <motion.div
            className="w-24 h-24 rounded-full bg-gradient-to-br from-accent/30 to-accent/10 flex items-center justify-center shadow-xl"
            animate={{
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Sparkles className="w-12 h-12 text-accent" strokeWidth={2} />
          </motion.div>
        </motion.div>

        <motion.div
          className="text-center px-4 mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="mb-4 leading-tight">
            Chào bạn 👋
          </h1>
          <p className="text-muted-foreground/90 leading-relaxed text-[17px] max-w-sm mx-auto">
            Mình có thể gọi bạn là gì?
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <input
            type="text"
            placeholder="Tên của bạn"
            autoFocus
            className="w-full bg-card/80 backdrop-blur-xl border-2 border-border/50 rounded-3xl px-6 py-5 text-center text-lg outline-none focus:border-accent/50 focus:ring-4 focus:ring-accent/10 transition-all shadow-lg"
          />
        </motion.div>
      </div>

      <motion.div
        className="pb-12 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <motion.button
          onClick={onGetStarted}
          className="w-full bg-accent text-accent-foreground py-4 rounded-full font-medium shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Bắt đầu hành trình
        </motion.button>
      </motion.div>
    </div>
  );
}