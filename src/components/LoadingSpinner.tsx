"use client"

import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
  message?: string
}

const sizeClasses = {
  sm: "w-4 h-4 border-2",
  md: "w-8 h-8 border-3",
  lg: "w-12 h-12 border-4",
}

export default function LoadingSpinner({
  size = "md",
  className,
  message,
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        className={cn(
          "rounded-full border-white/30 border-t-white animate-spin",
          sizeClasses[size]
        )}
        style={{
          borderTopColor: "#00C2FF",
          borderRightColor: "#00C2FF",
          borderBottomColor: "rgba(0, 194, 255, 0.3)",
          borderLeftColor: "rgba(0, 194, 255, 0.3)",
        }}
      />
      {message && (
        <p className="text-sm text-gray-600 animate-pulse">{message}</p>
      )}
    </div>
  )
}

// Full-page loading overlay
export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        {message && (
          <p className="text-lg font-medium text-gray-700">{message}</p>
        )}
      </div>
    </div>
  )
}
