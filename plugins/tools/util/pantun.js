const PANTUN_LIST = [
  "Beli mangga ke pasar raya,\nJangan lupa membeli duku.\nKalau ingin hidup bahagia,\nTuntutlah ilmu sepanjang waktu.",
  "Pergi berlayar ke pulau seberang,\nMembawa bekal buah delima.\nBudi pekerti dikenang orang,\nWalau raga sudah tiada.",
  "Pagi hari makan ketan,\nMinumnya teh manis hangat.\nWalau rintangan di hadapan,\nTetap melangkah penuh semangat.",
  "Jalan-jalan ke kota Blitar,\nJangan lupa membeli sukun.\nJika kamu ingin pintar,\nBelajarlah dengan tekun.",
  "Bunga mawar bunga melati,\nTumbuh indah di kebun kakek.\nBiar kamu sering disakiti,\nTetaplah tersenyum jangan mewek.",
  "Burung merpati terbang melayang,\nHinggap sebentar di atas pagar.\nKepada kawan saling menyayang,\nHidup rukun hatipun segar.",
];

export default {
  name: "pantun",
  aliases: ["pantunjawa", "pantunjenaka", "berpantun"],
  description: "Generator pantun nusantara (nasehat, jenaka, dan motivasi) rima a-b-a-b",
  usage: "",
  category: "Tools & Media",
  cooldownMs: 2000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const item = PANTUN_LIST[Math.floor(Math.random() * PANTUN_LIST.length)];

    const text = `*PANTUN NUSANTARA* 🪕🌿\n\n` + `${item}\n\n` + `_Cakep!_ ✨`;

    return reply(text);
  },
};
