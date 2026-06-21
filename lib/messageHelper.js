import pkg from 'baileys';

/**
 * Sends a highly-compatible, beautifully styled text-based button/list menu.
 * Since Meta blocks Native Flow/Interactive buttons on personal WhatsApp accounts,
 * this function formats the options as a premium aesthetic text layout.
 * This guarantees 100% compatibility across all WhatsApp versions, web clients,
 * desktop clients, personal/business accounts, and mods without showing "message couldn't load" errors.
 * 
 * @param {object} sock - Baileys socket connection
 * @param {string} jid - Remote JID
 * @param {object} params - Parameters for the message
 * @param {string} params.title - Main header title (optional)
 * @param {string} params.body - Main message body
 * @param {string} params.footer - Footer text (optional)
 * @param {Array} params.buttons - Array of buttons
 * @param {object} options - Additional Baileys message options (quoted, etc.)
 */
export async function sendInteractiveMessage(sock, jid, params, options = {}) {
    const { title, body, footer, buttons } = params;

    // Build a premium text card representation
    let messageText = '';
    
    if (title) {
        messageText += `*${title.toUpperCase()}*\n`;
    }
    
    messageText += `${body}\n`;
    
    if (Array.isArray(buttons) && buttons.length > 0) {
        messageText += `\n*─── Pilihan Menu ───*\n`;
        buttons.forEach((btn) => {
            try {
                const buttonParams = JSON.parse(btn.buttonParamsJson || '{}');
                if (btn.name === 'quick_reply') {
                    messageText += `\n• *${buttonParams.display_text}*\n  └ Ketik: *${buttonParams.id}*`;
                } else if (btn.name === 'cta_url') {
                    messageText += `\n• *${buttonParams.display_text}*\n  └ Buka: ${buttonParams.url}`;
                } else if (btn.name === 'cta_call') {
                    messageText += `\n• *${buttonParams.display_text}*\n  └ Hubungi: ${buttonParams.phone_number}`;
                } else if (btn.name === 'single_select') {
                    (buttonParams.sections || []).forEach((sec) => {
                        if (sec.title) messageText += `\n*[ ${sec.title.toUpperCase()} ]*\n`;
                        (sec.rows || []).forEach((row) => {
                            messageText += `\n• *${row.title}*\n  └ Ketik: *${row.id}*\n    _${row.description || ''}_`;
                        });
                    });
                }
            } catch (e) {
                // Ignore fallback parsing errors
            }
        });
    }

    if (footer) {
        messageText += `\n\n_${footer}_`;
    }

    const msgOptions = {
        text: messageText.trim()
    };

    // Keep context info if provided
    if (options.contextInfo) {
        msgOptions.contextInfo = options.contextInfo;
    }

    return await sock.sendMessage(jid, msgOptions, { quoted: options.quoted });
}
