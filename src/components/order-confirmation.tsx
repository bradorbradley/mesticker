"use client";

import { motion } from "framer-motion";
import { CheckCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface OrderConfirmationProps {
  imageUrl: string;
  quantity: number;
  onNewSticker: () => void;
}

export default function OrderConfirmation({
  imageUrl,
  quantity,
  onNewSticker,
}: OrderConfirmationProps) {
  return (
    <div className="flex flex-col items-center gap-6 py-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <CheckCircle size={64} className="text-success" />
      </motion.div>

      <div className="text-center">
        <h2 className="text-2xl font-bold">Order Confirmed!</h2>
        <p className="text-muted-foreground mt-1">
          Your stickers are being printed
        </p>
      </div>

      <Card className="w-full">
        <CardContent className="pt-6 flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Your sticker"
            className="w-20 h-20 rounded-lg object-cover"
          />
          <div>
            <p className="font-semibold flex items-center gap-2">
              <Package size={16} />
              {quantity}x Kiss-Cut Sticker
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              You&apos;ll receive a tracking email when your stickers ship.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={onNewSticker} size="lg" className="w-full">
        Create Another Sticker
      </Button>
    </div>
  );
}
