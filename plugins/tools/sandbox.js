import vm from "node:vm";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const TIMEOUT_MS = 5000;
const MAX_OUTPUT_LENGTH = 1500;

function runJsSandbox(code) {
  const logs = [];
  const sandbox = {
    console: {
      log: (...args) => logs.push(args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")),
      error: (...args) => logs.push("[ERROR] " + args.join(" ")),
      warn: (...args) => logs.push("[WARN] " + args.join(" ")),
      info: (...args) => logs.push("[INFO] " + args.join(" ")),
    },
    Math,
    Date,
    JSON,
    parseInt,
    parseFloat,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Set,
    Map,
    Promise,
  };

  const context = vm.createContext(sandbox);
  const script = new vm.Script(code);
  const start = performance.now();
  const evalResult = script.runInContext(context, {
    timeout: TIMEOUT_MS,
    displayErrors: true,
  });
  const latency = (performance.now() - start).toFixed(2);

  return {
    logs,
    result: evalResult !== undefined ? evalResult : null,
    latency,
  };
}

async function runPythonSandbox(code) {
  const tmpFile = path.join(os.tmpdir(), `sandbox_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);
  await fs.writeFile(tmpFile, code, "utf8");

  return new Promise((resolve, reject) => {
    const start = performance.now();
    const child = spawn("python3", ["-I", "-s", tmpFile], {
      timeout: TIMEOUT_MS,
      env: { PYTHONIOENCODING: "utf-8" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", async (code) => {
      await fs.unlink(tmpFile).catch(() => {});
      const latency = (performance.now() - start).toFixed(2);

      if (code !== 0 && !stdout) {
        return reject(new Error(stderr.trim() || `Process exited with code ${code}`));
      }

      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        latency,
      });
    });

    child.on("error", async (err) => {
      await fs.unlink(tmpFile).catch(() => {});
      reject(err);
    });
  });
}

export default {
  name: "sandbox",
  aliases: ["runcode", "run", "py", "js"],
  description: "Eksekusi kode JS atau Python dalam lingkungan Sandbox yang aman & terisolasi",
  usage: "<--py / --js> <kode>",
  category: "Tools",
  premiumOnly: true,
  run: async (sock, msg, args, { reply, sendTyping, prefix }) => {
    const currentPrefix = prefix || ".";
    const raw = args.join(" ").trim();

    if (!raw) {
      return reply(
        `📦 *SANDBOX CODE RUNNER*\n\n` +
        `Jalankan potongan kode Javascript atau Python secara terisolasi & aman.\n\n` +
        `*Penggunaan:*\n` +
        `• JS: \`${currentPrefix}sandbox console.log(1 + 1)\`\n` +
        `• Python: \`${currentPrefix}sandbox --py print(sum([1, 2, 3]))\`\n` +
        `• Alias cepat: \`${currentPrefix}py print("halo")\` atau \`${currentPrefix}js [1,2,3].map(x => x*2)\``
      );
    }

    await sendTyping();

    let lang = "js";
    let code = raw;

    if (raw.startsWith("--py") || raw.startsWith("-py")) {
      lang = "py";
      code = raw.replace(/^--?py\s*/i, "").trim();
    } else if (raw.startsWith("--js") || raw.startsWith("-js")) {
      lang = "js";
      code = raw.replace(/^--?js\s*/i, "").trim();
    }

    code = code.replace(/^```(?:js|javascript|py|python)?\s*/i, "").replace(/```$/i, "").trim();

    if (!code) {
      return reply("❌ Masukkan kode yang ingin dijalankan!");
    }

    try {
      if (lang === "py") {
        const out = await runPythonSandbox(code);
        let text = `🐍 *PYTHON SANDBOX*\n\n`;
        if (out.stdout) {
          text += `📄 *Output:*\n\`\`\`\n${out.stdout.slice(0, MAX_OUTPUT_LENGTH)}\n\`\`\`\n`;
        }
        if (out.stderr) {
          text += `⚠️ *Stderr:*\n\`\`\`\n${out.stderr.slice(0, MAX_OUTPUT_LENGTH)}\n\`\`\`\n`;
        }
        if (!out.stdout && !out.stderr) {
          text += `_Program selesai tanpa menghasilkan output._\n`;
        }
        text += `⏱️ Execution Time: \`${out.latency} ms\``;
        return reply(text.trim());
      } else {
        const out = runJsSandbox(code);
        let text = `💛 *JAVASCRIPT SANDBOX*\n\n`;
        if (out.logs.length > 0) {
          text += `📄 *Console Logs:*\n\`\`\`\n${out.logs.join("\n").slice(0, MAX_OUTPUT_LENGTH)}\n\`\`\`\n`;
        }
        if (out.result !== null) {
          const resStr = typeof out.result === "object" ? JSON.stringify(out.result, null, 2) : String(out.result);
          text += `🎯 *Result Value:*\n\`\`\`\n${resStr.slice(0, MAX_OUTPUT_LENGTH)}\n\`\`\`\n`;
        }
        if (out.logs.length === 0 && out.result === null) {
          text += `_Kode dieksekusi tanpa return value / log._\n`;
        }
        text += `⏱️ Execution Time: \`${out.latency} ms\``;
        return reply(text.trim());
      }
    } catch (err) {
      return reply(
        `❌ *SANDBOX EXECUTION ERROR*\n\n` +
        `\`\`\`\n${err.message || String(err)}\n\`\`\``
      );
    }
  },
};
