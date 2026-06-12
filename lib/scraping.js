import axios from 'axios';
import https from 'https';

// Mimic Chrome TLS client hello ciphers to bypass WAF/Cloudflare JA3/JA4 fingerprinting checks
const secureHttpsAgent = new https.Agent({
    ciphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-RSA-AES128-SHA',
        'ECDHE-RSA-AES256-SHA',
        'AES128-GCM-SHA256',
        'AES256-GCM-SHA384',
        'AES128-SHA',
        'AES256-SHA'
    ].join(':'),
    honorCipherOrder: true,
    minVersion: 'TLSv1.2',
    maxVersion: 'TLSv1.3'
});

// Browser profile templates for authentic header combinations
const browserProfiles = [
    {
        name: 'Windows Chrome',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/125.0.0.0 Safari/537.36',
        clientHints: {
            'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        }
    },
    {
        name: 'Android Chrome',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
        clientHints: {
            'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"'
        }
    },
    {
        name: 'iPhone Safari',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        clientHints: {} // Safari does not send client hints, keeping it authentic
    }
];

/**
 * Generates a cohesive set of headers mimicking a real web browser.
 * @returns {object}
 */
export function getCohesiveHeaders() {
    const profile = browserProfiles[Math.floor(Math.random() * browserProfiles.length)];
    return {
        'User-Agent': profile.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        ...profile.clientHints
    };
}

/**
 * Execute request function with retries and exponential backoff.
 * @param {function} requestFn 
 * @param {number} [retries=3] 
 * @param {number} [delay=1500] 
 * @returns {Promise<any>}
 */
async function executeWithRetry(requestFn, retries = 3, delay = 1500) {
    try {
        return await requestFn();
    } catch (err) {
        const status = err.response?.status;
        const isTransient = !status || status === 429 || (status >= 500 && status <= 504) || status === 302;
        if (retries > 0 && isTransient && status !== 302) {
            console.warn(`[Scraping Retry] Request failed (${status || err.message}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return executeWithRetry(requestFn, retries - 1, delay * 2);
        }
        throw err;
    }
}

/**
 * Fetches HTML from a URL with retry logic and JA3 bypass.
 * @param {string} url - Target URL.
 * @param {object} [options] - Additional axios config.
 * @returns {Promise<string>}
 */
export async function fetchHtml(url, options = {}) {
    return executeWithRetry(async () => {
        const res = await axios.get(url, {
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders(),
                ...(options.headers || {})
            },
            timeout: 15000,
            ...options
        });
        return res.data;
    });
}

/**
 * Fetches JSON from a URL with retry logic and JA3 bypass.
 * @param {string} url - Target URL.
 * @param {object} [options] - Additional axios config.
 * @returns {Promise<any>}
 */
export async function fetchJson(url, options = {}) {
    return executeWithRetry(async () => {
        const res = await axios.get(url, {
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders(),
                ...(options.headers || {})
            },
            timeout: 15000,
            ...options
        });
        return res;
    });
}

/**
 * Fetches data from a URL as an ArrayBuffer with retry logic and JA3 bypass.
 * @param {string} url - Target URL.
 * @param {object} [options] - Additional axios config.
 * @returns {Promise<Buffer>}
 */
export async function fetchBuffer(url, options = {}) {
    return executeWithRetry(async () => {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders(),
                ...(options.headers || {})
            },
            timeout: 25000,
            ...options
        });
        return Buffer.from(res.data);
    });
}

/**
 * Sends a POST request with urlencoded form parameters with retry logic and JA3 bypass.
 * @param {string} url - Target URL.
 * @param {object} data - Key-value pair payload.
 * @param {object} [options] - Additional axios config.
 * @returns {Promise<any>}
 */
export async function postForm(url, data, options = {}) {
    return executeWithRetry(async () => {
        const params = new URLSearchParams(data);
        const res = await axios.post(url, params.toString(), {
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders(),
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(options.headers || {})
            },
            timeout: 15000,
            ...options
        });
        return res;
    });
}

/**
 * Sends a POST request with a JSON payload with retry logic and JA3 bypass.
 * @param {string} url - Target URL.
 * @param {object} data - JSON payload.
 * @param {object} [options] - Additional axios config.
 * @returns {Promise<any>}
 */
export async function postJson(url, data, options = {}) {
    return executeWithRetry(async () => {
        const res = await axios.post(url, data, {
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders(),
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            timeout: 15000,
            ...options
        });
        return res.data;
    });
}
