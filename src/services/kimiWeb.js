import { db } from "@/src/core/database.js";

const BASE_URL = "https://www.kimi.ai";
const CHAT_URL = `${BASE_URL}/apiv2/kimi.gateway.chat.v1.ChatService/Chat`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36";

export function extractKimiToken(rawInput = "") {
  const raw = String(rawInput || "").trim();
  if (!raw) return "";

  // 1. JSON dump from localStorage
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw);
      const token = parsed.access_token || parsed.token || parsed.value || "";
      if (token) return token.trim();
    } catch (_) {}
  }

  // 2. Cookie format or key-value
  const bearerMatch = raw.match(/^(?:authorization:\s*)?bearer\s+([^;\s]+)/i);
  if (bearerMatch) return bearerMatch[1].trim();

  const tokenMatch = raw.match(/(?:access_token|kimi-auth|token)=([^;\s]+)/i);
  if (tokenMatch) return tokenMatch[1].trim();

  // 3. Raw plain JWT token string
  return raw.replace(/^bearer\s+/i, "").replace(/^cookie:\s*/i, "").trim();
}

/**
 * Bungkus pesan JSON ke dalam Connect-RPC framing (5 bytes header + payload)
 */
export function frameConnectMessage(jsonStr) {
  const payload = Buffer.from(jsonStr, "utf-8");
  const header = Buffer.alloc(5);
  header[0] = 0; // 0 = uncompressed
  header.writeUInt32BE(payload.length, 1);
  return Buffer.concat([header, payload]);
}

/**
 * Eksekusi tanya jawab ke Kimi Web (Moonshot AI)
 */
export async function askKimiWeb({
  prompt,
  token = process.env.KIMI_TOKEN || db.data?.settings?.kimiToken || "",
  enableThinking = false,
  signal,
}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Pertanyaan/prompt tidak boleh kosong.");
  }

  const cleanToken = extractKimiToken(token);
  if (!cleanToken) {
    throw new Error(
      "Token Kimi belum dikonfigurasi.\n\n" +
      "👉 *Cara Mengambil Token Kimi (No WAF/Gampang):*\n" +
      "1. Login ke https://www.kimi.ai di browser\n" +
      "2. Buka F12 > Tab Application/Storage > Local Storage > cari `access_token`\n" +
      "3. Pasang via chat: `.ai --token <paste_token_disini>`\n" +
      "*(atau masukkan `KIMI_TOKEN` di file `.env`)*"
    );
  }

  const payloadObj = {
    model: "k2",
    messages: [
      {
        role: "user",
        content: prompt.trim(),
      },
    ],
    reasoning_effort: enableThinking ? "high" : "off",
  };

  const bodyBuffer = frameConnectMessage(JSON.stringify(payloadObj));

  const response = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/connect+json",
      "Connect-Protocol-Version": "1",
      Authorization: `Bearer ${cleanToken}`,
      "User-Agent": USER_AGENT,
      Origin: BASE_URL,
      Referer: `${BASE_URL}/`,
    },
    body: bodyBuffer,
    signal,
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    if (response.status === 401 || response.status === 403) {
      throw new Error("Sesi token Kimi kedaluwarsa atau tidak valid. Silakan perbarui token dari https://www.kimi.ai.");
    }
    throw new Error(`Kimi API Error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);

  let offset = 0;
  let answerContent = "";
  let thinkingContent = "";

  while (offset + 5 <= rawBuffer.length) {
    const len = rawBuffer.readUInt32BE(offset + 1);
    if (offset + 5 + len > rawBuffer.length) break;

    const chunkPayload = rawBuffer.subarray(offset + 5, offset + 5 + len);
    offset += 5 + len;

    if (len > 0) {
      try {
        const msg = JSON.parse(chunkPayload.toString("utf-8"));
        const op = msg.op;
        const mask = msg.mask;
        const block = msg.block || {};

        if (op === "append" || op === "set") {
          if (mask === "block.text.content" || mask === "block.text") {
            const txt = block.text?.content || block.text || "";
            if (typeof txt === "string") answerContent += txt;
          } else if (mask === "block.think.content" || mask === "block.think") {
            const txt = block.think?.content || block.think || "";
            if (typeof txt === "string") thinkingContent += txt;
          }
        }
      } catch (_) {}
    }
  }

  const finalContent = answerContent.trim();
  const finalThinking = thinkingContent.trim();

  if (!finalContent && !finalThinking) {
    throw new Error("Respon Kimi kosong atau sesi token perlu diperbarui.");
  }

  return {
    content: finalContent || "*(Tidak ada balasan)*",
    reasoning: finalThinking,
    model: "kimi-k2.6",
  };
}
