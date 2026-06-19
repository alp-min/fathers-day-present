"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, message, variant }]);
      timers.current[id] = setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const VARIANT_CONFIG: Record<
  ToastVariant,
  { icon: typeof CheckCircle; color: string; bg: string; border: string }
> = {
  success: {
    icon: CheckCircle,
    color: "text-gain",
    bg: "bg-surface-2",
    border: "border-gain/30",
  },
  error: {
    icon: AlertTriangle,
    color: "text-loss",
    bg: "bg-surface-2",
    border: "border-loss/30",
  },
  info: {
    icon: Info,
    color: "text-accent",
    bg: "bg-surface-2",
    border: "border-accent/30",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const cfg = VARIANT_CONFIG[toast.variant];
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-card min-w-[260px] max-w-sm ${cfg.bg} ${cfg.border}`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${cfg.color}`} />
      <p className="flex-1 text-xs font-medium text-primary">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-muted hover:text-primary transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}
