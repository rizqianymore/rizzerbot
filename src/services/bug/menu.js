// src/services/bug/menu.js — builder + pengirim tampilan menu bug (dipakai bugmenu.js & .menu bug).
// Diekstrak dari hasil_date.js case "bugmenu" (teks & tombol identik, .c1dekk dibuang mengikuti penghapusan pluginnya).
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { proto, prepareWAMessageMedia, generateWAMessageFromContent } from "baileys";
import { sleep } from "./helpers.js";

export const BUG_MENU_REACTS = ["🌞", "🔥", "🦠", "💦"];

export function buildBugMenuText(pushName) {
  return `> hello welcome to use our bot script please use it wisely and responsibly and don't misuse it thank you ${pushName} 

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
}

export function buildBugFlowButtons() {
  return [
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }),
    },
    {
      name: "call_permission_request",
      buttonParamsJson: JSON.stringify({ has_multiple_buttons: true }),
    },
    {
      name: "single_select",
      buttonParamsJson: JSON.stringify({
        title: "ᴍᴇɴᴜ sᴄʀɪᴘᴛs",
        sections: [
          {
            title: "ᴍᴇɴᴜ sᴄʀɪᴘᴛs",
            highlight_label: "recommend",
            rows: [
              { title: "𝐁𝐯𝐠 𝐄𝐱𝐩𝐥𝐨𝐢𝐭", description: "ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ( ʙᴜɢ ᴍᴇɴᴜ )", id: "bugmenu" },
              { title: "𝐓𝐨𝐥𝐬 𝐌𝐞𝐧𝐮", description: "ᴍᴇɴᴀᴍᴘɪʟᴋᴀɴ ( ᴛᴏʟs ᴍᴇɴᴜ )", id: "tolsmenu" },
            ],
          },
        ],
        has_multiple_buttons: true,
      }),
    },
    {
      name: "cta_url",
      buttonParamsJson: JSON.stringify({
        display_text: "#sᴀʟᴜʀᴀɴ ᴅᴇᴠᴇʟᴏᴘᴇʀ",
        url: "https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136",
        merchant_url: "https://whatsapp.com/channel/0029Vb8wNGL7j6g785wX4136",
      }),
    },
  ];
}

export function buildBugMessageParams() {
  return JSON.stringify({
    limited_time_offer: {
      text: "Xya - MD",
      url: "t.me/MexxTampan",
      copy_code: "MexxModss",
      expiration_time: Date.now() * 1000,
    },
    bottom_sheet: {
      in_thread_buttons_limit: 2,
      divider_indices: [1, 2, 3, 4, 5, 999],
      list_title: "ʙᴜᴛᴛᴏɴ ᴍᴇɴᴜ",
      button_title: "ʙᴜᴛᴛᴏɴ ᴍᴇɴᴜ",
    },
    tap_target_configuration: {
      title: " X ",
      description: "bomboclard",
      canonical_url: "https://t.me/MexxTampan",
      domain: "shop.example.com",
      button_index: 0,
    },
  });
}

function findFirstExisting(candidates) {
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null;
}

function buildFakeQuote(m, thumbBuffer) {
  const fakeKey = { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" };
  const fakeOrder = {
    orderId: "2029",
    thumbnail: thumbBuffer,
    itemCount: "999999999 ",
    status: "INQUIRY",
    surface: "CATALOG",
    message: "MexxModss ( ¡ )",
    token: "AR6xBKbXZn0Xwmu76Ksyd7rnxI+Rx87HfinVlW4lwXa6JA==",
  };
  return {
    key: fakeKey,
    message: { orderMessage: fakeOrder },
    contextInfo: {
      mentionedJid: [m.sender || m.key?.participant || ""],
      forwardingScore: 999,
      isForwarded: true,
    },
  };
}

function convertAudioToVoiceNote(audioPath) {
  return new Promise((resolve) => {
    const outputPath = path.join(os.tmpdir(), `tmp_vn_${Date.now()}.ogg`);
    exec(
      `ffmpeg -i "${audioPath}" -c:a libopus -b:a 48k -vbr on -compression_level 10 -frame_duration 60 -application voip "${outputPath}" -y`,
      (err) => {
        if (err) {
          console.error("gagal convert audio ke vn:", err);
          resolve(null);
        } else {
          try {
            const buffer = fs.readFileSync(outputPath);
            fs.unlinkSync(outputPath);
            resolve(buffer);
          } catch (_) {
            resolve(null);
          }
        }
      },
    );
  });
}

async function sendBugVoiceNote(sock, chatJid, quotedMsg) {
  const audioPath = "./sound.mp3";
  if (!fs.existsSync(audioPath)) return;
  const voiceNote = await convertAudioToVoiceNote(audioPath);
  if (voiceNote) {
    await sock.sendMessage(
      chatJid,
      { audio: voiceNote, mimetype: "audio/ogg; codecs=opus", ptt: true },
      { quoted: quotedMsg },
    );
  } else {
    console.log("audio dikirim sebagai mp3 biasa!!");
    await sock.sendMessage(
      chatJid,
      {
        audio: fs.readFileSync(audioPath),
        mimetype: "audio/mpeg",
        fileName: "music.mp3",
        ptt: false,
      },
      { quoted: quotedMsg },
    );
  }
}

/** Kirim tampilan menu bug lengkap: reacts → interaktif (video bila aset ada) → VN. */
export async function sendBugMenu(sock, msg) {
  const chatJid = msg.key.remoteJid;
  const pushName = msg.pushName || "No Name";
  const menuText = buildBugMenuText(pushName);

  for (const react of BUG_MENU_REACTS) {
    await sock.sendMessage(chatJid, { react: { text: react, key: msg.key } });
    await sleep(250);
  }

  const thumbPath = findFirstExisting(["./System/Thumb.jpg", "assets/image/banner.png"]);
  const thumbBuffer = thumbPath ? fs.readFileSync(thumbPath) : Buffer.alloc(0);
  const fakeQuote = buildFakeQuote(msg, thumbBuffer);

  const videoPath = findFirstExisting(["./System/menu.mp4"]);
  const videoThumbPath = findFirstExisting(["./System/menu-thumbnail.jpg"]);

  let interactiveMsg;
  if (videoPath && videoThumbPath) {
    const media = await prepareWAMessageMedia(
      {
        video: { url: videoPath },
        gifPlayback: true,
        jpegThumbnail: fs.readFileSync(videoThumbPath),
      },
      { upload: sock.waUploadToServer },
    );
    interactiveMsg = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          interactiveMessage: proto.Message.InteractiveMessage.fromObject({
            body: proto.Message.InteractiveMessage.Body.fromObject({ text: menuText }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({
              text: "`© ᴄᴏᴘʏʀɪɢʜᴛ ʙʏ ᴍᴇxxᴍᴏᴅss`",
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
              title: "",
              hasMediaAttachment: true,
              videoMessage: media.videoMessage,
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
              messageParamsJson: buildBugMessageParams(),
              buttons: buildBugFlowButtons(),
            }),
          }),
        },
      },
    });
  } else {
    // Fallback bila aset ./System/* belum ada: interaktif teks tanpa header video.
    interactiveMsg = proto.Message.fromObject({
      viewOnceMessage: {
        message: {
          interactiveMessage: proto.Message.InteractiveMessage.fromObject({
            body: proto.Message.InteractiveMessage.Body.fromObject({ text: menuText }),
            footer: proto.Message.InteractiveMessage.Footer.fromObject({
              text: "`© ᴄᴏᴘʏʀɪɢʜᴛ ʙʏ ᴍᴇxxᴍᴏᴅss`",
            }),
            header: proto.Message.InteractiveMessage.Header.fromObject({
              title: "",
              hasMediaAttachment: false,
            }),
            nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
              messageParamsJson: buildBugMessageParams(),
              buttons: buildBugFlowButtons(),
            }),
          }),
        },
      },
    });
  }

  const msgContent = generateWAMessageFromContent(chatJid, interactiveMsg, {
    userJid: sock.user.id,
    quoted: thumbBuffer.length ? fakeQuote : msg,
  });
  await sock.relayMessage(chatJid, msgContent.message, { messageId: msgContent.key.id });

  await sleep(1000);
  await sendBugVoiceNote(sock, chatJid, msg);
}
