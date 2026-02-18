import type React from "react";
import { useId } from "react";

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  size = "md",
  className = "",
  id,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  const baseClasses = [
    "w-full",
    "bg-black/50",
    "border rounded",
    "text-white",
    "placeholder:text-gray-500",
    "transition-all duration-150",
    "focus:outline-none",
    "focus:border-white/50",
    "focus:ring-2 focus:ring-white/20",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" ");

  const normalBorder = "border-white/20";
  const errorBorder = "border-red-500 focus:border-red-400 focus:ring-red-500/20";

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-gray-400 uppercase tracking-wide"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`${baseClasses} ${error ? errorBorder : normalBorder} ${sizeClasses[size]} ${className}`}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <span id={`${inputId}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
