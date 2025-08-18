'use client'

import React, { useRef, useState } from 'react';

interface UploadSelfieProps {
  onImageSelect: (file: File | null) => void;
}

const UploadSelfie: React.FC<UploadSelfieProps> = ({ onImageSelect }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onImageSelect(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        ref={fileInputRef}
        className="hidden"
        id="selfie-upload"
      />
      <button
        type="button"
        className="px-4 py-2 bg-primary text-white rounded shadow hover:bg-primary/80"
        onClick={() => fileInputRef.current?.click()}
      >
        Upload Selfie
      </button>
      {preview && (
        <img
          src={preview}
          alt="Selfie Preview"
          className="w-32 h-32 object-cover rounded-full border-2 border-primary"
        />
      )}
    </div>
  );
};

export default UploadSelfie; 