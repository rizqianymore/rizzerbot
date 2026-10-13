export default {
  name: "leave",
  description: "Leave current group",
  usage: "",
  ownerOnly: true,
  category: "Owner",
  run: async (sock, msg, _args, { _reply }) => {
    await sock.groupLeave(msg.key.remoteJid);
  },
};
