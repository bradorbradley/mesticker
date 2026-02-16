"use client";

import { motion } from "framer-motion";
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
    <div className={cn("flex items-center justify-center gap-1", className)}>
      {steps.map((step, i) => {
        const completed = i < currentIndex;
        const active = i === currentIndex;
        const Icon = completed ? Check : step.icon;

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div className="relative w-10 h-0.5 mx-0.5 bg-border rounded-full overflow-hidden">
                {completed && (
                  <motion.div
                    className="absolute inset-0 gradient-primary rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                )}
              </div>
            )}
            <div className="flex flex-col items-center gap-1">
              <motion.div
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                  completed && "gradient-primary text-white shadow-glow",
                  active && "gradient-primary text-white shadow-glow",
                  !completed && !active && "bg-muted text-muted-foreground"
                )}
                animate={active ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Icon size={16} />
              </motion.div>
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  active || completed ? "text-primary" : "text-muted-foreground"
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
