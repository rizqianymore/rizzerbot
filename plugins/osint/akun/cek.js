import { commands } from "@/src/core/loader.js";

const SUBCOMMANDS = {
  nim: "ceknim",
  mahasiswa: "ceknim",
  student: "ceknim",
  dosen: "cekdosen",
  nidn: "cekdosen",
  nis: "ceknis",
  siswa: "ceknis",
  bansos: "cekbansos",
  plat: "cekplat",
  nopol: "cekplat",
  samsat: "cekplat",
  operator: "cekoperator",
  hlr: "cekoperator",
  op: "cekoperator",
  hp: "cekoperator",
  cert: "certtrace",
  crt: "certtrace",
  kodepos: "cekkodepos",
  pos: "cekkodepos",
  gtk: "cekgtk",
  guru: "cekgtk",
  nuptk: "cekgtk",
  sekolah: "ceksekolah",
  npsn: "ceksekolah",
  kampus: "cekkampus",
  pt: "cekkampus",
  halal: "cekhalal",
  bpom: "cekbpom",
  alkes: "cekinfoalkes",
  nakes: "ceknakes",
  kki: "ceknakes",
  str: "ceknakes",
  isbn: "cekisbn",
  buku: "cekisbn",
  nik: "nikparse",
  geocode: "geocode",
  alamat: "geocode",
};

export default {
  name: "cek",
  aliases: [],
  description: "Pintasan: cek nim/dosen/nis/bansos/plat/operator/cert/kodepos/gtk/sekolah/kampus/halal/bpom/alkes/nakes/isbn/nik/geocode",
  usage: "<sub> <query>, cth: cek nim 201311413 | cek halal produk | cek nik 3171...",
  premiumOnly: true,
  cooldownMs: 8000,
  category: "OSINT",
  run: async (sock, msg, args, ctx) => {
    const { reply, prefix } = ctx;
    const currentPrefix = prefix || ".";
    const sub = String(args?.[0] || "").toLowerCase();
    const target = SUBCOMMANDS[sub];

    if (!target) {
      return reply(
        `*CEK — PINTASAN OSINT*\n\n` +
          `Pilih sub-perintah:\n` +
          `• Edu: \`nim/mahasiswa\`, \`dosen/nidn\`, \`nis/siswa\`, \`gtk/guru\`, \`sekolah/npsn\`, \`kampus/pt\`\n` +
          `• Sipil: \`nik\`, \`halal\`, \`bpom\`, \`alkes\`, \`nakes/kki\`, \`isbn/buku\`, \`plat/nopol\`, \`operator/hlr\`, \`kodepos/pos\`, \`bansos\`, \`geocode/alamat\`\n` +
          `• Net: \`cert/crt\`\n\n` +
          `Contoh:\n` +
          `• \`${currentPrefix}cek nim 201311413\`\n` +
          `• \`${currentPrefix}cek halal mie instan\`\n` +
          `• \`${currentPrefix}cek nik 3171010101010001\`\n` +
          `• \`${currentPrefix}cek cert example.com\``
      );
    }

    const cmd = commands.get(target);
    if (!cmd) return reply(`Perintah ${target} tidak tersedia.`);
    return cmd.run(sock, msg, (args || []).slice(1), ctx);
  },
};
