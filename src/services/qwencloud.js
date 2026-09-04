import crypto from "node:crypto";

const DEFAULT_CONFIG = {
  anonId: "UkYhIx/hnHACASRGXwQf6zDU",
  bxUmidToken:
    "T2gAFKEqH9AogcC28CDvqjjPoPSqFC5D7SvQ_OucdELHqQ5lxCAovJl2LEZc4uuHW8I=",
  bxUa:
    "231!GIS3B+mU9yG+j3L+ck3qr/AjUGp3jkG1E7kpAykk5+UPgrSWzM2c5I+Bc5nmedpNXMoMCSUqS2UxMuBL15dVFc00FOzqBTlS9DKJefHVKijCPH0dZ60i5NoiV5KH8Kj5RIHoAP3yn8TprcLAuKdR256iYUcc/y1uQPbALlGfLABAHwCRk6cYX/jDTjxRFiyRE4TwQ3L5KM+xrWfGhhEl7I88wUWCtLS635CaB1NafuBcUqcF3ko40Q3oyk8jTxu6wGxjMfMHHjp+++3+qCG+aPbjj4jikj+468z+4XgW+jjB54VPsjOso+4jGe5SQsLHpWKDSPfLIh9Cws6/uXnbYblhwZ8z+mtei7AW0U7ugZH1DRY/dIa9VY7ib+2aNURSlavO1bctO00ITjq9X248cR5ixd1JpSNrtc8EKC5BNKQ0uAg+a2lyxMuQW/i4llZmT+Yf6cayUiw9FMv5Lrbz30damaktgpUcT7e6+4CBlL0Yd0a/lYE9yu/MW9QlK5tfD5ehcUCh9oh1UdSupU6bCBTSVw9bn62a87606t2rRKxG+qVdFCjJxTysgIIZ7t51jsf9mvuVL65soleOMNrIldlBqlUm9/NPDHndfhmNgFC3t28V64UciQSB+f1duPPlZQqai12Hp5ehVwdLVCY4PMLOU+ywSwgdXNOvwTKdKSCq9DDbS3ULLROFWyDPsNte5r4TVYAz49taVkmoWqKX9Z4WRXhU89skF8CqIY9l9w7JI6zx8GkaJzc0U0Mzm7k00i9cyHZH/tPn7eQjXj+OCeQiKs/nXc0cQygXuhPxjMPQqziylzOaeiPGJOGS3kTCuMRpDVkRQ92yEHjI7T7T/R6WR8SNncdB7dAEkhzaDCKYd3e+zmu1+K1cVBoaakNokVnzjd5ws7e8oRy9n3BmDW3YidB7YSDHCDMayQwYitZK3eCyBWxtoScGC1bK9UEhJYDHZsHwyiylYdRLwGjStE3U6I7gOiiSeD4Dj+073KB9gJT6QN1Xe5EKpW7tpQXFjrMRH7pZMbzc+wIimSPQE+thR5jHDsbH7n7mvsLnZrPW5dldlLOpBJNJ5SKrvRKVkmNdqEFrt5p+9FNnn9Fin9nivo67aPC6Tsubm7hn9EMP3M5az5SPztmQjSxcZ+cjtulizYNk5lRFv/uIXmqk6ZxkUsNkDcTSskxPSjXNzthOH5q24VazvdeM6tbt+KW4DfWycHQeZdNsUV9uG/ZVV7Xyr1JR4DIcs8pq9GA5ASXoAxADW/cdXZmMUkpNAyC+lGK9FIYJNMgs3i2c+hobmvvHB86zxZ7kG1WPa+dn8xKgn1Xo+EbpuxyXUYP6WNzaXs1UX0KEYfuDmCPoYPKXRGSWe5fMBnLUae6EDbu+/66P1G+R+PaXsO5Ivaxq84+oWwUVDs9swapjKb1PUo5FhRiSjhuKbYKi1MQtoeayOpvaUGAmcfe0TWuhsjphCa9gx3UY2YvgudIG6ZnjIyz/P5aDu7Fy9LGf5fLm5Ec1eyUcMwppzc5ZGrcAnDvNw9AQ5PSnJPFhqGLeho50NnRpctVwSkabxLeG5guL5qsOufsaNmbWx3q71l4/PefJsM3KY9W57cWbcQHJcOGuiEijrtJCjz+y0f3LlBFs4n7QJxdesv3x+M8u1AsDzFpFa1kh+kMy+RID1pwtnBGM",
  cookie:
    "cna=UkYhIx/hnHACASRGXwQf6zDU; cookie_consent=necessary%2Canalytics%2Cmarketing; sca=ecae8436; atpsida=9d1b1026538a7c87faabbf38_1788500066_3; isg=BDIyQD1sjNfAW7DrdC_hO_Vng3gUwzZdFwYJovwL3OXQj9GJ6FMab9IpezMz_671",
  userAgent:
    "Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36",
};

/**
 * Generate temporary access token dari QwenCloud
 */
