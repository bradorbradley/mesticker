"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ShoppingCart, Loader2 } from "lucide-react";
import { useCreations } from "@/hooks/use-creations";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { Creation } from "@/types";

export default function GalleryPage() {
  const { data: session } = useSession();
  const { creations: localCreations } = useCreations();
  const [dbCreations, setDbCreations] = useState<Creation[]>([]);
  const [loading, setLoading] = useState(true);

  const isSignedIn = !!session?.user;

  useEffect(() => {
    const load = async () => {
      if (isSignedIn) {
        try {
          const res = await fetch("/api/creations");
          if (res.ok) {
            const data = await res.json();
            setDbCreations(data);
          }
        } catch {}
      }
      setLoading(false);
    };
    load();
  }, [isSignedIn]);

  const creations = isSignedIn ? dbCreations : localCreations;

  return (
    <main className="min-h-dvh">
      <div className="mx-auto max-w-md px-4 py-5 safe-top">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 rounded-full glass-strong shadow-soft flex items-center justify-center"
            >
              <ArrowLeft size={16} />
            </motion.div>
          </Link>
          <h1 className="font-display text-xl font-bold gradient-text">
            My Stickers
          </h1>
          <div className="w-9" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : creations.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">
              No stickers yet! Create your first one.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm btn-gradient shadow-glow"
            >
              Create a Sticker
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {creations.map((creation, i) => (
              <motion.div
                key={creation.id || i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="relative aspect-square rounded-xl overflow-hidden border border-border shadow-soft bg-muted/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creation.generatedImage}
                  alt={`${creation.stylePreset} sticker`}
                  className="w-full h-full object-contain p-2"
                />
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-white text-[10px] font-semibold capitalize">
                    {creation.stylePreset}
                  </p>
                </div>
                {creation.ordered && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                    <ShoppingCart size={10} className="text-white" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
