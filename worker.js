export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname.toLowerCase();

    // 1. Route /photobooth, /pb, or Root / -> Serve Photobooth Strip Web App by default
    if (pathname === "/" || pathname === "/photobooth" || pathname === "/pb") {
      return new Response(getPhotoboothHtmlTemplate(), {
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "access-control-allow-origin": "*",
        },
      });
    }

    // 2. Route /postcard, /pc, or /post-card -> Serve Postcard Maker Web App
    if (pathname === "/postcard" || pathname === "/pc" || pathname === "/post-card") {
      return new Response(getPostcardHtmlTemplate(), {
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "access-control-allow-origin": "*",
        },
      });
    }

    // 3. Route /chat, /chatmaker, or /ss -> Serve WhatsApp Chat Maker Pro / Control Panel
    const activeText = url.searchParams.get("text") || "OK";
    const activeTime = url.searchParams.get("time") || getFormattedTime();
    const bgParam = url.searchParams.get("bg");

    let bgMessages = [
      { text: "Permisi, apa kabar?", type: "sent", media: "text" },
      { text: "Halo! Kabar baik disini. Bagaimana dengan Anda?", type: "received", media: "text" },
      { text: "document.pdf", type: "sent", media: "doc" },
      { text: "photo.jpg", type: "received", media: "image" }
    ];

    if (bgParam) {
      try {
        bgMessages = bgParam.split(";").map(item => {
          const parts = item.split("|");
          return {
            text: decodeURIComponent(parts[0] || ""),
            type: parts[1] === "sent" ? "sent" : "received",
            media: parts[2] || "text"
          };
        }).filter(m => m.text);
      } catch (err) {
        console.error("Failed to parse bg parameter:", err);
      }
    }

    const fullPageHtml = getFullPageHtmlTemplate(activeText, activeTime, bgMessages);

    return new Response(fullPageHtml, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "access-control-allow-origin": "*"
      }
    });
  }
};



// Generate current time string (HH:MM AM/PM)
function getFormattedTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

// Escape HTML utility (type-safe)
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}


// Full interactive Web App HTML template
function getFullPageHtmlTemplate(activeText, activeTime, bgMessages) {
  return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WhatsApp Chat Maker Pro</title>
    <!-- Lucide Icons CDN -->
    <script src="https://unpkg.com/lucide@latest"></script>
    <!-- html2canvas CDN for downloading screenshot -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <style>
        /* Reset & Base Styles */
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            background-color: #f0f2f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: #1d1d1f;
            padding: 20px;
        }

        /* Outer Container */
        .workspace {
            display: flex;
            align-items: flex-start;
            gap: 30px;
            max-width: 950px;
            width: 100%;
            justify-content: center;
        }

        @media (max-width: 850px) {
            .workspace {
                flex-direction: column;
                align-items: center;
                gap: 20px;
            }
        }

        /* --- CONTROL PANEL --- */
        .control-panel {
            flex: 1;
            background: #ffffff;
            border: 1px solid #e5e5ea;
            border-radius: 20px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
            max-width: 420px;
            width: 100%;
        }

        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e5e5ea;
            padding-bottom: 10px;
        }

        .panel-title {
            font-size: 18px;
            font-weight: 700;
            color: #005c4b;
        }

        .section-title {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #8e8e93;
            font-weight: 700;
            margin-top: 5px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        label {
            font-size: 13px;
            font-weight: 600;
            color: #3a3a3c;
        }

        input, textarea, select {
            background: #f5f5f7;
            border: 1px solid #d2d2d7;
            padding: 8px 12px;
            border-radius: 8px;
            color: #1d1d1f;
            font-size: 13px;
            outline: none;
        }

        input:focus, select:focus {
            border-color: #005c4b;
        }

        .bg-messages-editor {
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-height: 220px;
            overflow-y: auto;
            padding-right: 5px;
            border: 1px solid #e5e5ea;
            border-radius: 8px;
            padding: 8px;
            background: #fafafa;
        }

        .bg-message-item {
            display: flex;
            gap: 6px;
            align-items: center;
            background: #fff;
            padding: 6px;
            border-radius: 6px;
            border: 1px solid #e5e5ea;
        }

        .bg-message-item input[type="text"] {
            flex: 1;
            padding: 6px 10px;
        }

        .bg-message-item select {
            width: 75px;
            padding: 5px;
            font-size: 11px;
        }

        .actions-row {
            display: flex;
            gap: 8px;
        }

        .btn {
            flex: 1;
            padding: 10px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            text-align: center;
            border: none;
            transition: opacity 0.1s;
        }

        .btn:active {
            opacity: 0.8;
        }

        .btn-add {
            background: #e6f3f0;
            color: #005c4b;
            border: 1px dashed #005c4b;
        }

        .btn-mix {
            background: #f2f2f7;
            color: #1d1d1f;
            border: 1px solid #d2d2d7;
        }

        .btn-download {
            background: #005c4b;
            color: #fff;
            font-size: 13px;
            padding: 12px;
        }

        /* --- PREVIEW WINDOW (Compact iPhone Simulation) --- */
        .phone-screen {
            width: 320px;
            height: 568px;
            background-color: #0b141a;
            position: relative;
            border-radius: 0;
            overflow: hidden;
            border: none;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding: 24px 16px;
            flex-shrink: 0;
        }

        /* Simulated chat background - perfectly blurred in CSS browser view */
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

        /* Mock bubbles inside the blurred background */
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

        /* Support for media/image messages inside chat mock */
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

        .mock-media svg {
            stroke: #8e8e93;
        }

        /* Support for doc messages inside chat mock */
        .mock-doc {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #182229;
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 11px;
        }

        .mock-doc svg {
            stroke: #00a884;
        }

        /* Container for sharp overlay elements */
        .overlay-container {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            gap: 16px;
            align-items: flex-start;
        }

        /* --- Reaction Bar --- */
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
            user-select: none;
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

        .plus-btn svg {
            width: 11px;
            height: 11px;
            stroke: #a0a0a5;
            stroke-width: 3px;
        }

        /* --- Active Chat Bubble --- */
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
            user-select: none;
        }

        /* --- Context Menu --- */
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
            user-select: none;
        }

        .menu-item:not(:last-child) {
            border-bottom: 0.5px solid rgba(255, 255, 255, 0.08);
        }

        .menu-item.danger {
            color: #ff453a;
        }

        .menu-item svg {
            width: 15px;
            height: 15px;
            stroke-width: 1.6px;
            stroke: currentColor;
        }

        /* Toast notification */
        .toast {
            position: absolute;
            top: 15px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.85);
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 11px;
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.1);
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
            z-index: 10;
        }
        .module-nav {
            position: fixed;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 10px;
            z-index: 99;
            flex-wrap: wrap;
            justify-content: center;
        }
        .module-nav a {
            text-decoration: none;
            font-size: 0.82rem;
            font-weight: 600;
            padding: 8px 14px;
            border-radius: 20px;
            color: #1d1d1f;
            background-color: #ffffff;
            border: 1px solid #d2d2d7;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: all 0.2s;
        }
        .module-nav a.active, .module-nav a:hover {
            background-color: #005c4b;
            color: #ffffff;
            border-color: #005c4b;
        }
    </style>
