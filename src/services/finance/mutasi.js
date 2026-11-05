import axios from "axios";

export async function checkMutasi({ service = "orderkuota", apiKey, qrId, minAmount, maxAmount } = {}) {
  const token = apiKey || process.env.MUTASI_API_KEY || process.env.ORKUT_API_KEY;
  if (!token) {
    throw new Error("MUTASI_API_KEY belum dikonfigurasi di .env");
  }

  // Integrasi OrderKuota / Gateways umum
  if (service === "orderkuota" || service === "orkut") {
    const username = process.env.ORKUT_USERNAME || process.env.MUTASI_USERNAME;
    const url = `https://gateway.orderkuota.com/api/v1/qris/mutasi?username=${username}&token=${token}`;
    
    try {
      const res = await axios.get(url, { timeout: 15000 });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      return list;
    } catch (err) {
      throw new Error(`Gagal menghubungi gateway mutasi: ${err.message}`);
    }
  }

  // Integrasi Moyab / Cekmutasi / generic webhook polling
  const fallbackUrl = process.env.MUTASI_ENDPOINT_URL;
  if (fallbackUrl) {
    const res = await axios.get(fallbackUrl, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });
    return Array.isArray(res.data?.data) ? res.data.data : [];
  }

  throw new Error("Penyedia mutasi tidak dikenali atau konfigurasi belum lengkap.");
}

export function findMatchingTransaction(transactions, expectedAmount, maxAgeMinutes = 15) {
  if (!Array.isArray(transactions) || transactions.length === 0) return null;

  const now = Date.now();
  const maxAgeMs = maxAgeMinutes * 60 * 1000;

  for (const tx of transactions) {
    const amount = Number(tx.amount || tx.nominal || tx.kredit || 0);
    const time = tx.timestamp ? new Date(tx.timestamp).getTime() : now;

    if (amount === Number(expectedAmount)) {
      if (now - time <= maxAgeMs) {
        return tx;
      }
    }
  }
  return null;
}
