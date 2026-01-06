"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import ImageRevealSlider from "./ImageRevealSlider"

interface StickerPreviewProps {
  originalImage: string
  stickerImage: string
  styleName: string
  className?: string
}

export default function StickerPreview({
  originalImage,
  stickerImage,
  styleName,
  className,
}: StickerPreviewProps) {
  const [viewMode, setViewMode] = useState<"compare" | "sticker">("compare")

  return (
    <div className={cn("space-y-4", className)}>
      {/* View Mode Toggle */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setViewMode("compare")}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-all",
            viewMode === "compare"
              ? "bg-[#00C2FF] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          Compare
        </button>
        <button
          onClick={() => setViewMode("sticker")}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium transition-all",
            viewMode === "sticker"
              ? "bg-[#00C2FF] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          Sticker Preview
        </button>
      </div>

      {/* Preview Area */}
      {viewMode === "compare" ? (
        <div className="space-y-2">
          <ImageRevealSlider
            beforeSrc={originalImage}
            afterSrc={stickerImage}
            altBefore="Original"
            altAfter={styleName}
            height={380}
            initial={75}
          />
          <p className="text-center text-sm text-gray-500">
            Drag the slider to compare • Use arrow keys for fine control
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {/* Sticker on Surface Mockup */}
          <div className="relative">
            {/* Notebook/Surface Background */}
            <div className="w-80 h-80 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg shadow-inner flex items-center justify-center">
              {/* Grid lines to simulate notebook */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage:
                    "linear-gradient(#ddd 1px, transparent 1px), linear-gradient(90deg, #ddd 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />

              {/* Sticker with slight rotation for realism */}
              <div
                className="relative transform rotate-3 hover:rotate-0 transition-transform duration-300"
                style={{
                  filter: "drop-shadow(4px 4px 8px rgba(0, 0, 0, 0.2))",
                }}
              >
                <img
                  src={stickerImage}
                  alt={`${styleName} sticker`}
                  className="w-48 h-48 object-contain"
                />
              </div>
            </div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-3">
            Preview of your sticker on a surface
          </p>
        </div>
      )}

      {/* Style Badge */}
      <div className="text-center">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
          🎨 {styleName} Style
        </span>
      </div>
    </div>
  )
}
