import { resolveFfmpegPath } from "@/src/utils/termux.js";

export function getFfmpegPath() {
  return resolveFfmpegPath();
}
