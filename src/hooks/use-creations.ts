"use client";

import { useState, useEffect, useCallback } from "react";
import { Creation } from "@/types";

const STORAGE_KEY = "mesticker-creations";

export function useCreations() {
  const [creations, setCreations] = useState<Creation[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCreations(JSON.parse(stored));
    } catch {}
  }, []);

  const save = useCallback((items: Creation[]) => {
    setCreations(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, []);

  const addCreation = useCallback(
    (creation: Omit<Creation, "id" | "createdAt">) => {
      const newCreation: Creation = {
        ...creation,
        id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      };
      save([newCreation, ...creations]);
      return newCreation;
    },
    [creations, save]
  );

  const markOrdered = useCallback(
    (id: string) => {
      save(creations.map((c) => (c.id === id ? { ...c, ordered: true } : c)));
    },
    [creations, save]
  );

  return { creations, addCreation, markOrdered };
}
