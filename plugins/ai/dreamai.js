// plugins/ai/dreamai.js — perintah "dream" (txt2img multi-model, TANPA API key).
// Backend: DreamFace tools (login tamu otomatis + polling work_session).
import crypto from "crypto";

const BASE = "https://tools.dreamfaceapp.com/dw-server";

const MODELS = [
  { id: 1, name: "Seedream 4.5", desc: "Photorealism + prompt understanding terbaik.", param: { model: "see-dream-45", template_id: "WEB-SEE_DREAM_45", releation_id: "ri05016", play_types: ["SEE_DREAM_45", "TEXT_TO_IMAGE"], output: { count: 2, width: 2560, height: 1920, resolution: "2K", ratio: "4:3" } } },
  { id: 2, name: "Nano Banana Pro", desc: "Model flagship kualitas tinggi.", param: { model: "gemini3", template_id: "WEB-NANO_PRO", releation_id: "ri05015", play_types: ["NANO_PRO", "TEXT_TO_IMAGE"], output: { count: 1, width: 1280, height: 960, resolution: "1K", ratio: "4:3" } } },
  { id: 3, name: "Illustrious-SDXL", desc: "Spesialis anime/ilustrasi.", param: { model: "anime", template_id: "WEB-ANIME", releation_id: "ri05006", play_types: ["AIGC", "ANIME", "TEXT_TO_IMAGE"], output: { count: 1, width: 1280, height: 960, resolution: "1K", ratio: "4:3" } } },
  { id: 4, name: "Seedream 4.0", desc: "High-res dengan value terbaik.", param: { model: "see-dream", template_id: "WEB-SEE_DREAM", releation_id: "ri05004", play_types: ["SEE_DREAM", "TEXT_TO_IMAGE"], output: { count: 2, width: 1280, height: 960, resolution: "1K", ratio: "4:3" } } },
  { id: 5, name: "Nano Banana", desc: "Konsistensi terkuat, 1:1.", param: { model: "gemini", template_id: "WEB-NANO_BANANA", releation_id: "ri05010", play_types: ["NANO", "TEXT_TO_IMAGE"], output: { count: 1, width: 1024, height: 1024, resolution: "1K", ratio: "1:1" } } },
  { id: 6, name: "Flux Kontext Pro", desc: "Konsistensi edit gambar kuat.", param: { model: "flux-kontext-pro", template_id: "WEB-BFL", releation_id: "ri05013", play_types: ["BFL", "TEXT_TO_IMAGE"], output: { count: 2, width: 1024, height: 1024, resolution: "1K", ratio: "1:1" } } },
];

const baseHeaders = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36",
  Accept: "application/json",
  origin: "https://tools.dreamfaceapp.com",
  referer: "https://tools.dreamfaceapp.com/tools/ai-image?pageType=seo&pageId=68cd393c874ed100018dbbb1",
  "sec-ch-ua-platform": '"Android"',
  "sec-ch-ua": '"Brave";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  "sec-ch-ua-mobile": "?1",
  Cookie: "i18n_redirected=en",
};

const rnd = (n) => crypto.randomBytes(n).toString("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, body, token, clientId) {
  const headers = { ...baseHeaders };
  if (token) headers.token = token;
  if (clientId) headers["client-id"] = clientId;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.status_code !== "THS12140000000") throw new Error(j.status_msg || "DreamFace API Error");
  return j.data;
}

