import { SHA3_256_RATE_BYTES, SHA3_DOMAIN_SUFFIX, SHA3_256_OUTPUT_BYTES } from "./constants.js";
import {
  DEEPSEEK_HASH_ROUNDS,
  DIGEST_HEX_PATTERN,
  MAX_DEEPSEEK_POW_DIFFICULTY,
  keccakP1600Uint32,
  absorbFullUint32Block,
} from "./optimized.js";

function parseDigestWords(digestHex) {
  const words = new Uint32Array(SHA3_256_OUTPUT_BYTES / 4);
  for (let index = 0; index < SHA3_256_OUTPUT_BYTES; index++) {
    const byte = Number.parseInt(digestHex.slice(index * 2, index * 2 + 2), 16);
    words[index >>> 2] |= byte << ((index & 3) * 8);
  }
  return words;
}

export function findDeepSeekPowNonce(prefix, challenge, difficulty) {
  if (typeof prefix !== "string") throw new TypeError("DeepSeek PoW prefix must be a string");
  if (!DIGEST_HEX_PATTERN.test(challenge)) {
    throw new TypeError("DeepSeek PoW challenge must be a 64-character hex digest");
  }
  if (!Number.isSafeInteger(difficulty) || difficulty < 1 || difficulty > MAX_DEEPSEEK_POW_DIFFICULTY) {
    throw new RangeError(`DeepSeek PoW difficulty must be an integer from 1 to ${MAX_DEEPSEEK_POW_DIFFICULTY}`);
  }

  const prefixBytes = new TextEncoder().encode(prefix);
  const baseState = new Uint32Array(50);
  const rhoPiState = new Uint32Array(50);
  const columnParity = new Uint32Array(10);
  const thetaMix = new Uint32Array(10);
  let prefixOffset = 0;

  while (prefixOffset + SHA3_256_RATE_BYTES <= prefixBytes.length) {
    absorbFullUint32Block(
      baseState,
      prefixBytes,
      prefixOffset,
      rhoPiState,
      columnParity,
      thetaMix,
      DEEPSEEK_HASH_ROUNDS
    );
    prefixOffset += SHA3_256_RATE_BYTES;
  }

  const tailLength = prefixBytes.length - prefixOffset;
  const tailWords = new Uint32Array(Math.ceil(tailLength / 4));
  for (let index = 0; index < tailLength; index++) {
    tailWords[index >>> 2] ^= prefixBytes[prefixOffset + index] << ((index & 3) * 8);
  }

  const targetWords = parseDigestWords(challenge.toLowerCase());
  const state = new Uint32Array(50);

  nonceLoop: for (let nonce = 0; nonce < difficulty; nonce++) {
    state.set(baseState);
    for (let word = 0; word < tailWords.length; word++) state[word] ^= tailWords[word];

    let position = tailLength;
    const nonceText = String(nonce);
    for (let index = 0; index < nonceText.length; index++) {
      state[position >>> 2] ^= nonceText.charCodeAt(index) << ((position & 3) * 8);
      position += 1;
      if (position === SHA3_256_RATE_BYTES) {
        keccakP1600Uint32(state, rhoPiState, columnParity, thetaMix, DEEPSEEK_HASH_ROUNDS);
        position = 0;
      }
    }

    state[position >>> 2] ^= SHA3_DOMAIN_SUFFIX << ((position & 3) * 8);
    state[(SHA3_256_RATE_BYTES - 1) >>> 2] ^= 0x80 << 24;
    keccakP1600Uint32(state, rhoPiState, columnParity, thetaMix, DEEPSEEK_HASH_ROUNDS);

    for (let word = 0; word < targetWords.length; word++) {
      if (state[word] !== targetWords[word]) continue nonceLoop;
    }
    return nonce;
  }

  return -1;
}
