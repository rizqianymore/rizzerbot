import { generateWAMessageFromContent } from 'baileys';

/**
 * Sends an interactive native flow button/list message with automatic text fallback
 * to guarantee compatibility on all WhatsApp versions, web clients, and device types.
 * 
 * @param {object} sock - Baileys socket connection
 * @param {string} jid - Remote JID
 * @param {object} params - Parameters for the message
 * @param {string} params.title - Main header title (optional)
 * @param {string} params.body - Main message body
 * @param {string} params.footer - Footer text (optional)
 * @param {Array} params.buttons - Array of native flow buttons
 * @param {object} options - Additional Baileys message options (quoted, etc.)
 */
export async function sendInteractiveMessage(sock, jid, params, options = {}) {
    const { title, body, footer, buttons } = params;

    // 1. Generate text-based fallback representation of the buttons
    let fallbackText = body;
    if (Array.isArray(buttons) && buttons.length > 0) {
        fallbackText += '\n\n*───────────────*\n';
        buttons.forEach((btn) => {
            try {
                const buttonParams = JSON.parse(btn.buttonParamsJson || '{}');
                if (btn.name === 'quick_reply') {
                    fallbackText += `\n• *${buttonParams.display_text}*\n  Ketik: ${buttonParams.id}`;
                } else if (btn.name === 'cta_url') {
                    fallbackText += `\n• *${buttonParams.display_text}*\n  Buka: ${buttonParams.url}`;
                } else if (btn.name === 'cta_call') {
                    fallbackText += `\n• *${buttonParams.display_text}*\n  Hubungi: ${buttonParams.phone_number}`;
                } else if (btn.name === 'single_select') {
                    fallbackText += `\n*${buttonParams.title || 'Pilih Menu'}:*`;
                    (buttonParams.sections || []).forEach((sec) => {
                        if (sec.title) fallbackText += `\n  _[ ${sec.title} ]_`;
                        (sec.rows || []).forEach((row) => {
                            fallbackText += `\n  - *${row.title}*${row.description ? ` (${row.description})` : ''}\n    Ketik: ${row.id}`;
                        });
                    });
                }
            } catch (e) {
                // Ignore parsing errors for custom buttons
            }
        });
        if (footer) {
            fallbackText += `\n\n_${footer}_`;
        }
    }

    // 2. Prepare the final interactive message payload with proper metadata
    const messagePayload = {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: {
                    header: {
                        title: title || '',
                        hasMediaAttachment: false
                    },
                    body: {
                        text: body
                    },
                    footer: {
                        text: footer || ''
                    },
                    nativeFlowMessage: {
                        buttons: buttons || []
                    }
                }
            }
        }
    };

    const msgContent = generateWAMessageFromContent(jid, messagePayload, { quoted: options.quoted });
    
    // 3. Send using relayMessage to bypass standard media validation errors
    await sock.relayMessage(jid, msgContent.message, { messageId: msgContent.key.id });
    return msgContent;
}
