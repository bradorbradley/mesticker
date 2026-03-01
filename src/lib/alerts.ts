/**
 * Alert system — sends notifications via webhook.
 * Configure ALERT_WEBHOOK_URL in env to receive alerts.
 * 
 * Supports:
 * - Generic webhook (POST JSON)
 * - Telegram Bot API (if URL contains api.telegram.org)
 * 
 * For Telegram, set:
 *   ALERT_WEBHOOK_URL=https://api.telegram.org/bot<TOKEN>/sendMessage
 *   ALERT_CHAT_ID=<your-chat-id>
 */

interface AlertPayload {
  level: "info" | "warning" | "critical" | "error";
  title: string;
  message: string;
  stats?: Record<string, unknown>;
}

export async function sendAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  const chatId = process.env.ALERT_CHAT_ID;

  if (!webhookUrl) {
    console.warn("[ALERT]", payload.level, payload.title, payload.message);
    return;
  }

  const emoji = {
    info: "ℹ️",
    warning: "⚠️",
    critical: "🚨",
    error: "❌",
  }[payload.level];

  try {
    if (webhookUrl.includes("api.telegram.org") && chatId) {
      // Telegram Bot API
      const text = [
        `${emoji} **MeSticker Alert: ${payload.title}**`,
        "",
        payload.message,
        "",
        payload.stats
          ? Object.entries(payload.stats)
              .map(([k, v]) => `• ${k}: ${v}`)
              .join("\n")
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      });
    } else {
      // Generic webhook
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          timestamp: new Date().toISOString(),
          source: "mesticker",
        }),
      });
    }
  } catch (error) {
    console.error("[ALERT] Failed to send alert:", error);
  }
}
