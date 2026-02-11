"use client";

import { Creation } from "@/types";
import { cn } from "@/lib/utils";
import { Clock, ShoppingBag } from "lucide-react";

interface GalleryProps {
  creations: Creation[];
  onSelect?: (creation: Creation) => void;
  className?: string;
}

export default function Gallery({ creations, onSelect, className }: GalleryProps) {
  if (creations.length === 0) return null;

  return (
    <div className={cn("w-full", className)}>
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        <Clock size={14} />
        Recent Creations
      </h3>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {creations.map((creation) => (
          <button
            key={creation.id}
            onClick={() => onSelect?.(creation)}
            className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors relative"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={creation.generatedImage}
              alt="Past creation"
              className="w-full h-full object-cover"
            />
            {creation.ordered && (
              <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-success flex items-center justify-center">
                <ShoppingBag size={10} className="text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
