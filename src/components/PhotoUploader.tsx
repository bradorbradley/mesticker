"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PhotoUploaderProps {
  onImageSelect: (file: File, previewUrl: string) => void
  selectedImage?: string | null
  onClear?: () => void
  className?: string
}

export default function PhotoUploader({
  onImageSelect,
  selectedImage,
  onClear,
  className,
}: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndProcessFile = useCallback(
    (file: File) => {
      setError(null)

      // Check file type
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file (JPG, PNG)")
        return
      }

      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be less than 5MB")
        return
      }

      const previewUrl = URL.createObjectURL(file)
      onImageSelect(file, previewUrl)
    },
    [onImageSelect]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const file = e.dataTransfer.files[0]
      if (file) {
        validateAndProcessFile(file)
      }
    },
    [validateAndProcessFile]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        validateAndProcessFile(file)
      }
    },
    [validateAndProcessFile]
  )

  const handleClear = useCallback(() => {
    setError(null)
    if (inputRef.current) {
      inputRef.current.value = ""
    }
    onClear?.()
  }, [onClear])

  if (selectedImage) {
    return (
      <div className={cn("relative", className)}>
        <div className="relative rounded-2xl overflow-hidden border-2 border-[#00C2FF] shadow-lg">
          <img
            src={selectedImage}
            alt="Uploaded photo"
            className="w-full max-h-80 object-contain bg-gray-50"
          />
          <button
            onClick={handleClear}
            className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
        <div className="mt-3 text-center">
          <span className="text-sm text-green-600 font-medium">
            ✓ Photo ready
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "upload-area transition-all duration-200",
          isDragging && "drag-over border-[#00C2FF] bg-blue-50"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
          id="photo-upload"
        />
        <label htmlFor="photo-upload" className="cursor-pointer block">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-[#00C2FF] to-[#0EA5E9] rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="subtitle mb-2">
                {isDragging ? "Drop your photo here" : "Upload your photo"}
              </p>
              <p className="body text-gray-500">
                Drag & drop or click to browse
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Max 5MB • JPG, PNG supported
              </p>
            </div>
          </div>
        </label>
      </div>
      {error && (
        <p className="text-sm text-red-500 text-center">{error}</p>
      )}
    </div>
  )
}
