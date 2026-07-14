import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Glass Container ───────────────────────────────────────────────
export interface GlassContainerProps extends HTMLMotionProps<'div'> {
  intensity?: 'subtle' | 'regular' | 'strong';
  interactive?: boolean;
}

export const GlassContainer = React.forwardRef<HTMLDivElement, GlassContainerProps>(
  ({ className, intensity = 'regular', interactive = false, ...props }, ref) => {
    const intensityClasses = {
      subtle: 'glass-subtle',
      regular: 'glass',
      strong: 'glass-strong',
    };

    return (
      <motion.div
        ref={ref}
        className={cn(
          intensityClasses[intensity],
          interactive && 'glass-interactive cursor-pointer',
          className
        )}
        whileHover={interactive ? { scale: 1.02 } : undefined}
        whileTap={interactive ? { scale: 0.98 } : undefined}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        {...props}
      />
    );
  }
);
GlassContainer.displayName = 'GlassContainer';

// ─── Glass Button ──────────────────────────────────────────────────
export interface GlassButtonProps extends HTMLMotionProps<'button'> {
  variant?: 'default' | 'accent' | 'danger' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const variants = {
      default: 'hover:bg-white/10 active:bg-white/5 border-white/10',
      accent: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/30 text-blue-100 shadow-accent-glow',
      danger: 'bg-red-500/20 hover:bg-red-500/30 border-red-500/30 text-red-100',
      success: 'bg-green-500/20 hover:bg-green-500/30 border-green-500/30 text-green-100',
      warning: 'bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/30 text-yellow-100',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg',
      icon: 'p-2',
    };

    return (
      <motion.button
        ref={ref}
        className={cn(
          'glass-interactive flex items-center justify-center font-medium transition-all duration-300',
          variants[variant],
          sizes[size],
          className
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        {...props}
      />
    );
  }
);
GlassButton.displayName = 'GlassButton';

// ─── Glass Panel ───────────────────────────────────────────────────
export const GlassPanel = React.forwardRef<HTMLDivElement, GlassContainerProps>(
  ({ className, ...props }, ref) => (
    <GlassContainer
      ref={ref}
      className={cn('p-6 rounded-2xl flex flex-col gap-4', className)}
      {...props}
    />
  )
);
GlassPanel.displayName = 'GlassPanel';

// ─── Glass Nav Item ────────────────────────────────────────────────
export interface GlassNavItemProps extends HTMLMotionProps<'button'> {
  active?: boolean;
}

export const GlassNavItem = React.forwardRef<HTMLButtonElement, GlassNavItemProps>(
  ({ className, active, ...props }, ref) => (
    <motion.button
      ref={ref}
      className={cn(
        'relative px-4 py-2 flex items-center gap-2 rounded-xl transition-all duration-300',
        active 
          ? 'text-white glass-strong shadow-purple-glow' 
          : 'text-white/60 hover:text-white hover:bg-white/5',
        className
      )}
      whileHover={{ x: active ? 0 : 4 }}
      whileTap={{ scale: 0.95 }}
      {...props}
    >
      {active && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute inset-0 rounded-xl border border-white/20 bg-white/5 z-0"
          initial={false}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">{props.children as React.ReactNode}</span>
    </motion.button>
  )
);
GlassNavItem.displayName = 'GlassNavItem';
