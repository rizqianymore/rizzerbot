import puppeteer from "puppeteer";

export default {
  premiumOnly: true,
  name: "chatmaker",
  description: "Membuat gambar bertema menu popup chat iOS/iPhone secara lokal.",
  usage: "<teks | waktu (opsional)>",
  example: "OK | 12:38 PM",
  aliases: ["cm", "chatmake", "popupchat"],
  category: "Media",
  cooldown: 8000,
  run: async (sock, msg, args, { sendTyping }) => {
    let input = args.join(" ");
    if (!input) {
      await sock.sendMessage(
        msg.key.remoteJid,
        {
          text: "⚠️ Harap tentukan teks gambar. Contoh: *.chatmaker OK* atau *.chatmaker Keren | 10:00 AM*",
        },
        { quoted: msg },
      );
      return;
    }

    await sendTyping();

    // Parse text and optional time separated by "|"
    let text = input.trim();
    let time = "";
    if (input.includes("|")) {
      const parts = input.split("|");
      text = parts[0].trim();
      time = parts[1].trim();
    }

    // Default current local time formatted if not provided
    if (!time) {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      time = `${hours}:${minutes} ${ampm}`;
    }

    let browser;
    try {
      // Launch headless Chrome locally (sandboxed options for stability on VPS)
      browser = await puppeteer.launch({
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process",
          "--disable-gpu"
        ],
        headless: true
      });

      const page = await browser.newPage();
      
      // Set viewport scale to 2x for high quality output
      await page.setViewport({
        width: 320,
        height: 568,
        deviceScaleFactor: 2
      });

      // Inject HTML content directly (Fully offline, no network required!)
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        body {
            background: transparent;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
        }
        .phone-screen {
            width: 320px;
            height: 568px;
            background-color: #0b141a;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding: 24px 16px;
            overflow: hidden;
            border-radius: 0;
            border: none;
        }
        .chat-bg-mock {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            padding: 24px 16px;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 12px;
            z-index: 1;
            pointer-events: none;
            filter: blur(14px);
            -webkit-filter: blur(14px);
        }
        .mock-bubble {
            max-width: 80%;
            padding: 6px 10px;
            border-radius: 10px;
            font-size: 12.5px;
            line-height: 1.35;
            color: #ffffff;
        }
        .mock-bubble.sent {
            align-self: flex-end;
            background-color: #005c4b;
            border-bottom-right-radius: 2px;
        }
        .mock-bubble.received {
            align-self: flex-start;
            background-color: #202c33;
            border-bottom-left-radius: 2px;
        }
        .mock-media {
            width: 100px;
            height: 70px;
            border-radius: 6px;
            background: #2a3942;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 2px;
        }
        .mock-doc {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #182229;
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 11px;
        }
        .overlay-container {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
        }
        .reaction-bar {
            background-color: rgba(37, 37, 39, 0.72);
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            padding: 6px 10px;
            border-radius: 20px;
            display: flex;
            align-items: center;
            gap: 9px;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .emoji {
            font-size: 18px;
        }
        .plus-btn {
            background-color: rgba(255, 255, 255, 0.15);
            width: 21px;
            height: 21px;
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        .chat-bubble-container {
            margin-left: 2px;
            width: 100%;
        }
        .message-bubble {
            background-color: #2c2c2e;
            padding: 6px 12px 6px 14px;
            border-radius: 14px;
            border-bottom-left-radius: 4px;
            display: inline-block;
            max-width: 82%;
            border: 1px solid rgba(255, 255, 255, 0.04);
            vertical-align: bottom;
        }
        .message-text {
            font-size: 15px;
            line-height: 1.35;
            color: #ffffff;
            display: inline;
            word-wrap: break-word;
        }
        .message-time {
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            display: inline-block;
            margin-left: 8px;
            vertical-align: bottom;
            margin-bottom: 1px;
        }
        .context-menu {
            width: 215px;
            background-color: rgba(37, 37, 39, 0.72);
            backdrop-filter: blur(25px);
            -webkit-backdrop-filter: blur(25px);
            border-radius: 14px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .menu-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 11px 15px;
            font-size: 15px;
            color: #ffffff;
        }
        .menu-item:not(:last-child) {
            border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
        }
        .menu-item.danger {
            color: #ff453a;
        }
    </style>
</head>
<body>
    <div class="phone-screen" id="captureScreen">
        <div class="chat-bg-mock">
            <div class="mock-bubble sent">Permisi, apa kabar?</div>
            <div class="mock-bubble received">Halo! Kabar baik disini. Bagaimana dengan Anda?</div>
            <div class="mock-bubble sent">
                <div class="mock-doc">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00a884" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                    <span>document.pdf</span>
                </div>
            </div>
            <div class="mock-bubble received">
                <div class="mock-media">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                </div>
                <span>photo.jpg</span>
            </div>
        </div>

        <div class="overlay-container">
            <div class="reaction-bar">
                <span class="emoji">👍</span>
                <span class="emoji">❤️</span>
                <span class="emoji">😂</span>
                <span class="emoji">😮</span>
                <span class="emoji">😢</span>
                <span class="emoji">🙏</span>
                <div class="plus-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a0a0a5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </div>
            </div>

            <div class="chat-bubble-container">
                <div class="message-bubble">
                    <span class="message-text">${escapeHtml(text)}</span>
                    <span class="message-time">${escapeHtml(time)}</span>
                </div>
            </div>

            <div class="context-menu">
                <div class="menu-item">
                    <span>Star</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                </div>
                <div class="menu-item">
                    <span>Reply</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
                </div>
                <div class="menu-item">
                    <span>Forward</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 17 20 12 15 7"></polyline><path d="M4 18v-2a4 4 0 0 1 4-4h12"></path></svg>
                </div>
                <div class="menu-item">
                    <span>Copy</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
                </div>
                <div class="menu-item">
                    <span>Report</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" x2="12" y1="9" y2="13"></line><line x1="12" x2="12.01" y1="17" y2="17"></line></svg>
                </div>
                <div class="menu-item danger">
                    <span>Delete</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;

      await page.setContent(htmlContent);

      // Select the phone screen element
      const element = await page.$("#captureScreen");
      
      // Capture screenshot directly as buffer (perfect rectangular output, no external API!)
      const imgBuffer = await element.screenshot({ type: "png" });

      await sock.sendMessage(
        msg.key.remoteJid,
        { image: imgBuffer, caption: `⚡ *iOS Popup Chat Maker (Local)*\n💬 Teks: ${text}\n⏰ Waktu: ${time}` },
        { quoted: msg },
      );
    } catch (err) {
      console.error("Chatmaker Local Render Error:", err);
      await sock.sendMessage(
        msg.key.remoteJid,
        { text: "❌ Gagal membuat gambar secara lokal. Coba lagi." },
        { quoted: msg },
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  },
};

// Helper function to escape HTML to prevent breaking the local content structure
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