</head>
<body>
    <div class="module-nav">
      <a href="/photobooth">📸 Photobooth Strip</a>
      <a href="/postcard">💌 Kartu Pos Romantis</a>
      <a href="/chat" class="active">💬 Chat Maker Pro</a>
    </div>

    <div class="workspace" style="margin-top: 45px;">
        
        <!-- Control Panel Settings -->
        <div class="control-panel">
            <div class="panel-header">
                <h1 class="panel-title">Chat Maker Pro</h1>
                <i data-lucide="message-square" style="color: #005c4b;"></i>
            </div>

            <div class="form-group">
                <span class="section-title">Active Bubble</span>
                <label for="bubbleText">Message Text</label>
                <input type="text" id="bubbleText" value="${escapeHtml(activeText)}">
            </div>

            <div class="form-group">
                <label for="bubbleTime">Time Stamp</label>
                <input type="text" id="bubbleTime" value="${escapeHtml(activeTime)}">
            </div>

            <div class="form-group">
                <span class="section-title">Background Chat (Blurred)</span>
                <div class="bg-messages-editor" id="bgMessagesContainer">
                    <!-- Dynamic fields -->
                </div>
                <div class="actions-row">
                    <button class="btn btn-add" onclick="addBgMessage()">+ Add Bubble</button>
                    <button class="btn btn-mix" onclick="autoMixChat()">🎲 Auto Mix</button>
                </div>
            </div>

            <button class="btn btn-download" onclick="downloadScreenshot()">
                <i data-lucide="download" style="vertical-align: middle; margin-right: 6px; width: 16px; height: 16px;"></i>
                Download PNG Preview
            </button>
        </div>

        <!-- Phone Preview (Compact) -->
        <div class="phone-screen" id="captureScreen">
            <!-- Toast Feedback -->
            <div class="toast" id="toast">Copied!</div>

            <!-- Blurred simulated background chat context -->
            <div class="chat-bg-mock" id="chatBgMock">
                <!-- Dynamically populated -->
            </div>

            <div class="overlay-container" id="overlayContainer">
                <!-- Reaction Bar -->
                <div class="reaction-bar">
                    <span class="emoji">👍</span>
                    <span class="emoji">❤️</span>
                    <span class="emoji">😂</span>
                    <span class="emoji">😮</span>
                    <span class="emoji">😢</span>
                    <span class="emoji">🙏</span>
                    <div class="plus-btn">
                        <i data-lucide="plus"></i>
                    </div>
                </div>

                <!-- Chat Bubble (Sharp) -->
                <div class="chat-bubble-container">
                    <div class="message-bubble">
                        <span class="message-text" id="previewText">${escapeHtml(activeText)}</span>
                        <span class="message-time" id="previewTime">${escapeHtml(activeTime)}</span>
                    </div>
                </div>

                <!-- iOS Context Menu (Sharp) -->
                <div class="context-menu">
                    <div class="menu-item" onclick="triggerAction('Starred!')">
                        <span>Star</span>
                        <i data-lucide="star"></i>
                    </div>
                    <div class="menu-item" onclick="triggerAction('Replying...')">
                        <span>Reply</span>
                        <i data-lucide="reply"></i>
                    </div>
                    <div class="menu-item" onclick="triggerAction('Forwarding...')">
                        <span>Forward</span>
                        <i data-lucide="forward"></i>
                    </div>
                    <div class="menu-item" onclick="triggerCopy()">
                        <span>Copy</span>
                        <i data-lucide="copy"></i>
                    </div>
                    <div class="menu-item" onclick="triggerAction('Reported!')">
                        <span>Report</span>
                        <i data-lucide="alert-triangle"></i>
                    </div>
                    <div class="menu-item danger" onclick="triggerAction('Deleted!')">
                        <span>Delete</span>
                        <i data-lucide="trash-2"></i>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Initialize Logic -->
    <script>
        lucide.createIcons();

        // Preset databases for Auto Mix
        const presetChats = [
            [
                { text: "P", type: "sent", media: "text" },
                { text: "Ada apa bro?", type: "received", media: "text" },
                { text: "Kirim stiker yang tadi dong", type: "sent", media: "text" },
                { text: "sticker.webp", type: "received", media: "image" }
            ],
            [
                { text: "Foto tugas fisika kemarin ada?", type: "received", media: "text" },
                { text: "document.pdf", type: "sent", media: "doc" },
                { text: "Nih bro lengkap semua bab", type: "sent", media: "text" }
            ],
            [
                { text: "Otw ya", type: "sent", media: "text" },
                { text: "Jangan lupa bawa pesanan gw", type: "received", media: "text" },
                { text: "Aman, udah dibeliin kok", type: "sent", media: "text" }
            ]
        ];

        let bgMessages = ${JSON.stringify(bgMessages)};

        const bgContainer = document.getElementById("bgMessagesContainer");
        const chatBgMock = document.getElementById("chatBgMock");
        const bubbleTextInput = document.getElementById("bubbleText");
        const bubbleTimeInput = document.getElementById("bubbleTime");
        const previewText = document.getElementById("previewText");
        const previewTime = document.getElementById("previewTime");
        const toast = document.getElementById("toast");

        // Update live
        bubbleTextInput.addEventListener("input", (e) => {
            previewText.textContent = e.target.value;
        });

        bubbleTimeInput.addEventListener("input", (e) => {
            previewTime.textContent = e.target.value;
        });

        function triggerCopy() {
            navigator.clipboard.writeText(previewText.textContent).then(() => {
                showToast("Copied to Clipboard!");
            });
        }

        function triggerAction(message) {
            showToast(message);
        }

        function showToast(msg) {
            toast.textContent = msg;
            toast.style.opacity = "1";
            setTimeout(() => {
                toast.style.opacity = "0";
            }, 1200);
        }

        // Render mock chat bubbles
        function renderBgMessages() {
            bgContainer.innerHTML = "";
            chatBgMock.innerHTML = "";

            bgMessages.forEach((msg, idx) => {
                // Control panel element
                const row = document.createElement("div");
                row.className = "bg-message-item";
                row.innerHTML = 
                    '<input type="text" value="' + msg.text + '" oninput="updateBgText(' + idx + ', this.value)">' +
                    '<select onchange="updateBgMedia(' + idx + ', this.value)" style="width:70px; padding:4px;">' +
                        '<option value="text" ' + (msg.media === "text" ? "selected" : "") + '>Text</option>' +
                        '<option value="image" ' + (msg.media === "image" ? "selected" : "") + '>Image</option>' +
                        '<option value="doc" ' + (msg.media === "doc" ? "selected" : "") + '>Doc</option>' +
                    '</select>' +
                    '<select onchange="updateBgType(' + idx + ', this.value)">' +
                        '<option value="sent" ' + (msg.type === "sent" ? "selected" : "") + '>Sent</option>' +
                        '<option value="received" ' + (msg.type === "received" ? "selected" : "") + '>Recv</option>' +
                    '</select>' +
                    '<span style="cursor:pointer; color:#ff453a; font-weight:bold; padding: 0 4px;" onclick="removeBgMessage(' + idx + ')">&times;</span>';
                bgContainer.appendChild(row);

                // Phone view bubble
                const bubble = document.createElement("div");
                bubble.className = 'mock-bubble ' + msg.type;
                
                if (msg.media === "image") {
                    bubble.innerHTML = 
                        '<div class="mock-media">' +
                            '<i data-lucide="image" style="stroke: #8e8e93; width: 20px; height: 20px;"></i>' +
                        '</div>' +
                        '<span>' + msg.text + '</span>';
                } else if (msg.media === "doc") {
                    bubble.innerHTML = 
                        '<div class="mock-doc">' +
                            '<i data-lucide="file-text" style="stroke: #00a884; width: 14px; height: 14px;"></i>' +
                            '<span>' + msg.text + '</span>' +
                        '</div>';
                } else {
                    bubble.textContent = msg.text;
                }
                
                chatBgMock.appendChild(bubble);
            });
            lucide.createIcons();
        }

        function updateBgText(idx, val) {
            bgMessages[idx].text = val;
            renderBgMessages();
        }

        function updateBgType(idx, val) {
            bgMessages[idx].type = val;
            renderBgMessages();
        }

        function updateBgMedia(idx, val) {
            bgMessages[idx].media = val;
            if (val === "image" && bgMessages[idx].text === "Pesan baru...") {
                bgMessages[idx].text = "photo.jpg";
            } else if (val === "doc" && bgMessages[idx].text === "Pesan baru...") {
                bgMessages[idx].text = "document.pdf";
            }
            renderBgMessages();
        }

        // Add message
        function addBgMessage() {
            bgMessages.push({ text: "Pesan baru...", type: "received", media: "text" });
            renderBgMessages();
        }

        function removeBgMessage(idx) {
            bgMessages.splice(idx, 1);
            renderBgMessages();
        }

        function autoMixChat() {
            const randIndex = Math.floor(Math.random() * presetChats.length);
            bgMessages = JSON.parse(JSON.stringify(presetChats[randIndex]));
            renderBgMessages();
            showToast("Mixed Chat Loaded!");
        }

        // Draw rounded rectangle helper for canvas clipping
        function drawRoundedRect(ctx, x, y, width, height, radius) {
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + width - radius, y);
            ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
            ctx.lineTo(x + width, y + height - radius);
            ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
            ctx.lineTo(x + radius, y + height);
            ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
        }

        // Programmatic Multi-Layer Screenshot Downloader
        function downloadScreenshot() {
            const bgMock = document.getElementById("chatBgMock");
            const overlayContainer = document.getElementById("overlayContainer");
            
            showToast("Generating image...");

            html2canvas(bgMock, {
                backgroundColor: "#0b141a",
                scale: 2,
                logging: false,
                useCORS: true
            }).then(bgCanvas => {
                
                html2canvas(overlayContainer, {
                    backgroundColor: null,
                    scale: 2,
                    logging: false,
                    useCORS: true
                }).then(overlayCanvas => {
                    
                    const finalCanvas = document.createElement("canvas");
                    finalCanvas.width = 320 * 2;
                    finalCanvas.height = 568 * 2;
                    const ctx = finalCanvas.getContext("2d");

                    ctx.fillStyle = "#0b141a";
                    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = "high";
                    ctx.filter = "blur(24px)";
                    ctx.drawImage(bgCanvas, 0, 0, finalCanvas.width, finalCanvas.height);
                    ctx.filter = "none";

                    const xOffset = 16 * 2;
                    const yOffset = (568 - 24) * 2 - overlayCanvas.height;
                    ctx.drawImage(overlayCanvas, xOffset, yOffset);

                    const link = document.createElement("a");
                    link.download = 'chat-maker-' + Date.now() + '.png';
                    link.href = finalCanvas.toDataURL("image/png");
                    link.click();
                    showToast("Downloaded!");
                });
            });
        }

        renderBgMessages();
    </script>