async function getAccessToken(config = DEFAULT_CONFIG) {
  const params = JSON.stringify({
    Api: "zeldaEasy.cornerstoneStreamGateway.streamGatewayConsoleService.generateAccessToken",
    Data: {
      source: "",
      cornerstoneParam: {
        domain: "www.qwencloud.com",
        consoleSite: "QWENCLOUD",
        console: "ONE_CONSOLE",
        xsp_lang: "en-US",
        protocol: "V2",
        productCode: "p_efm",
        "X-Anonymous-Id": config.anonId,
      },
    },
    V: "1.0",
  });

  const body = new URLSearchParams({
    product: "sfm_bailian",
    action: "IntlBroadScopeAspnGateway",
    sec_token: "",
    region: "ap-southeast-1",
    params: params,
  });

  const res = await fetch(
    "https://cs-data.qwencloud.com/data/api.json?product=sfm_bailian&action=IntlBroadScopeAspnGateway&api=zeldaEasy.cornerstoneStreamGateway.streamGatewayConsoleService.generateAccessToken",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://www.qwencloud.com",
        referer: "https://www.qwencloud.com/",
        "bx-umidtoken": config.bxUmidToken,
        "bx-ua": config.bxUa,
        bx_et: "default_not_fun",
        cookie: config.cookie,
        "user-agent": config.userAgent,
      },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    throw new Error(`Gateway returned HTTP ${res.status}`);
  }

  const json = await res.json();
  const token = json?.data?.DataV2?.data?.data?.accessToken;
  if (!token) {
    const errMsg =
      json?.data?.DataV2?.data?.message ||
      json?.data?.errorMsg ||
      "Gagal mendapatkan accessToken dari QwenCloud";
    throw new Error(errMsg);
  }

  return token;
}

/**
 * Tanya QwenCloud
 * @param {string} prompt Pertanyaan/prompt teks
 * @param {object} [options]
 * @param {string} [options.modelId="qwen3.8-max"] Model ID (qwen3.8-max, qwen-plus, qwen-turbo)
 * @param {boolean} [options.enableThinking=false] Aktifkan reasoning/thinking
 */
export async function askQwenCloud(prompt, options = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Pertanyaan atau prompt tidak boleh kosong.");
  }

  const modelId = options.modelId || "qwen3.8-max";
  const enableThinking = Boolean(options.enableThinking);
  const config = { ...DEFAULT_CONFIG, ...options.config };

  const accessToken = await getAccessToken(config);
  const messageId = crypto.randomUUID();
  const sessionId = crypto.randomBytes(16).toString("hex");
  const tabCode = crypto.randomBytes(16).toString("hex");

  const innerPayload = JSON.stringify({
    Api: "zeldaEasy.bmp.agentPredictRpcService.predict",
    Data: {
      predictRequest: {
        modelId,
        sessionId,
        tabCode,
        contentList: [{ type: "text", content: prompt.trim() }],
        predictConfig: {
          modelParam: {
            top_p: 0.8,
            temperature: 0.7,
            enable_search: false,
            enable_thinking: enableThinking,
            thinking_budget: 4000,
            result_format: "message",
          },
          chatType: "t2t",
        },
        reGenerate: false,
        chatLogCode: messageId,
        modelTypeIds: ["Reasoning", "VU", "TG"],
        isAiCenterRequest: false,
      },
      cornerstoneParam: {
        domain: "www.qwencloud.com",
        consoleSite: "QWENCLOUD",
        console: "ONE_CONSOLE",
        xsp_lang: "en-US",
        protocol: "V2",
        productCode: "p_efm",
        "X-Anonymous-Id": config.anonId,
      },
    },
    V: "1.0",
  });

  const response = await fetch(
    `https://cs-stream.qwencloud.com/sse/console4Json/${accessToken}`,
    {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        "content-type": "application/json",
        origin: "https://www.qwencloud.com",
        referer: "https://www.qwencloud.com/",
        "x-anonymous-id": config.anonId,
        "user-agent": config.userAgent,
      },
      body: JSON.stringify({
        messageId,
        data: [{ type: "JSON_TEXT", value: innerPayload }],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`SSE stream failed with HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Tidak ada stream body dari QwenCloud.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let lastAssistantContent = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let isFinished = false;
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed.startsWith("data:")) continue;

      try {
        const parsedData = JSON.parse(trimmed.slice(5).trim());
        const valueStr = parsedData?.data?.[0]?.value;
        if (!valueStr) continue;

        const inner = JSON.parse(valueStr);
        const msgList = inner?.data?.messageList;
        if (Array.isArray(msgList) && msgList.length > 0) {
          const firstMsg = msgList[0];
          const contentList = firstMsg?.contentList;
          if (Array.isArray(contentList)) {
            const textChunk = contentList.find(
              (c) => c.jsonPath === "/contentList/0/content"
            );
            if (textChunk && typeof textChunk.content === "string") {
              lastAssistantContent = textChunk.content;
            }
          }

          if (firstMsg?.status === "FINISHED") {
            isFinished = true;
          }
        }
      } catch {
        // frame ignore
      }
    }

    if (isFinished) {
      try {
        await reader.cancel();
      } catch {}
      break;
    }
  }

  const finalAnswer = lastAssistantContent.trim();
  if (!finalAnswer) {
    throw new Error("Respon AI kosong dari server QwenCloud.");
  }

  return {
    status: true,
    model: modelId,
    answer: finalAnswer,
  };
}
