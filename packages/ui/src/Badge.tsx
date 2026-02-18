import type React from "react";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "outline";
export type BadgeSize = "sm" | "md" | "lg";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className = "",
}) => {
  const baseClasses = [
    "inline-flex items-center justify-center",
    "font-medium rounded-full",
    "transition-colors duration-150",
  ].join(" ");

  const variantClasses: Record<BadgeVariant, string> = {
    default: "bg-white/10 text-white border border-white/20",
    success: "bg-green-500/20 text-green-400 border border-green-500/30",
    warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    error: "bg-red-500/20 text-red-400 border border-red-500/30",
    info: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    outline: "bg-transparent text-gray-400 border border-white/30",
  };

  const sizeClasses: Record<BadgeSize, string> = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-0.5 text-xs",
    lg: "px-2.5 py-1 text-sm",
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {children}
    </span>
  );
};

// Status indicator badge with dot
export interface StatusBadgeProps extends BadgeProps {
  status: "online" | "offline" | "busy" | "away";
}

const statusColors: Record<StatusBadgeProps["status"], string> = {
  online: "bg-green-500",
  offline: "bg-gray-500",
  busy: "bg-red-500",
  away: "bg-amber-500",
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  variant = "default",
  size = "md",
  className = "",
}) => {
  return (
    <Badge variant={variant} size={size} className={`gap-1.5 ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`} aria-hidden="true" />
      {children}
    </Badge>
  );
};