</body>
</html>`;
}

function getPhotoboothHtmlTemplate() {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Aesthetic Photobooth Strip Maker</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,600;1,400&family=Caveat:wght@600&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --bg-color: #faf6f4;
        --card-bg: #ffffff;
        --text-color: #4a3b32;
        --text-muted: #8c7a6e;
        --accent-color: #c97a7e;
        --accent-hover: #b36569;
        --border-color: #e8ded8;
        --strip-bg: #ffffff;
        --strip-text: #333333;
      }

      * {
        box-sizing: border-box;
      }

      body {
        font-family: "Plus Jakarta Sans", sans-serif;
        background-color: var(--bg-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 100vh;
        margin: 0;
        padding: 30px 20px;
        color: var(--text-color);
      }

      .header {
        text-align: center;
        margin-bottom: 28px;
      }

      h1 {
        font-family: "Playfair Display", serif;
        font-weight: 600;
        font-size: 1.9rem;
        color: var(--text-color);
        margin: 0 0 6px 0;
      }

      .subtitle {
        font-size: 0.9rem;
        color: var(--text-muted);
        margin: 0;
      }

      .container {
        display: flex;
        gap: 36px;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 950px;
        width: 100%;
        align-items: flex-start;
      }

      /* Form Controls */
      .controls {
        background: #ffffff;
        padding: 24px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        width: 340px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: 85vh;
        overflow-y: auto;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      label {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-color);
      }

      input,
      select {
        width: 100%;
        padding: 9px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        font-family: "Plus Jakarta Sans", sans-serif;
        font-size: 0.88rem;
        color: var(--text-color);
        background-color: #faf9f8;
        transition: border-color 0.2s, background-color 0.2s;
      }

      input:focus,
      select:focus {
        outline: none;
        border-color: var(--accent-color);
        background-color: #ffffff;
      }

      .photo-control-card {
        background: #faf7f5;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .photo-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.82rem;
        font-weight: 600;
      }

      .btn-del {
        background: none;
        border: none;
        color: #d9534f;
        cursor: pointer;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 0;
      }

      button {
        border: 1px solid var(--accent-color);
        background-color: var(--accent-color);
        color: white;
        padding: 11px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.88rem;
        transition: background-color 0.2s, border-color 0.2s;
      }

      button:hover {
        background-color: var(--accent-hover);
        border-color: var(--accent-hover);
      }

      button.btn-add {
        background-color: #f5ebe6;
        color: var(--text-color);
        border: 1px dashed var(--accent-color);
        padding: 8px 12px;
        font-size: 0.82rem;
      }

      button.btn-add:hover {
        background-color: #ebdcd5;
      }

      /* Photobooth Strip Preview */
      .photobooth-wrapper {
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .photobooth-strip {
        width: 220px;
        background-color: var(--strip-bg);
        padding: 16px 14px 20px 14px;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        box-sizing: border-box;
      }

      .strip-photos {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .strip-photo-item {
        width: 100%;
        height: 140px;
        background-color: #f2ebe7;
        overflow: hidden;
        border-radius: 3px;
        position: relative;
      }

      .strip-photo-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      /* Photobooth Strip Footer */
      .strip-footer {
        width: 100%;
        text-align: center;
        padding-top: 6px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .strip-title {
        font-family: "Caveat", cursive;
        font-size: 1.3rem;
        color: var(--strip-text);
        line-height: 1.2;
      }

      .strip-date {
        font-size: 0.68rem;
        letter-spacing: 1px;
        color: var(--strip-text);
        opacity: 0.7;
        text-transform: uppercase;
        font-weight: 500;
      }

      /* Responsive Adjustments */
      @media (max-width: 768px) {
        .container {
          gap: 24px;
        }

        .controls {
          width: 100%;
          max-width: 360px;
          max-height: none;
        }
      }

      .strip-photo-item {
        position: relative;
      }

      /* Cute Tilted Corner Bear Stickers */
      .photo-corner-sticker {
        position: absolute;
        font-size: 1.15rem;
        z-index: 10;
        pointer-events: none;
        line-height: 1;
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
      }

      .photo-corner-sticker.corner-tl {
        top: 6px;
        left: 6px;
      }

      .photo-corner-sticker.corner-tr {
        top: 6px;
        right: 6px;
      }

      .paper-stickers-layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10;
      }
    <style>
      .module-nav {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        justify-content: center;
        flex-wrap: wrap;
      }
      .module-nav a {
        text-decoration: none;
        font-size: 0.82rem;
        font-weight: 600;
        padding: 8px 14px;
        border-radius: 20px;
        color: var(--text-color);
        background-color: #ffffff;
        border: 1px solid var(--border-color);
        transition: all 0.2s;
      }
      .module-nav a.active, .module-nav a:hover {
        background-color: var(--accent-color);
        color: #ffffff;
        border-color: var(--accent-color);
      }
    </style>
  </head>
  <body>
    <div class="module-nav">
      <a href="/photobooth" class="active">📸 Photobooth Strip</a>
      <a href="/postcard">💌 Kartu Pos Romantis</a>
      <a href="/chat">💬 Chat Maker Pro</a>
    </div>

    <div class="header">
      <h1>Photobooth Strip Maker</h1>
      <p class="subtitle">Buat strip foto gaya photobooth simpel & manis</p>
    </div>

    <div class="container">
      <!-- Controls -->
      <div class="controls">
        <label>Kelola Foto Photobooth (1 - 5 Foto)</label>
        <div id="photosList" style="display: flex; flex-direction: column; gap: 10px;"></div>

        <button class="btn-add" onclick="addPhoto()">+ Tambah Foto</button>

        <div class="form-group" style="margin-top: 8px;">
          <label for="titleInput">Judul / Teks Footer</label>
          <input
            type="text"
            id="titleInput"
            placeholder="Tulis judul kenangan..."
            value="Best Moments ♥"
            oninput="updateStripText()"
          />
        </div>

        <div class="form-group">
          <label for="dateInput">Tanggal / Lokasi</label>
          <input 
            type="text" 
            id="dateInput" 
            placeholder="Tanggal / Tempat..." 
            value="29.07.2026 • PHOTOBOOTH" 
            oninput="updateStripText()"
          />
        </div>

        <div class="form-group">
          <label for="themeSelect">Warna Bingkai Strip</label>
          <select id="themeSelect" onchange="updateTheme()">
            <option value="#ffffff|#333333">Putih Klasik (Classic White)</option>
            <option value="#1a1a1a|#ffffff">Hitam Vintage (Retro Black)</option>
            <option value="#fbf3f0|#4a3b32">Pink Soft (Warm Cream)</option>
            <option value="#eef2f5|#334155">Biru Pastel (Pastel Blue)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="stickerSelect">Hiasan Boneka Lucu</label>
          <select id="stickerSelect" onchange="renderPaperStickers()">
            <option value="cute_bear">🧸 Boneka Beruang Imut (Teddy Bear)</option>
            <option value="cute_tape">🎀 Pita Kertas & Hati (Classic Ribbon)</option>
            <option value="none">Tanpa Hiasan (Clean)</option>
          </select>
        </div>

        <button onclick="downloadStrip()">Unduh Photobooth Strip</button>
      </div>

      <!-- Photobooth Strip Preview -->
      <div class="photobooth-wrapper">
        <div class="photobooth-strip" id="photoboothStrip">
          <div class="paper-stickers-layer" id="paperStickersLayer"></div>
          <div class="strip-photos" id="stripPhotos"></div>
          <div class="strip-footer">
            <div class="strip-title" id="stripTitleText">Best Moments ♥</div>
            <div class="strip-date" id="stripDateText">29.07.2026 • PHOTOBOOTH</div>
          </div>
        </div>
      </div>
    </div>

    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
    <script>
      let photoList = [
        "https://images.unsplash.com/photo-1518199266791-5375a83190b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
      ];

      function renderPhotoInputs() {
        const container = document.getElementById("photosList");
        container.innerHTML = "";

        photoList.forEach((src, idx) => {
          const card = document.createElement("div");
          card.className = "photo-control-card";
          card.innerHTML = \`
            <div class="photo-card-header">
              <span>Foto #\${idx + 1}</span>
              \${photoList.length > 1 ? \`<button class="btn-del" onclick="deletePhoto(\${idx})">Hapus</button>\` : ''}
            </div>
            <input type="text" placeholder="URL Foto..." value="\${src.startsWith('data:') ? '[File Uploaded]' : src}" oninput="updatePhotoUrl(\${idx}, this.value)">
            <input type="file" accept="image/*" onchange="uploadPhoto(event, \${idx})">
          \`;
          container.appendChild(card);
        });
      }

      function addPhoto() {
        if (photoList.length >= 5) {
          alert("Maksimal 5 foto per strip.");
          return;
        }
        photoList.push("https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80");
        renderPhotoInputs();
        renderStripPhotos();
      }

      function deletePhoto(idx) {
        if (photoList.length <= 1) return;
        photoList.splice(idx, 1);
        renderPhotoInputs();
        renderStripPhotos();
      }

      function updatePhotoUrl(idx, val) {
        if (!val.startsWith('[File Uploaded]')) {
          photoList[idx] = val;
          renderStripPhotos();
        }
      }

      function uploadPhoto(event, idx) {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            photoList[idx] = e.target.result;
            renderPhotoInputs();
            renderStripPhotos();
          };
          reader.readAsDataURL(file);
        }
      }

      function renderStripPhotos() {
        const container = document.getElementById("stripPhotos");
        container.innerHTML = "";

        const stickerType = document.getElementById("stickerSelect") ? document.getElementById("stickerSelect").value : "cute_bear";

        photoList.forEach((src, idx) => {
          const item = document.createElement("div");
          item.className = "strip-photo-item";

          const img = document.createElement("img");
          img.crossOrigin = "anonymous";
          img.src = src;
          img.alt = "Photobooth Frame";
          img.onerror = function() {
            this.onerror = null;
            this.src = "https://images.unsplash.com/photo-1518199266791-5375a83190b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";
          };

          item.appendChild(img);

          if (stickerType === "cute_bear" || stickerType === "cute_tape") {
            const icon = stickerType === "cute_bear" ? "🧸" : "🎀";
            const cornerSticker = document.createElement("div");

            const isLeft = (idx % 2 === 0);
            const cornerClass = isLeft ? "corner-tl" : "corner-tr";
            const rotateDeg = isLeft ? "-15deg" : "15deg";

            cornerSticker.className = \`photo-corner-sticker \${cornerClass}\`;
            cornerSticker.style.transform = \`rotate(\${rotateDeg})\`;
            cornerSticker.innerText = icon;

            item.appendChild(cornerSticker);
          }

          container.appendChild(item);
        });

        renderPaperStickers();
      }

      function renderPaperStickers() {
        const layer = document.getElementById("paperStickersLayer");
        if (!layer) return;
        layer.innerHTML = "";
      }

      function updateStripText() {
        const title = document.getElementById("titleInput").value;
        const date = document.getElementById("dateInput").value;

        document.getElementById("stripTitleText").innerText = title || "Best Moments ♥";
        document.getElementById("stripDateText").innerText = date;
      }

      function updateTheme() {
        const themeVal = document.getElementById("themeSelect").value;
        const [bgColor, textColor] = themeVal.split("|");

        document.documentElement.style.setProperty("--strip-bg", bgColor);
        document.documentElement.style.setProperty("--strip-text", textColor);
      }

      function downloadStrip() {
        const strip = document.getElementById("photoboothStrip");
        const btn = document.querySelector(".controls button:last-child");
        const originalText = btn.innerText;
        btn.innerText = "Mengunduh...";
        btn.disabled = true;

        html2canvas(strip, {
          useCORS: true,
          allowTaint: true,
          scale: 3,
          logging: false
        }).then((canvas) => {
          const link = document.createElement("a");
          link.download = "photobooth-strip.png";
          link.href = canvas.toDataURL("image/png");
          link.click();
          btn.innerText = originalText;
          btn.disabled = false;
        }).catch((err) => {
          console.error("Gagal membuat gambar:", err);
          alert("Gagal mengunduh photobooth strip.");
          btn.innerText = originalText;
          btn.disabled = false;
        });
      }

      renderPhotoInputs();
      renderStripPhotos();
      updateStripText();
      updateTheme();
    </script>
  </body>
</html>`;
}

