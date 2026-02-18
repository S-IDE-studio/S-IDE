import type React from "react";
import { useId } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  error?: string;
  size?: "sm" | "md" | "lg";
  options: SelectOption[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  size = "md",
  options,
  className = "",
  id,
  ...props
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;

  const baseClasses = [
    "w-full",
    "bg-black/50",
    "border rounded",
    "text-white",
    "transition-all duration-150",
    "focus:outline-none",
    "focus:border-white/50",
    "focus:ring-2 focus:ring-white/20",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "cursor-pointer",
    "appearance-none",
    "bg-no-repeat",
    "bg-right",
    "pr-8",
  ].join(" ");

  const normalBorder = "border-white/20";
  const errorBorder = "border-red-500 focus:border-red-400 focus:ring-red-500/20";

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  // Custom dropdown arrow via inline SVG background
  const arrowIcon = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`;
  const bgStyle = {
    backgroundImage: arrowIcon,
    backgroundSize: "16px",
    backgroundPosition: "right 8px center",
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={selectId}
          className="text-xs font-medium text-gray-400 uppercase tracking-wide"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        style={bgStyle}
        className={`${baseClasses} ${error ? errorBorder : normalBorder} ${sizeClasses[size]} ${className}`}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? `${selectId}-error` : undefined}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-gray-900 text-white">
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span id={`${selectId}-error`} className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
