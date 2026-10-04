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
  operator: "cekoperator",
  hlr: "cekoperator",
  op: "cekoperator",
  cert: "certtrace",
  crt: "certtrace",
  kodepos: "cekkodepos",
  pos: "cekkodepos",
  trx: "cektrx",
  transaksi: "cektrx",
};

export default {
  name: "cek",
  aliases: [],
  description: "Pintasan: cek nim/dosen/nis/bansos/plat/operator/cert/kodepos/trx",
  usage: "<sub> <query>, cth: cek nim 201311413",
  premiumOnly: true,
  category: "OSINT",
  run: async (sock, msg, args, ctx) => {
    const { reply, prefix } = ctx;
    const currentPrefix = prefix || ".";
    const sub = String(args?.[0] || "").toLowerCase();
    const target = SUBCOMMANDS[sub];

    if (!target) {
      return reply(
        `Pilih sub-perintah: nim, dosen, nis, bansos, plat, operator, cert, kodepos, trx\n` +
        `Contoh: \`${currentPrefix}cek nim 201311413\`, \`${currentPrefix}cek dosen 2013119103\`, \`${currentPrefix}cek cert example.com\`, \`${currentPrefix}cek kodepos Kemanggisan\``
      );
    }

    const cmd = commands.get(target);
    if (!cmd) return reply(`Perintah ${target} tidak tersedia.`);
    return cmd.run(sock, msg, (args || []).slice(1), ctx);
  },
};
