export function extractButtonText(message) {
  if (!message || typeof message !== "object") return "";
  const b = message.buttonsResponseMessage;
  if (b?.selectedButtonId) return String(b.selectedButtonId);
  const l = message.listResponseMessage?.singleSelectReply;
  if (l?.selectedRowId) return String(l.selectedRowId);
  const t = message.templateButtonReplyMessage;
  if (t?.selectedId) return String(t.selectedId);
  const p = message.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (typeof p === "string" && p) {
    try {
      const parsed = JSON.parse(p);
      const id = parsed?.id ?? parsed?.selectedId ?? parsed?.rowId;
      if (id) return String(id);
    } catch (_) {}
  }
  return "";
}

export function isButtonTap(msg) {
  const m = msg?.message;
  if (!m || typeof m !== "object") return false;
  return Boolean(
    m.buttonsResponseMessage ||
      m.listResponseMessage ||
      m.templateButtonReplyMessage ||
      m.interactiveResponseMessage
  );
}
