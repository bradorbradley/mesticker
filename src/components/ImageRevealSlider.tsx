"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface ImageRevealSliderProps {
  beforeSrc: string
  afterSrc: string
  altBefore?: string
  altAfter?: string
  initial?: number
  orientation?: 'horizontal' | 'vertical'
  height?: number
  rounded?: boolean
  showLabels?: boolean
  className?: string
}

export default function ImageRevealSlider({
  beforeSrc,
  afterSrc,
  altBefore = 'Before',
  altAfter = 'After',
  initial = 50,
  orientation = 'horizontal',
  height = 420,
  rounded = true,
  showLabels = true,
  className
}: ImageRevealSliderProps) {
  const [position, setPosition] = useState(initial)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [imagesLoaded, setImagesLoaded] = useState({ before: false, after: false })
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>()

  const isHorizontal = orientation === 'horizontal'
  const allImagesLoaded = imagesLoaded.before && imagesLoaded.after

  // Preload images
  useEffect(() => {
    const beforeImg = new Image()
    const afterImg = new Image()
    
    beforeImg.onload = () => setImagesLoaded(prev => ({ ...prev, before: true }))
    afterImg.onload = () => setImagesLoaded(prev => ({ ...prev, after: true }))
    
    beforeImg.src = beforeSrc
    afterImg.src = afterSrc
  }, [beforeSrc, afterSrc])

  // Convert position to clip-path
  const getClipPath = useCallback(() => {
    if (isHorizontal) {
      return `inset(0 ${100 - position}% 0 0)`
    } else {
      return `inset(${position}% 0 0 0)`
    }
  }, [position, isHorizontal])

  // Handle position updates with RAF
  const updatePosition = useCallback((newPosition: number) => {
    const clampedPosition = Math.max(1, Math.min(99, newPosition))
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = requestAnimationFrame(() => {
      setPosition(clampedPosition)
    })
  }, [])

  // Calculate position from mouse/touch event
  const getPositionFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return position
    
    const rect = containerRef.current.getBoundingClientRect()
    let newPosition: number
    
    if (isHorizontal) {
      newPosition = ((clientX - rect.left) / rect.width) * 100
    } else {
      newPosition = ((clientY - rect.top) / rect.height) * 100
    }
    
    return newPosition
  }, [position, isHorizontal])

  // Animate to position with elastic rebound
  const animateToPosition = useCallback((targetPosition: number) => {
    setIsAnimating(true)
    const clampedTarget = Math.max(1, Math.min(99, targetPosition))
    setPosition(clampedTarget)
    
    setTimeout(() => {
      setIsAnimating(false)
    }, 300)
  }, [])

  // Handle tap to snap to nearest quarter
  const handleTap = useCallback((clientX: number, clientY: number) => {
    if (isDragging) return
    
    const newPosition = getPositionFromEvent(clientX, clientY)
    const snapPoints = [25, 50, 75]
    const nearest = snapPoints.reduce((prev, curr) => 
      Math.abs(curr - newPosition) < Math.abs(prev - newPosition) ? curr : prev
    )
    
    animateToPosition(nearest)
  }, [isDragging, getPositionFromEvent, animateToPosition])

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === handleRef.current || (e.target as Element).closest('[data-handle]')) {
      setIsDragging(true)
      e.preventDefault()
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    e.preventDefault()
    const newPosition = getPositionFromEvent(e.clientX, e.clientY)
    updatePosition(newPosition)
  }, [isDragging, getPositionFromEvent, updatePosition])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      // Add elastic rebound
      setTimeout(() => {
        setPosition(prev => prev) // Trigger rerender for rebound effect
      }, 120)
    }
  }, [isDragging])

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.target === handleRef.current || (e.target as Element).closest('[data-handle]')) {
      setIsDragging(true)
      e.preventDefault()
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return
    e.preventDefault()
    const touch = e.touches[0]
    const newPosition = getPositionFromEvent(touch.clientX, touch.clientY)
    updatePosition(newPosition)
  }, [isDragging, getPositionFromEvent, updatePosition])

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      // Add elastic rebound
      setTimeout(() => {
        setPosition(prev => prev) // Trigger rerender for rebound effect
      }, 120)
    }
  }, [isDragging])

  // Click handler for tapping
  const handleClick = useCallback((e: React.MouseEvent) => {
    handleTap(e.clientX, e.clientY)
  }, [handleTap])

  // Keyboard handlers
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isHorizontal && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return
    if (isHorizontal && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return
    
    let delta = 0
    const step = e.shiftKey ? 10 : 5
    
    if ((isHorizontal && e.key === 'ArrowLeft') || (!isHorizontal && e.key === 'ArrowUp')) {
      delta = -step
    } else if ((isHorizontal && e.key === 'ArrowRight') || (!isHorizontal && e.key === 'ArrowDown')) {
      delta = step
    }
    
    if (delta !== 0) {
      e.preventDefault()
      animateToPosition(position + delta)
    }
  }, [position, isHorizontal, animateToPosition])

  // Global event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove, { passive: false })
      document.addEventListener('touchend', handleTouchEnd)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  if (!afterSrc) {
    return (
      <div className={cn(
        "relative bg-gray-100 flex items-center justify-center",
        rounded && "rounded-2xl",
        className
      )} style={{ height }}>
        <p className="text-gray-500 text-sm">No after image provided</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-white shadow-lg cursor-pointer select-none",
        rounded && "rounded-2xl",
        className
      )}
      style={{ height }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Loading skeleton */}
      {!allImagesLoaded && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading images...</div>
        </div>
      )}

      {/* Before image */}
      <img
        src={beforeSrc}
        alt={altBefore}
        className={cn(
          "absolute inset-0 w-full h-full object-cover",
          !allImagesLoaded && "opacity-0"
        )}
        draggable={false}
      />

      {/* After image with clip-path */}
      <img
        src={afterSrc}
        alt={altAfter}
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-all",
          isAnimating ? "duration-300 ease-in-out" : "duration-0",
          !allImagesLoaded && "opacity-0"
        )}
        style={{
          clipPath: getClipPath(),
          transform: isDragging ? 'translateZ(0)' : 'none' // GPU acceleration
        }}
        draggable={false}
      />

      {/* Labels */}
      {showLabels && allImagesLoaded && (
        <>
          <div className="absolute top-4 left-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-semibold">
            {altBefore}
          </div>
          <div 
            className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-lg text-sm font-semibold transition-opacity duration-200"
            style={{ opacity: position > 20 ? 1 : 0 }}
          >
            {altAfter}
          </div>
        </>
      )}

      {/* Divider line and handle */}
      {allImagesLoaded && (
        <>
          {/* Divider line */}
          <div
            className={cn(
              "absolute bg-white shadow-lg transition-all",
              isAnimating ? "duration-300 ease-in-out" : "duration-0",
              isHorizontal ? "top-0 bottom-0 w-0.5" : "left-0 right-0 h-0.5"
            )}
            style={{
              [isHorizontal ? 'left' : 'top']: `${position}%`,
              transform: isHorizontal ? 'translateX(-50%)' : 'translateY(-50%)'
            }}
          />
          
          {/* Draggable handle */}
          <div
            ref={handleRef}
            data-handle
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-label="Image comparison slider"
            className={cn(
              "absolute bg-white border-2 border-[#00C2FF] shadow-lg flex items-center justify-center transition-all cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-[#00C2FF] focus:ring-offset-2",
              "w-10 h-10 rounded-full",
              isAnimating ? "duration-300 ease-in-out" : "duration-0",
              isDragging && "scale-110 shadow-xl"
            )}
            style={{
              [isHorizontal ? 'left' : 'top']: `${position}%`,
              [isHorizontal ? 'top' : 'left']: '50%',
              transform: isHorizontal 
                ? `translate(-50%, -50%)` 
                : `translate(-50%, -50%)`
            }}
            onKeyDown={handleKeyDown}
          >
            <div className="w-1 h-4 bg-[#00C2FF] rounded-full" />
            {!isHorizontal && <div className="w-4 h-1 bg-[#00C2FF] rounded-full absolute" />}
          </div>
        </>
      )}
    </div>
  )
}

// Usage examples
export function ImageRevealSliderExamples() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Horizontal Slider</h3>
        <ImageRevealSlider
          beforeSrc="/cartoon-presets/inputexample.jpg"
          afterSrc="/cartoon-presets/outputexample.png"
          altBefore="Original"
          altAfter="Simpsons Style"
          height={420}
        />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Vertical Slider</h3>
        <ImageRevealSlider
          beforeSrc="/cartoon-presets/inputexample.jpg"
          afterSrc="/cartoon-presets/outputexample.png"
          altBefore="Original"
          altAfter="Cartoon"
          orientation="vertical"
          height={560}
        />
      </div>
    </div>
  )
}