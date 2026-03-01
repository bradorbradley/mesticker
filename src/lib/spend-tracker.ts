/**
 * Daily spend tracking for OpenAI image generations.
 * In-memory tracker with webhook alerting.
 * 
 * Estimated cost per gpt-image-1 generation (high quality, 1024x1024): ~$0.08
 * Adjust ESTIMATED_COST_PER_GEN based on actual billing.
 */

const ESTIMATED_COST_PER_GEN = 0.08; // dollars

// Alert thresholds (in dollars)
const ALERT_THRESHOLDS = [
  { amount: 10, level: "info" as const, message: "100+ generations today" },
  { amount: 25, level: "warning" as const, message: "Spending is elevated" },
  { amount: 50, level: "critical" as const, message: "High spend — auto-throttling enabled" },
];

const AUTO_THROTTLE_THRESHOLD = 50; // dollars — slow down new gens above this

interface DailyStats {
  date: string; // YYYY-MM-DD
  generations: number;
  estimatedSpend: number;
  alertsSent: Set<number>; // thresholds already alerted
  errors: number;
}

let dailyStats: DailyStats = createFreshStats();

function createFreshStats(): DailyStats {
  return {
    date: new Date().toISOString().split("T")[0],
    generations: 0,
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

/**
 * Record a generation and check if alerts need to be sent.
 * Returns alert info if a threshold was crossed.
 */
export function recordGeneration(): {
  stats: { generations: number; estimatedSpend: number; errors: number };
  alert: { level: string; message: string; amount: number } | null;
  throttled: boolean;
} {
  const stats = ensureCurrentDay();
  stats.generations++;
  stats.estimatedSpend = stats.generations * ESTIMATED_COST_PER_GEN;

  // Check if we should auto-throttle
  const throttled = stats.estimatedSpend >= AUTO_THROTTLE_THRESHOLD;

  // Check thresholds
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
      // Don't break — we want the highest crossed threshold
    }
  }

  return {
    stats: {
      generations: stats.generations,
      estimatedSpend: stats.estimatedSpend,
      errors: stats.errors,
    },
    alert,
    throttled,
  };
}

/**
 * Record a generation error.
 */
export function recordError(errorMessage: string): {
  shouldAlert: boolean;
  errorCount: number;
  message: string;
} {
  const stats = ensureCurrentDay();
  stats.errors++;

  // Alert on first error, then every 10th
  const shouldAlert = stats.errors === 1 || stats.errors % 10 === 0;

  return {
    shouldAlert,
    errorCount: stats.errors,
    message: errorMessage,
  };
}

/**
 * Check if generations should be throttled.
 */
export function isThrottled(): boolean {
  const stats = ensureCurrentDay();
  return stats.estimatedSpend >= AUTO_THROTTLE_THRESHOLD;
}

/**
 * Get current daily stats.
 */
export function getDailyStats() {
  const stats = ensureCurrentDay();
  return {
    date: stats.date,
    generations: stats.generations,
    estimatedSpend: stats.estimatedSpend,
    errors: stats.errors,
  };
}
