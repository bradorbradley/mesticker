/**
 * Daily spend tracking for image generations.
 * In-memory tracker with webhook alerting.
 *
 * Cost per generation:
 *   Preview (gpt-image-1-5 low):  $0.009
 *   Print   (gpt-image-1-5 high): $0.133
 *   Variations set (6x preview):  $0.054
 */

import { COST_PREVIEW, COST_PRINT } from "@/lib/generation";

// Alert thresholds (in dollars)
const ALERT_THRESHOLDS = [
  { amount: 10, level: "info" as const, message: "Elevated generation volume" },
  { amount: 25, level: "warning" as const, message: "Spending is elevated" },
  { amount: 50, level: "critical" as const, message: "High spend — auto-throttling enabled" },
];

const AUTO_THROTTLE_THRESHOLD = 50; // dollars

interface DailyStats {
  date: string;
  previewGens: number;
  printGens: number;
  estimatedSpend: number;
  alertsSent: Set<number>;
  errors: number;
}

let dailyStats: DailyStats = createFreshStats();

function createFreshStats(): DailyStats {
  return {
    date: new Date().toISOString().split("T")[0],
    previewGens: 0,
    printGens: 0,
    estimatedSpend: 0,
    alertsSent: new Set(),
    errors: 0,
  };
}

function ensureCurrentDay(): DailyStats {
  const today = new Date().toISOString().split("T")[0];
  if (dailyStats.date !== today) {
    dailyStats = createFreshStats();
  }
  return dailyStats;
}

export function recordGeneration(tier: "preview" | "print" = "preview"): {
  stats: { generations: number; estimatedSpend: number; errors: number };
  alert: { level: string; message: string; amount: number } | null;
  throttled: boolean;
} {
  const stats = ensureCurrentDay();
  const cost = tier === "print" ? COST_PRINT : COST_PREVIEW;

  if (tier === "print") {
    stats.printGens++;
  } else {
    stats.previewGens++;
  }
  stats.estimatedSpend += cost;

  const throttled = stats.estimatedSpend >= AUTO_THROTTLE_THRESHOLD;

  let alert: { level: string; message: string; amount: number } | null = null;
  for (const threshold of ALERT_THRESHOLDS) {
    if (
      stats.estimatedSpend >= threshold.amount &&
      !stats.alertsSent.has(threshold.amount)
    ) {
      stats.alertsSent.add(threshold.amount);
      alert = {
        level: threshold.level,
        message: threshold.message,
        amount: threshold.amount,
      };
    }
  }

  return {
    stats: {
      generations: stats.previewGens + stats.printGens,
      estimatedSpend: stats.estimatedSpend,
      errors: stats.errors,
    },
    alert,
    throttled,
  };
}

export function recordError(errorMessage: string): {
  shouldAlert: boolean;
  errorCount: number;
  message: string;
} {
  const stats = ensureCurrentDay();
  stats.errors++;
  const shouldAlert = stats.errors === 1 || stats.errors % 10 === 0;
  return { shouldAlert, errorCount: stats.errors, message: errorMessage };
}

export function isThrottled(): boolean {
  const stats = ensureCurrentDay();
  return stats.estimatedSpend >= AUTO_THROTTLE_THRESHOLD;
}

export function getDailyStats() {
  const stats = ensureCurrentDay();
  return {
    date: stats.date,
    previewGens: stats.previewGens,
    printGens: stats.printGens,
    generations: stats.previewGens + stats.printGens,
    estimatedSpend: stats.estimatedSpend,
    errors: stats.errors,
  };
}