async function generateImage(prompt, modelConfig) {
  const email = `df_${rnd(5)}@illubd.com`;
  const userId = rnd(16);
  const clientId = rnd(16);
  const login = await post(`${BASE}/user/login`, {
    password: "dancow000", user_id: userId, third_id: email, third_platform: "EMAIL",
    register_source: "seo", platform_type: "MOBILE", tenant_name: "dream_face",
    platformType: "MOBILE", tenantName: "dream_face",
  }, null, clientId);
  await post(`${BASE}/user/save_user_login`, {
    device_system: "PC-Mobile", device_name: "PC-Mobile", user_id: userId,
    account_id: login.account_id, app_version: "4.7.1", time_zone: 7,
    platform_type: "MOBILE", tenant_name: "dream_face",
    platformType: "MOBILE", tenantName: "dream_face",
  }, login.token, clientId);
  await sleep(1000);
  await post(`${BASE}/rights/get_free_rights`, {
    user_id: userId, account_id: login.account_id, platform_type: "MOBILE",
    tenant_name: "dream_face", platformType: "MOBILE", tenantName: "dream_face",
  }, login.token, clientId);
  await post(`${BASE}/credits/get_remaining_credits`, {
    account_id: login.account_id, user_id: userId, time_zone: "Asia/Jakarta",
    platform_type: "MOBILE", tenant_name: "dream_face",
    platformType: "MOBILE", tenantName: "dream_face",
  }, login.token, clientId);
  await sleep(1000);
  const { param } = modelConfig;
  await post(`${BASE}/task/v2/submit`, {
    ext_info: { sing_title: prompt.slice(0, 50), model: param.model },
    media: { texts: [{ text: prompt }], images: [], audios: [], videos: [] },
    output: param.output,
    template: { releation_id: param.releation_id, template_id: param.template_id, play_types: param.play_types },
    user: { user_id: userId, account_id: login.account_id, app_version: "4.7.1" },
    work_type: "AI_IMAGE", create_work_session: true,
    platform_type: "MOBILE", tenant_name: "dream_face",
    platformType: "MOBILE", tenantName: "dream_face",
  }, login.token, clientId);
  for (let i = 0; i < 60; i++) {
    const ws = await post(`${BASE}/work_session/list`, {
      user_id: userId, account_id: login.account_id, page: 1, size: 5,
      session_type: "AI_IMAGE", platform_type: "MOBILE", tenant_name: "dream_face",
      platformType: "MOBILE", tenantName: "dream_face",
    }, login.token, clientId);
    const s = ws.list?.[0];
    if (s?.session_status === 200 && s?.work_details?.[0]?.image_urls?.length) {
      return s.work_details[0].image_urls;
    }
    if (s?.session_status < 0 && s?.session_status !== -1) {
      throw new Error(`Task ditolak (status: ${s.session_status})`);
    }
    await sleep(3000);
  }
  throw new Error("Generate timeout (3 menit). Coba lagi.");
}

function modelList(prefix) {
  const list = MODELS.map((m) => `${m.id}. ${m.name} - ${m.desc}`).join("\n");
  return (
    `*DREAM AI*\n\n` +
    `Penggunaan: *${prefix}dream <nomor_model> <prompt>*\n\n` +
    `Daftar model:\n${list}\n\n` +
    `Contoh: *${prefix}dream 1 kucing astronot di luar angkasa*`
  );
}

export default {
  name: "dream",
  aliases: ["dreamai", "dreamimg"],
  description: "Generate gambar AI multi-model (tanpa API key)",
  usage: "<nomor_model> <prompt>",
  premiumOnly: true,
  category: "AI",
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    await sendTyping();
    const text = args.join(" ").trim();
    if (!text) return reply(modelList(prefix));

    const [num, ...promptArr] = text.split(/\s+/);
    const prompt = promptArr.join(" ").trim();
    const selected = MODELS.find((m) => String(m.id) === String(num));
    if (!selected || !prompt) return reply(modelList(prefix));

    const react = (emoji) =>
      sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});
    await react("🎨");
    await reply(`Membuat gambar dengan *${selected.name}*...`);

    try {
      const imgs = await generateImage(prompt, selected);
      await react("✅");
      for (const url of imgs) {
        await sock.sendMessage(
          msg.key.remoteJid,
          { image: { url }, caption: `*DREAM AI*\nModel: ${selected.name}\nPrompt: ${prompt.slice(0, 200)}` },
          { quoted: msg }
        ).catch(() => reply(`Link gambar: ${url}`));
      }
    } catch (err) {
      await react("❌");
      await reply(`*DREAM AI GAGAL*\n${err?.message || "Terjadi kesalahan."}`);
    }
  },
};
