export default {
  name: "stats",
  description: "Bot statistics",
  usage: "[--all]",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, { reply }) => {
    await reply("Stats feature coming soon");
  },
};
