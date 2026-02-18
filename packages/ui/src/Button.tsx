import type React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}) => {
  const baseClasses = [
    "inline-flex items-center justify-center gap-2",
    "rounded font-medium",
    "transition-all duration-150 ease-out",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" ");

  const variantClasses = {
    // Primary: White background with black text
    primary: [
      "bg-white text-black",
      "hover:bg-gray-200",
      "active:bg-gray-300",
      "shadow-sm hover:shadow-md",
    ].join(" "),
    // Secondary: Transparent with border
    secondary: [
      "bg-transparent text-white border border-white/30",
      "hover:bg-white/10 hover:border-white/50",
      "active:bg-white/15",
    ].join(" "),
    // Danger: Red for destructive actions
    danger: [
      "bg-red-600 text-white",
      "hover:bg-red-500",
      "active:bg-red-400",
      "shadow-sm hover:shadow-md",
    ].join(" "),
    // Ghost: Minimal, transparent
    ghost: [
      "bg-transparent text-gray-300",
      "hover:bg-white/10 hover:text-white",
      "active:bg-white/15",
    ].join(" "),
  };

  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  const loadingClasses = loading ? "cursor-wait" : "";

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${loadingClasses} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <title>Loading</title>
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
};
