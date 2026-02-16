"use client";

import { motion } from "framer-motion";
import { Creation } from "@/types";
import { cn } from "@/lib/utils";
import { Clock, ShoppingBag } from "lucide-react";
import { hapticLight } from "@/lib/haptics";

interface GalleryProps {
  creations: Creation[];
  onSelect?: (creation: Creation) => void;
  className?: string;
}

export default function Gallery({ creations, onSelect, className }: GalleryProps) {
  if (creations.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
        <Clock size={12} />
        Your Creations
      </h3>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {creations.map((creation, i) => (
          <motion.button
            key={creation.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              hapticLight();
              onSelect?.(creation);
            }}
            className="flex-shrink-0 w-[68px] h-[68px] rounded-xl overflow-hidden border-2 border-border hover:border-primary shadow-soft transition-all relative"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={creation.generatedImage}
              alt="Past creation"
              className="w-full h-full object-cover"
            />
            {creation.ordered && (
              <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-accent-green flex items-center justify-center shadow-sm">
                <ShoppingBag size={8} className="text-white" />
              </div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
