"use client";

import { cn } from "@/lib/utils";
import { Camera, Palette, ShoppingCart, Check } from "lucide-react";
import type { AppStep } from "@/types";

const steps: { key: AppStep; label: string; icon: React.ElementType }[] = [
  { key: "capture", label: "Photo", icon: Camera },
  { key: "style", label: "Style", icon: Palette },
  { key: "order", label: "Order", icon: ShoppingCart },
];

interface ProgressStepsProps {
  current: AppStep;
  className?: string;
}

export default function ProgressSteps({ current, className }: ProgressStepsProps) {
  const currentIndex = steps.findIndex((s) => s.key === current);

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {steps.map((step, i) => {
        const completed = i < currentIndex;
        const active = i === currentIndex;
        const Icon = completed ? Check : step.icon;

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div
                className={cn(
                  "w-8 h-0.5 mx-1",
                  completed ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                  completed && "bg-primary text-white",
                  active && "bg-primary text-white",
                  !completed && !active && "bg-muted text-muted-foreground"
                )}
              >
                <Icon size={16} />
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
