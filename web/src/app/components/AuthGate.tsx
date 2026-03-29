import { useState } from 'react';
import { Loader2, LogIn, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { authApi, type AuthSession } from '../services/api';

interface AuthGateProps {
  onAuthenticated: (session: AuthSession) => void;
}

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLabel = mode === 'login' ? 'Dang nhap' : 'Tao tai khoan';

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim() || (mode === 'register' && !name.trim())) {
      setError('Vui long nhap day du thong tin.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const session =
        mode === 'login'
          ? await authApi.login(email.trim(), password)
          : await authApi.register(name.trim(), email.trim(), password);
      onAuthenticated(session);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Khong the dang nhap. Vui long thu lai.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen max-w-md mx-auto bg-background flex items-center px-6">
      <motion.div
        className="w-full bg-card border border-border/50 rounded-3xl p-6 shadow-lg"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-medium mb-2">Memory AI</h1>
        <p className="text-sm text-muted-foreground/80 mb-6">
          Dang nhap de dong bo kho ghi nho cua ban tren web.
        </p>

        <div className="space-y-3">
          {mode === 'register' && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ten hien thi"
              className="w-full bg-secondary/40 border border-border/50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-secondary/40 border border-border/50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mat khau"
            className="w-full bg-secondary/40 border border-border/50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-accent/20"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void handleSubmit();
              }
            }}
          />
        </div>

        {error && <p className="text-xs text-destructive mt-3">{error}</p>}

        <button
          onClick={() => void handleSubmit()}
          disabled={isSubmitting}
          className="mt-5 w-full bg-accent text-accent-foreground py-3.5 rounded-full font-medium disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Dang xu ly...
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {submitLabel}
            </span>
          )}
        </button>

        <button
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {mode === 'login' ? 'Chua co tai khoan? Tao moi' : 'Da co tai khoan? Dang nhap'}
        </button>
      </motion.div>
    </div>
  );
}
