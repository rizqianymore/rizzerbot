export const settings = {

    botName: "Rizzer Bot",
    ownerName: "Pentagon",
    ownerNumber: "6287847566690",
    pairingNumber: "6287847566690",
    ownerNumbers: [],
    premiumNumbers: [],
    adminNumbers: [],
    usePairingCode: true,

    public: false,
    prefix: ".",
    // Command yang boleh dipakai orang TAK terdaftar (bukan owner/admin/premium).
    // Selain daftar ini: diabaikan total (tanpa balasan, tanpa tulis database).
    publicCommands: ["sewa", "owner", "ping", "uptime", "menu", "help", "panduan"],
    // true = penolakan akses (bukan owner/admin/premium) dilakukan diam-diam
    // agar bot tidak bisa "disentuh". false = balas pesan ❌ seperti dulu.
    silentDeny: true,

    autoRead: false,
    autoOnline: false,
    cooldownTime: 0,
    responseDelay: 0,

    antiBotLuar: true, // abaikan perintah dari nomor bot luar yang terdaftar
    botNumbers: [], // daftar nomor bot luar, contoh: ["62812xxxx"]
    antiVirtex: true, // tolak pesan super panjang / crash
    maxMessageLength: 5000,
    antiBurst: true, // tolak spam burst: >6 perintah / 10 detik
    antilinkExtra: true, // perluas pola link selain invite grup

    stickerPackName: "Rizzer Bot Stickers",
    stickerAuthor: "Rizzer Bot [Private]",
    image: 'assets/image/banner.png',
    linkTitle: "Rizzer Bot",
    linkBody: "Simple & Clean WhatsApp Bot",
    linkUrl: "https://whatsapp.com/",
    linkImage: "assets/image/banner.png",

    // Saluran / Channel (Newsletter) Management
    channelJid: "",
    channelName: "Official Channel",
    autoForwardTrxToChannel: false,

    // Data siswa via Google Apps Script (?query=<nis>&mode=nis, 302 -> googleusercontent)
    // Bisa dioverride via env SISWA_API_URL tanpa edit kode.
    siswaApiUrl: "https://script.google.com/macros/s/AKfycbzFd_CjY2y6jnle9hmlp71nyxy8mscur2tWF8gz773-IthSVkKF3v3Px3viPhPcA4U2mw/exec",

    // QRIS Dinamis & Static Settings
    qrisString: "00020101021126570011ID.DANA.WWW011893600915303511630202090351163020303UMI51440014ID.CO.QRIS.WWW0215ID10265955012340303UMI5204899953033605802ID5912Rizzer Cloud6013JAKARTA BARAT610511850630425C2",
    qrisMerchantName: "Rizzer Cloud",
    qrisCity: "JAKARTA BARAT",
};
