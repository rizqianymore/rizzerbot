function ipToLong(ip) {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function longToIp(long) {
  return [(long >>> 24) & 255, (long >>> 16) & 255, (long >>> 8) & 255, long & 255].join(".");
}

export default {
  name: "subnet",
  aliases: ["ipcalc", "cidr", "subnets"],
  description: "Kalkulator IP Subnet & CIDR (Network, Broadcast, Usable Range, & Total Hosts)",
  usage: "<ip/cidr>",
  category: "Tools",
  cooldownMs: 3000,

  run: async (sock, msg, args, { reply, prefix }) => {
    const p = prefix || ".";
    const input = args.join(" ").trim();

    if (!input) {
      return reply(
        `┌── IP SUBNET & CIDR CALCULATOR\n` +
          `│ Hitung Network ID, Broadcast, Subnet Mask, dan Usable Range.\n` +
          `└──\n\n` +
          `Format: ${p}subnet <ip>/<prefix>\n` +
          `Contoh: ${p}subnet 192.168.1.50/24\n` +
          `Contoh: ${p}subnet 10.0.0.1/16`
      );
    }

    const [ip, cidrStr] = input.split("/");
    const cidr = Number(cidrStr);

    const ipRegex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    if (!ipRegex.test(ip) || isNaN(cidr) || cidr < 1 || cidr > 32) {
      return reply(`❌ Format IP/CIDR tidak valid. Masukkan format seperti \`192.168.1.0/24\` (CIDR 1-32).`);
    }

    const maskLong = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
    const wildcardLong = ~maskLong >>> 0;
    const ipLong = ipToLong(ip);
    const networkLong = (ipLong & maskLong) >>> 0;
    const broadcastLong = (networkLong | wildcardLong) >>> 0;

    const totalHosts = Math.pow(2, 32 - cidr);
    const usableHosts = cidr >= 31 ? (cidr === 31 ? 2 : 1) : totalHosts - 2;

    const firstUsable = cidr >= 31 ? networkLong : networkLong + 1;
    const lastUsable = cidr >= 31 ? broadcastLong : broadcastLong - 1;

    let text =
      `┌── IP SUBNET RESULT\n` +
      `│ Alamat Input : ${input}\n` +
      `│ CIDR Prefix  : /${cidr}\n` +
      `└──\n\n` +
      `├── Network ID   : ${longToIp(networkLong)}\n` +
      `├── Broadcast    : ${longToIp(broadcastLong)}\n` +
      `├── Subnet Mask  : ${longToIp(maskLong)}\n` +
      `├── Wildcard     : ${longToIp(wildcardLong)}\n` +
      `├── Total IP     : ${totalHosts.toLocaleString("id-ID")}\n` +
      `├── Host Aktif   : ${usableHosts.toLocaleString("id-ID")} host\n` +
      `└── Usable Range : ${longToIp(firstUsable)} - ${longToIp(lastUsable)}\n\n` +
      `_Tipe Alamat: ${(ipLong >= ipToLong("10.0.0.0") && ipLong <= ipToLong("10.255.255.255")) || (ipLong >= ipToLong("172.16.0.0") && ipLong <= ipToLong("172.31.255.255")) || (ipLong >= ipToLong("192.168.0.0") && ipLong <= ipToLong("192.168.255.255")) ? "Private IP (RFC 1918)" : "Public IP"}_`;

    return reply(text);
  },
};
