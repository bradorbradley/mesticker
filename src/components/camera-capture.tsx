"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, ImagePlus, SwitchCamera, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticMedium, hapticHeavy } from "@/lib/haptics";

interface CameraCaptureProps {
  onCapture: (imageBase64: string) => void;
  className?: string;
}

export default function CameraCapture({ onCapture, className }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(mediaStream);
      setCameraActive(true);
    } catch {
      setError("Camera access denied. Please use the gallery upload instead.");
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  useEffect(() => {
    if (stream && cameraActive && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, cameraActive]);

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    hapticHeavy();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    if (facingMode === "user") {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    onCapture(dataUrl);
  }, [facingMode, stopCamera, onCapture]);

  const switchCamera = useCallback(async () => {
    // Stop existing stream without resetting cameraActive
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    const newMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(newMode);
    // Start new stream immediately with new facing mode
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newMode, width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(mediaStream);
    } catch {
      setError("Could not switch camera.");
    }
  }, [stream, facingMode]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            const maxSize = 1080;
            const size = Math.min(img.width, img.height, maxSize);
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext("2d")!;
            const sx = (img.width - Math.min(img.width, img.height)) / 2;
            const sy = (img.height - Math.min(img.width, img.height)) / 2;
            const sSize = Math.min(img.width, img.height);
            ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
            onCapture(canvas.toDataURL("image/jpeg", 0.9));
          };
          img.src = reader.result;
        }
      };
      reader.readAsDataURL(file);
    },
    [onCapture]
  );

  // Active camera viewfinder
  if (cameraActive) {
    return (
      <div className={cn("relative flex flex-col items-center", className)}>
        <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-black shadow-soft-lg">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full h-full object-cover",
              facingMode === "user" && "scale-x-[-1]"
            )}
          />
          {/* Corner guides */}
          <div className="absolute inset-6 pointer-events-none">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/60 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/60 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/60 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/60 rounded-br-lg" />
          </div>

          <button
            onClick={stopCamera}
            className="absolute top-3 right-3 w-9 h-9 rounded-full glass flex items-center justify-center"
          >
            <X size={18} className="text-white" />
          </button>
          <button
            onClick={switchCamera}
            className="absolute top-3 left-3 w-9 h-9 rounded-full glass flex items-center justify-center"
          >
            <SwitchCamera size={18} className="text-white" />
          </button>
        </div>

        {/* Shutter button */}
        <motion.button
          onClick={capturePhoto}
          whileTap={{ scale: 0.9 }}
          className="mt-5 w-[72px] h-[72px] rounded-full gradient-primary shadow-glow flex items-center justify-center"
          aria-label="Take photo"
        >
          <motion.div
            className="w-[60px] h-[60px] rounded-full bg-white"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.button>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  // Prompt to start camera / upload
  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full aspect-[4/3] rounded-3xl overflow-hidden relative"
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 gradient-primary opacity-10" />
        <div className="absolute inset-0 dot-pattern opacity-40" />

        <div className="relative h-full flex flex-col items-center justify-center gap-5 p-6">
          {/* Animated camera icon */}
          <motion.div
            animate={{
              scale: [1, 1.08, 1],
              rotate: [0, 2, -2, 0],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center shadow-glow"
          >
            <Camera size={36} className="text-white" />
          </motion.div>

          <div className="text-center">
            <h2 className="font-display text-xl font-bold">Show us your face</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Take a selfie or upload your best pic
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                hapticMedium();
                startCamera();
              }}
              className="btn-gradient px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-glow"
            >
              <Camera size={18} />
              Camera
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                hapticMedium();
                fileInputRef.current?.click();
              }}
              className="px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 glass-strong shadow-soft border border-border"
            >
              <ImagePlus size={18} className="text-primary" />
              Gallery
            </motion.button>
          </div>
        </div>
      </motion.div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}