function getPostcardHtmlTemplate() {
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kartu Pos Cinta Simple</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=Playfair+Display:ital,wght@0,500;1,400&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --bg-color: #faf6f4;
        --card-bg: #ffffff;
        --text-color: #4a3b32;
        --text-muted: #8c7a6e;
        --accent-color: #c97a7e;
        --accent-hover: #b36569;
        --border-color: #e8ded8;
      }

      * {
        box-sizing: border-box;
      }

      body {
        font-family: "Plus Jakarta Sans", sans-serif;
        background-color: var(--bg-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        min-height: 100vh;
        margin: 0;
        padding: 30px 20px;
        color: var(--text-color);
      }

      .header {
        text-align: center;
        margin-bottom: 28px;
      }

      h1 {
        font-family: "Playfair Display", serif;
        font-weight: 500;
        font-size: 1.8rem;
        color: var(--text-color);
        margin: 0 0 6px 0;
      }

      .subtitle {
        font-size: 0.9rem;
        color: var(--text-muted);
        margin: 0;
      }

      .container {
        display: flex;
        gap: 36px;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 1000px;
        width: 100%;
      }

      .controls {
        background: #ffffff;
        padding: 24px;
        border-radius: 12px;
        border: 1px solid var(--border-color);
        width: 340px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-height: 85vh;
        overflow-y: auto;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      label {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-color);
      }

      input,
      textarea,
      select {
        width: 100%;
        padding: 9px 12px;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        font-family: "Plus Jakarta Sans", sans-serif;
        font-size: 0.88rem;
        color: var(--text-color);
        background-color: #faf9f8;
        transition: border-color 0.2s, background-color 0.2s;
      }

      .photo-control-card {
        background: #faf7f5;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .photo-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.82rem;
        font-weight: 600;
      }

      .btn-del {
        background: none;
        border: none;
        color: #d9534f;
        cursor: pointer;
        font-size: 0.78rem;
        font-weight: 600;
        padding: 0;
      }

      button {
        border: 1px solid var(--accent-color);
        background-color: var(--accent-color);
        color: white;
        padding: 11px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.88rem;
        transition: background-color 0.2s, border-color 0.2s;
      }

      button:hover {
        background-color: var(--accent-hover);
        border-color: var(--accent-hover);
      }

      button.btn-add {
        background-color: #f5ebe6;
        color: var(--text-color);
        border: 1px dashed var(--accent-color);
        padding: 8px 12px;
        font-size: 0.82rem;
      }

      .postcard-wrapper {
        display: flex;
        justify-content: center;
        width: 100%;
        max-width: 580px;
      }

      .postcard {
        width: 100%;
        max-width: 580px;
        min-height: 380px;
        background-color: var(--card-bg);
        border-radius: 8px;
        border: 1px solid var(--border-color);
        overflow: hidden;
        display: flex;
      }

      .left-side {
        width: 52%;
        background-color: #f7f3f0;
        border-right: 1px solid var(--border-color);
        display: flex;
        position: relative;
        overflow: hidden;
      }

      .photo-grid {
        width: 100%;
        height: 100%;
        display: flex;
      }

      .photo-grid.count-1 { flex-direction: column; }
      .photo-grid.count-1 .photo-item { width: 100%; height: 100%; }

      .photo-grid.count-2 { flex-direction: column; }
      .photo-grid.count-2 .photo-item { width: 100%; height: 50%; border-bottom: 1px solid var(--border-color); border-right: none; }
      .photo-grid.count-2 .photo-item:last-child { border-bottom: none; }

      .photo-grid.count-3 { flex-direction: column; }
      .photo-grid.count-3 .photo-item { width: 100%; height: 33.33%; border-bottom: 1px solid var(--border-color); }
      .photo-grid.count-3 .photo-item:last-child { border-bottom: none; }

      .photo-grid.count-4 { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
      .photo-grid.count-4 .photo-item { width: 100%; height: 100%; border-right: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); }

      .photo-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .right-side {
        width: 48%;
        padding: 24px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background-color: #fffdfb;
      }

      .stamp-area {
        display: flex;
        justify-content: flex-end;
      }

      .stamp {
        width: 50px;
        height: 60px;
        border: 1px dashed var(--accent-color);
        border-radius: 4px;
        background-color: #fcf8f6;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: var(--accent-color);
      }

      .stamp-icon { font-size: 1.1rem; margin-bottom: 2px; }
      .stamp-text { font-size: 0.65rem; font-weight: 700; letter-spacing: 1px; }

      .message-area {
        font-family: "Caveat", cursive;
        font-size: 1.45rem;
        line-height: 1.4;
        color: #3b2d25;
        white-space: pre-wrap;
        flex-grow: 1;
        margin-top: 14px;
        margin-bottom: 14px;
        word-break: break-word;
      }

      .address-area {
        font-family: "Plus Jakarta Sans", sans-serif;
        font-size: 0.85rem;
        color: var(--text-color);
        border-top: 1px solid var(--border-color);
        padding-top: 12px;
        line-height: 1.4;
      }

      .address-area strong { color: var(--accent-color); }

      @media (max-width: 768px) {
        .container { gap: 24px; }
        .controls { width: 100%; max-width: 580px; padding: 20px; max-height: none; }
        .postcard { flex-direction: column; min-height: auto; }
        .left-side { width: 100%; height: 240px; border-right: none; border-bottom: 1px solid var(--border-color); }
        .right-side { width: 100%; padding: 20px; min-height: 250px; }
        .message-area { font-size: 1.35rem; }
      }
      .module-nav {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        justify-content: center;
        flex-wrap: wrap;
      }
      .module-nav a {
        text-decoration: none;
        font-size: 0.82rem;
        font-weight: 600;
        padding: 8px 14px;
        border-radius: 20px;
        color: var(--text-color);
        background-color: #ffffff;
        border: 1px solid var(--border-color);
        transition: all 0.2s;
      }
      .module-nav a.active, .module-nav a:hover {
        background-color: var(--accent-color);
        color: #ffffff;
        border-color: var(--accent-color);
      }
    </style>
  </head>
  <body>
    <div class="module-nav">
      <a href="/photobooth">📸 Photobooth Strip</a>
      <a href="/postcard" class="active">💌 Kartu Pos Romantis</a>
      <a href="/chat">💬 Chat Maker Pro</a>
    </div>

    <div class="header">
      <h1>Kartu Pos Cinta</h1>
      <p class="subtitle">Desain simpel, bersih, & manis</p>
    </div>

    <div class="container">
      <div class="controls">
        <label>Kelola Foto (1 - 4 Foto)</label>
        <div id="photosList" style="display: flex; flex-direction: column; gap: 10px;"></div>

        <button class="btn-add" onclick="addPhoto()">+ Tambah Foto</button>

        <div class="form-group" style="margin-top: 8px;">
          <label for="msgInput">Pesan Cinta</label>
          <textarea
            id="msgInput"
            rows="3"
            placeholder="Tulis pesan manis kamu..."
            oninput="updateText()"
          >Setiap detik bersamamu terasa begitu berarti. Terima kasih sudah selalu ada. ❤️</textarea>
        </div>

        <div class="form-group">
          <label for="nameInput">Untuk Seseorang</label>
          <input 
            type="text" 
            id="nameInput" 
            placeholder="Nama penerima..." 
            value="Kamu yang Spesial" 
            oninput="updateText()"
          />
        </div>

        <div class="form-group">
          <label for="fontSelect">Gaya Tulisan Pesan</label>
          <select id="fontSelect" onchange="updateText()">
            <option value="'Caveat', cursive">Tulisan Tangan (Caveat)</option>
            <option value="'Playfair Display', serif">Anggun & Klasik (Playfair)</option>
            <option value="'Plus Jakarta Sans', sans-serif">Simpel Modern (Jakarta Sans)</option>
          </select>
        </div>

        <button onclick="downloadPostcard()">Unduh Gambar Kartu Pos</button>
      </div>

      <div class="postcard-wrapper">
        <div class="postcard" id="postcard">
          <div class="left-side">
            <div class="photo-grid count-2" id="photoGrid"></div>
          </div>
          <div class="right-side">
            <div class="stamp-area">
              <div class="stamp">
                <span class="stamp-icon">♥</span>
                <span class="stamp-text">CINTA</span>
              </div>
            </div>
            <div class="message-area" id="cardMessage">
Setiap detik bersamamu terasa begitu berarti. Terima kasih sudah selalu ada. ❤️
            </div>
            <div class="address-area">
              <strong>Untuk:</strong> <span id="cardName">Kamu yang Spesial</span><br />
              <span style="color: var(--text-muted); font-size: 0.8rem;">Di Mana Pun Kamu Berada</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
    <script>
      let photoList = [
        "https://images.unsplash.com/photo-1518199266791-5375a83190b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
      ];

      function renderPhotoInputs() {
        const container = document.getElementById("photosList");
        container.innerHTML = "";

        photoList.forEach((src, idx) => {
          const card = document.createElement("div");
          card.className = "photo-control-card";
          card.innerHTML = \`
            <div class="photo-card-header">
              <span>Foto #\${idx + 1}</span>
              \${photoList.length > 1 ? \`<button class="btn-del" onclick="deletePhoto(\${idx})">Hapus</button>\` : ''}
            </div>
            <input type="text" placeholder="URL Foto..." value="\${src.startsWith('data:') ? '[File Uploaded]' : src}" oninput="updatePhotoUrl(\${idx}, this.value)">
            <input type="file" accept="image/*" onchange="uploadPhoto(event, \${idx})">
          \`;
          container.appendChild(card);
        });
      }

      function addPhoto() {
        if (photoList.length >= 4) {
          alert("Maksimal 4 foto.");
          return;
        }
        photoList.push("https://images.unsplash.com/photo-1522673607200-164d1b6ce486?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80");
        renderPhotoInputs();
        renderPhotoGrid();
      }

      function deletePhoto(idx) {
        if (photoList.length <= 1) return;
        photoList.splice(idx, 1);
        renderPhotoInputs();
        renderPhotoGrid();
      }

      function updatePhotoUrl(idx, val) {
        if (!val.startsWith('[File Uploaded]')) {
          photoList[idx] = val;
          renderPhotoGrid();
        }
      }

      function uploadPhoto(event, idx) {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = function(e) {
            photoList[idx] = e.target.result;
            renderPhotoInputs();
            renderPhotoGrid();
          };
          reader.readAsDataURL(file);
        }
      }

      function renderPhotoGrid() {
        const grid = document.getElementById("photoGrid");
        grid.innerHTML = "";

        const count = photoList.length;
        grid.className = \`photo-grid count-\${count}\`;

        photoList.forEach((src) => {
          const item = document.createElement("div");
          item.className = "photo-item";

          const img = document.createElement("img");
          img.crossOrigin = "anonymous";
          img.src = src;
          img.alt = "Foto Postcard";
          img.onerror = function() {
            this.onerror = null;
            this.src = "https://images.unsplash.com/photo-1518199266791-5375a83190b7?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80";
          };

          item.appendChild(img);
          grid.appendChild(item);
        });
      }

      function updateText() {
        const msg = document.getElementById("msgInput").value;
        const name = document.getElementById("nameInput").value;
        const font = document.getElementById("fontSelect").value;

        document.getElementById("cardMessage").innerText = msg;
        document.getElementById("cardMessage").style.fontFamily = font;
        document.getElementById("cardName").innerText = name || "Kamu yang Spesial";
      }

      function downloadPostcard() {
        const postcard = document.getElementById("postcard");
        const btn = document.querySelector(".controls button:last-child");
        const originalText = btn.innerText;
        btn.innerText = "Mengunduh...";
        btn.disabled = true;

        html2canvas(postcard, {
          useCORS: true,
          allowTaint: true,
          scale: 2,
          logging: false
        }).then((canvas) => {
          const link = document.createElement("a");
          link.download = "kartu-pos-cinta-simple.png";
          link.href = canvas.toDataURL("image/png");
          link.click();
          btn.innerText = originalText;
          btn.disabled = false;
        }).catch((err) => {
          console.error("Gagal membuat gambar:", err);
          alert("Gagal mengunduh gambar. Silakan coba lagi.");
          btn.innerText = originalText;
          btn.disabled = false;
        });
      }

      renderPhotoInputs();
      renderPhotoGrid();
      updateText();
    </script>
  </body>
</html>`;
}
