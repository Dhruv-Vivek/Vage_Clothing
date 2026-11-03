'use client';

import { useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/utils";

// Text input / textarea with a floating label and an animated error message.
export const FloatingField = ({
  label,
  value = "",
  onChange,
  error,
  multiline = false,
  maxLength,
  className,
  ...props
}) => {
  const id = useId();
  const Control = multiline ? "textarea" : "input";

  return (
    <div className={className}>
      <div className="relative">
        <Control
          id={id}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          rows={multiline ? 5 : undefined}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
          placeholder=" "
          className={cn(
            "peer w-full rounded-lg border bg-dark/60 px-4 pb-2 pt-6 text-white outline-none transition-colors",
            multiline && "resize-none",
            error ? "border-red-500/70" : "border-dark-border focus:border-white/50"
          )}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 top-1.5 text-xs text-light-gray transition-all duration-200 peer-placeholder-shown:top-4 peer-placeholder-shown:text-base peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-white"
        >
          {label}
        </label>
        <span className="pointer-events-none absolute bottom-0 left-3 right-3 h-px origin-left scale-x-0 bg-white transition-transform duration-300 peer-focus:scale-x-100" />
      </div>

      {multiline && maxLength ? (
        <p className="mt-1 text-right text-xs text-light-gray">
          {value.length}/{maxLength}
        </p>
      ) : null}

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden pt-1 text-sm text-red-400"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};
