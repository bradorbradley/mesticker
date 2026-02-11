"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, ImagePlus, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
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
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Center-crop to square
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;

    // Mirror for front camera
    if (facingMode === "user") {
      ctx.translate(size, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    onCapture(dataUrl);
  }, [facingMode, stopCamera, onCapture]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode((m) => (m === "user" ? "environment" : "user"));
  }, [stopCamera]);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (cameraActive) startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          // Resize to max 1080px square
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

  if (cameraActive) {
    return (
      <div className={cn("relative flex flex-col items-center", className)}>
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-black">
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
          <button
            onClick={stopCamera}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
          >
            <X size={18} />
          </button>
          <button
            onClick={switchCamera}
            className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
          >
            <SwitchCamera size={18} />
          </button>
        </div>
        <button
          onClick={capturePhoto}
          className="mt-4 w-16 h-16 rounded-full border-4 border-primary bg-white shadow-lg active:scale-95 transition-transform flex items-center justify-center"
          aria-label="Take photo"
        >
          <div className="w-12 h-12 rounded-full bg-primary" />
        </button>
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="w-full aspect-square rounded-2xl bg-muted border-2 border-dashed border-border flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Camera size={32} className="text-primary" />
        </div>
        <p className="text-center text-muted-foreground text-sm">
          Take a selfie or upload a photo
        </p>
        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}
        <div className="flex gap-3">
          <Button onClick={startCamera} size="lg">
            <Camera size={18} className="mr-2" />
            Camera
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus size={18} className="mr-2" />
            Gallery
          </Button>
        </div>
      </div>
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
