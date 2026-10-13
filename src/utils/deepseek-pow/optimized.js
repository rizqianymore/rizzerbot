import {
  SHA3_256_RATE_BYTES,
  SHA3_DOMAIN_SUFFIX,
  SHA3_256_OUTPUT_BYTES,
  ROTATION_OFFSETS,
  ROUND_CONSTANTS,
} from "./constants.js";

export const DEEPSEEK_HASH_ROUNDS = 23;
export const DIGEST_HEX_PATTERN = /^[a-f0-9]{64}$/i;
export const ROUND_CONSTANTS_LOW = Uint32Array.from(ROUND_CONSTANTS, (value) => Number(value & 0xffffffffn));
export const ROUND_CONSTANTS_HIGH = Uint32Array.from(ROUND_CONSTANTS, (value) => Number((value >> 32n) & 0xffffffffn));
export const RHO_PI_DESTINATION_WORDS = Uint8Array.from({ length: 25 }, (_, lane) => {
  const x = lane % 5;
  const y = Math.floor(lane / 5);
  return 2 * (y + 5 * ((2 * x + 3 * y) % 5));
});
export const CHI_NEXT_WORDS = Uint8Array.from({ length: 25 }, (_, lane) => {
  const x = lane % 5;
  const row = lane - x;
  return 2 * (row + ((x + 1) % 5));
});
export const CHI_NEXT_NEXT_WORDS = Uint8Array.from({ length: 25 }, (_, lane) => {
  const x = lane % 5;
  const row = lane - x;
  return 2 * (row + ((x + 2) % 5));
});
export const HEX_DIGITS = "0123456789abcdef";

export const MAX_DEEPSEEK_POW_DIFFICULTY = 250_000;

export function keccakP1600Uint32(state, rhoPiState, columnParity, thetaMix, roundCount) {
  const firstRound = ROUND_CONSTANTS.length - roundCount;

  for (let round = firstRound; round < ROUND_CONSTANTS.length; round++) {
    for (let x = 0; x < 5; x++) {
      const word = 2 * x;
      columnParity[word] = state[word] ^ state[word + 10] ^ state[word + 20] ^ state[word + 30] ^ state[word + 40];
      columnParity[word + 1] =
        state[word + 1] ^ state[word + 11] ^ state[word + 21] ^ state[word + 31] ^ state[word + 41];
    }

    for (let x = 0; x < 5; x++) {
      const previous = 2 * ((x + 4) % 5);
      const next = 2 * ((x + 1) % 5);
      const rotatedLow = (columnParity[next] << 1) | (columnParity[next + 1] >>> 31);
      const rotatedHigh = (columnParity[next + 1] << 1) | (columnParity[next] >>> 31);
      thetaMix[2 * x] = columnParity[previous] ^ rotatedLow;
      thetaMix[2 * x + 1] = columnParity[previous + 1] ^ rotatedHigh;
    }

    for (let x = 0; x < 5; x++) {
      const word = 2 * x;
      const low = thetaMix[word];
      const high = thetaMix[word + 1];
      state[word] ^= low;
      state[word + 1] ^= high;
      state[word + 10] ^= low;
      state[word + 11] ^= high;
      state[word + 20] ^= low;
      state[word + 21] ^= high;
      state[word + 30] ^= low;
      state[word + 31] ^= high;
      state[word + 40] ^= low;
      state[word + 41] ^= high;
    }

    rhoPiState[0] = state[0];
    rhoPiState[1] = state[1];
    for (let lane = 1; lane < 25; lane++) {
      const source = 2 * lane;
      const destination = RHO_PI_DESTINATION_WORDS[lane];
      const amount = ROTATION_OFFSETS[lane];
      const low = state[source];
      const high = state[source + 1];

      if (amount < 32) {
        rhoPiState[destination] = (low << amount) | (high >>> (32 - amount));
        rhoPiState[destination + 1] = (high << amount) | (low >>> (32 - amount));
      } else {
        const reduced = amount - 32;
        rhoPiState[destination] = (high << reduced) | (low >>> (32 - reduced));
        rhoPiState[destination + 1] = (low << reduced) | (high >>> (32 - reduced));
      }
    }

    for (let lane = 0; lane < 25; lane++) {
      const word = 2 * lane;
      const nextWord = CHI_NEXT_WORDS[lane];
      const nextNextWord = CHI_NEXT_NEXT_WORDS[lane];
      state[word] = rhoPiState[word] ^ (~rhoPiState[nextWord] & rhoPiState[nextNextWord]);
      state[word + 1] = rhoPiState[word + 1] ^ (~rhoPiState[nextWord + 1] & rhoPiState[nextNextWord + 1]);
    }

    state[0] ^= ROUND_CONSTANTS_LOW[round];
    state[1] ^= ROUND_CONSTANTS_HIGH[round];
  }
}

export function absorbFullUint32Block(state, bytes, offset, rhoPiState, columnParity, thetaMix, roundCount) {
  for (let index = 0; index < SHA3_256_RATE_BYTES; index++) {
    const word = index >>> 2;
    state[word] ^= bytes[offset + index] << ((index & 3) * 8);
  }
  keccakP1600Uint32(state, rhoPiState, columnParity, thetaMix, roundCount);
}

function digestStateToHex(state) {
  let digest = "";
  for (let index = 0; index < SHA3_256_OUTPUT_BYTES; index++) {
    const byte = (state[index >>> 2] >>> ((index & 3) * 8)) & 0xff;
    digest += HEX_DIGITS[byte >>> 4] + HEX_DIGITS[byte & 0x0f];
  }
  return digest;
}

function sha3_256Uint32WithRoundCount(input, roundCount) {
  const bytes = new TextEncoder().encode(input);
  const state = new Uint32Array(50);
  const rhoPiState = new Uint32Array(50);
  const columnParity = new Uint32Array(10);
  const thetaMix = new Uint32Array(10);
  let offset = 0;

  while (offset + SHA3_256_RATE_BYTES <= bytes.length) {
    absorbFullUint32Block(state, bytes, offset, rhoPiState, columnParity, thetaMix, roundCount);
    offset += SHA3_256_RATE_BYTES;
  }

  const remaining = bytes.length - offset;
  for (let index = 0; index < remaining; index++) {
    state[index >>> 2] ^= bytes[offset + index] << ((index & 3) * 8);
  }
  state[remaining >>> 2] ^= SHA3_DOMAIN_SUFFIX << ((remaining & 3) * 8);
  state[(SHA3_256_RATE_BYTES - 1) >>> 2] ^= 0x80 << 24;
  keccakP1600Uint32(state, rhoPiState, columnParity, thetaMix, roundCount);
  return digestStateToHex(state);
}

export function deepSeekHashV1(input) {
  return sha3_256Uint32WithRoundCount(input, DEEPSEEK_HASH_ROUNDS);
}
