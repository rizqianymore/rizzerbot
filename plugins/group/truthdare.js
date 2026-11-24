const TRUTH_LIST = [
  "Apa rahasia terbesar yang belum pernah kamu ceritakan ke siapa pun?",
  "Siapa orang di grup ini yang paling ingin kamu temui langsung di dunia nyata?",
  "Kapan terakhir kali kamu menangis dan apa penyebabnya?",
  "Pernahkah kamu pura-pura sakit demi menghindari janji atau tugas?",
  "Apa hal paling memalukan yang pernah terjadi saat kamu sedang PDKT?",
  "Siapa kontak di HP-mu yang paling sering kamu stalking profilnya?",
  "Pernahkah kamu berbohong kepada orang tua tentang uang saku/keperluan sekolah?",
  "Jika kamu bisa menghapus satu memori masa lalu, momen apa yang ingin kamu hilangkan?",
  "Apa kebiasaan burukmu saat sendirian di dalam kamar?",
  "Pernahkah kamu menyukai pacar atau gebetan teman sendiri?",
];

const DARE_LIST = [
  "Kirim pesan suara (VN) menyanyikan satu bait lagu anak-anak ke grup ini sekarang!",
  "Ganti bio/status WhatsApp kamu jadi 'Aku fans berat RizzerBot' selama 1 jam!",
  "Ketik kalimat gombalan paling lucu dan tag salah satu anggota grup ini!",
  "Screenshot riwayat chat WhatsApp teratasmu dan kirim ke grup ini!",
  "Kirim foto selfie dengan ekspresi wajah paling aneh ke grup sekarang!",
  "Tulis status WhatsApp: 'Lagi bingung mau nikah sama siapa' selama 30 menit!",
  "Sebutkan 3 hal yang paling kamu tidak sukai dari orang yang chat terakhir sebelum kamu!",
  "Pura-pura telepon temanmu dan bilang bahwa kamu baru saja memenangkan undian 100 juta!",
  "Kirim stiker paling absurd yang kamu punya di koleksi WhatsApp-mu!",
  "Jelaskan arti namamu dengan gaya bahasa penjual obat di pasar!",
];

export default {
  name: "truth",
  aliases: ["dare", "tod"],
  description: "Permainan Truth or Dare untuk meramaikan grup",
  usage: "[truth / dare]",
  category: "Group",
  cooldownMs: 3000,
  run: async (sock, msg, args, { reply, sendTyping }) => {
    await sendTyping();
    const sub = (args[0] || "").toLowerCase();

    const isDare = sub === "dare" || msg.body?.toLowerCase?.().includes("dare");

    if (!sub && !isDare) {

      const choice = Math.random() > 0.5 ? "truth" : "dare";
      if (choice === "truth") {
        const item = TRUTH_LIST[Math.floor(Math.random() * TRUTH_LIST.length)];
        return reply(`*TRUTH (KEJUJURAN)*\n\n${item}\n\n_Jawab dengan jujur di grup ini!_`);
      } else {
        const item = DARE_LIST[Math.floor(Math.random() * DARE_LIST.length)];
        return reply(`*DARE (TANTANGAN)*\n\n${item}\n\n_Lakukan tantangan ini dan buktikan di grup!_`);
      }
    }

    if (isDare) {
      const item = DARE_LIST[Math.floor(Math.random() * DARE_LIST.length)];
      return reply(`*DARE (TANTANGAN)*\n\n${item}\n\n_Lakukan tantangan di atas sekarang!_`);
    } else {
      const item = TRUTH_LIST[Math.floor(Math.random() * TRUTH_LIST.length)];
      return reply(`*TRUTH (KEJUJURAN)*\n\n${item}\n\n_Jawab dengan jujur di grup!_`);
    }
  },
};
