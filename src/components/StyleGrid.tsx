"use client"

import { STYLE_PRESETS, StylePresetKey } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { Heart, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface StyleGridProps {
  selectedStyle: StylePresetKey | null
  onStyleSelect: (style: StylePresetKey) => void
  className?: string
}

// Placeholder colors for style previews (until real images are added)
const STYLE_COLORS: Record<StylePresetKey, string> = {
  watercolor: "from-pink-200 to-purple-200",
  ghibli: "from-green-200 to-blue-200",
  pixar: "from-orange-200 to-yellow-200",
  popart: "from-red-300 to-yellow-300",
  illustrated: "from-teal-200 to-cyan-200",
  vintage: "from-amber-200 to-orange-200",
}

const STYLE_EMOJIS: Record<StylePresetKey, string> = {
  watercolor: "🎨",
  ghibli: "🌸",
  pixar: "✨",
  popart: "🎯",
  illustrated: "📚",
  vintage: "🎞️",
}

export default function StyleGrid({
  selectedStyle,
  onStyleSelect,
  className,
}: StyleGridProps) {
  const styles = Object.entries(STYLE_PRESETS) as [StylePresetKey, typeof STYLE_PRESETS[StylePresetKey]][]

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-3", className)}>
      {styles.map(([key, style], index) => {
        const isSelected = selectedStyle === key

        return (
          <button
            key={key}
            onClick={() => onStyleSelect(key)}
            className={cn(
              "flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200",
              isSelected
                ? "border-[#FF7B36] bg-orange-50 shadow-lg scale-105"
                : "border-gray-200 bg-white hover:border-[#00C2FF] hover:shadow-md hover:scale-102"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Style Preview */}
            <div
              className={cn(
                "w-16 h-16 rounded-xl overflow-hidden mb-3 flex items-center justify-center bg-gradient-to-br",
                STYLE_COLORS[key]
              )}
            >
              <span className="text-3xl">{STYLE_EMOJIS[key]}</span>
            </div>

            {/* Style Name */}
            <span className="text-sm font-medium text-center leading-tight text-gray-800">
              {style.name}
            </span>

            {/* Selected Badge */}
            {isSelected && (
              <Badge className="mt-2 bg-gradient-to-r from-[#FF7B36] to-[#6C63FF] text-white text-xs border-0">
                <Heart className="w-3 h-3 mr-1" />
                Selected
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}
