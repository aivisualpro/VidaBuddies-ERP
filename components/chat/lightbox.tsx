"use client";

import { useCallback, useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

interface LightboxProps {
  images: { url: string; name?: string }[];
  startIndex: number;
  onClose: () => void;
}

export function Lightbox({ images, startIndex, onClose }: LightboxProps) {
  const [index, setIndex] = useState(startIndex);

  const prev = useCallback(
    () => setIndex((i) => (i > 0 ? i - 1 : images.length - 1)),
    [images.length]
  );
  const next = useCallback(
    () => setIndex((i) => (i < images.length - 1 ? i + 1 : 0)),
    [images.length]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  const current = images[index];
  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <span className="text-white/70 text-sm font-medium">
          {index + 1} / {images.length}
          {current.name && (
            <span className="ml-2 text-white/50">{current.name}</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={current.url}
            download={current.name || "image"}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <img
        src={current.url}
        alt={current.name || ""}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}
    </div>
  );
}
