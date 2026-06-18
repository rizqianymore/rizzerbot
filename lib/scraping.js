import axios from 'axios';
import https from 'https';
import crypto from 'crypto';

const createSecureAgent = () => {
    const ciphers = [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256',
        'ECDHE-ECDSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-ECDSA-CHACHA20-POLY1305',
        'ECDHE-RSA-CHACHA20-POLY1305',
        'ECDHE-ECDSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES128-GCM-SHA256',
        'AES256-GCM-SHA384',
        'AES128-GCM-SHA256'
    ].join(':');

    return new https.Agent({
        ciphers,
        honorCipherOrder: true,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        rejectUnauthorized: false,
        keepAlive: true,
        keepAliveMsecs: 30000,
        maxSockets: 50,
        maxFreeSockets: 10,
        scheduling: 'lifo'
    });
};

const secureHttpsAgent = createSecureAgent();

const browserProfiles = [
    {
        name: 'Windows Chrome 125',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        clientHints: {
            'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-ch-ua-full-version': '"125.0.6422.112"',
            'sec-ch-ua-platform-version': '"15.0.0"'
        },
        acceptLanguage: 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    {
        name: 'macOS Chrome 125',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        clientHints: {
            'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'sec-ch-ua-full-version': '"125.0.6422.112"',
            'sec-ch-ua-platform-version': '"14.5.0"'
        },
        acceptLanguage: 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    {
        name: 'Android Chrome 125',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
        clientHints: {
            'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"',
            'sec-ch-ua-full-version': '"125.0.6422.112"',
            'sec-ch-ua-platform-version': '"14"'
        },
        acceptLanguage: 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    {
        name: 'iPhone Safari 17.5',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        clientHints: {},
        acceptLanguage: 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
    }
];

function getRandomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRequestId() {
    return crypto.randomBytes(8).toString('hex');
}

export function getCohesiveHeaders(method = 'GET') {
    const profile = browserProfiles[Math.floor(Math.random() * browserProfiles.length)];
    const isPost = method.toUpperCase() === 'POST';

    const baseHeaders = {
        'User-Agent': profile.userAgent,
        'Accept': isPost
            ? 'application/json, text/plain, */*'
            : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': profile.acceptLanguage,
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Connection': 'keep-alive',
        ...profile.clientHints
    };

    if (!isPost) {
        Object.assign(baseHeaders, {
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1'
        });
    } else {
        Object.assign(baseHeaders, {
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
        });
    }

    return baseHeaders;
}

async function executeWithRetry(requestFn, retries = 3, baseDelay = 1500) {
    const requestId = generateRequestId();

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await requestFn();
            return result;
        } catch (err) {
            const status = err.response?.status;
            const errorMessage = err.message || 'Unknown error';

            const isTransient = !status ||
                status === 429 ||
                (status >= 500 && status <= 504) ||
                status === 302 ||
                errorMessage.includes('ECONNRESET') ||
                errorMessage.includes('ETIMEDOUT');

            if (!isTransient && status && status >= 400 && status < 500 && status !== 429) {
                throw err;
            }

            if (attempt >= retries) {
                throw err;
            }

            const delay = baseDelay * Math.pow(2, attempt) + getRandomDelay(0, 500);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function isValidUrl(url) {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

export async function fetchHtml(url, options = {}) {
    if (!isValidUrl(url)) {
        throw new Error(`Invalid URL: ${url}`);
    }

    return executeWithRetry(async () => {
        const res = await axios.get(url, {
            httpsAgent: secureHttpsAgent,
            headers: getCohesiveHeaders('GET'),
            timeout: options.timeout || 15000,
            decompress: true,
            maxRedirects: 5,
            validateStatus: (status) => status < 400 || status === 429,
            ...options
        });

        return res.data;
    }, options.retries || 3, options.baseDelay || 1500);
}

export async function fetchJson(url, options = {}) {
    if (!isValidUrl(url)) {
        throw new Error(`Invalid URL: ${url}`);
    }

    return executeWithRetry(async () => {
        const res = await axios.get(url, {
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders('GET'),
                'Accept': 'application/json, text/plain, */*',
                ...(options.headers || {})
            },
            timeout: options.timeout || 15000,
            decompress: true,
            maxRedirects: 5,
            validateStatus: (status) => status < 400 || status === 429,
            responseType: 'json',
            ...options
        });

        return res;
    }, options.retries || 3, options.baseDelay || 1500);
}

export async function fetchBuffer(url, options = {}) {
    if (!isValidUrl(url)) {
        throw new Error(`Invalid URL: ${url}`);
    }

    return executeWithRetry(async () => {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders('GET'),
                'Accept': '*/*',
                ...(options.headers || {})
            },
            timeout: options.timeout || 25000,
            decompress: true,
            maxRedirects: 5,
            validateStatus: (status) => status < 400 || status === 429,
            ...options
        });

        return Buffer.from(res.data);
    }, options.retries || 3, options.baseDelay || 1500);
}

export async function postForm(url, data, options = {}) {
    if (!isValidUrl(url)) {
        throw new Error(`Invalid URL: ${url}`);
    }

    return executeWithRetry(async () => {
        const params = new URLSearchParams(data);
        const res = await axios.post(url, params.toString(), {
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders('POST'),
                'Content-Type': 'application/x-www-form-urlencoded',
                ...(options.headers || {})
            },
            timeout: options.timeout || 15000,
            decompress: true,
            maxRedirects: 5,
            validateStatus: (status) => status < 400 || status === 429,
            ...options
        });

        return res;
    }, options.retries || 3, options.baseDelay || 1500);
}

export async function postJson(url, data, options = {}) {
    if (!isValidUrl(url)) {
        throw new Error(`Invalid URL: ${url}`);
    }

    return executeWithRetry(async () => {
        const res = await axios.post(url, data, {
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders('POST'),
                'Content-Type': 'application/json',
                ...(options.headers || {})
            },
            timeout: options.timeout || 15000,
            decompress: true,
            maxRedirects: 5,
            validateStatus: (status) => status < 400 || status === 429,
            responseType: 'json',
            ...options
        });

        return res.data;
    }, options.retries || 3, options.baseDelay || 1500);
}

export async function customRequest(url, config = {}) {
    if (!isValidUrl(url)) {
        throw new Error(`Invalid URL: ${url}`);
    }

    const method = (config.method || 'GET').toUpperCase();

    return executeWithRetry(async () => {
        const res = await axios({
            url,
            httpsAgent: secureHttpsAgent,
            headers: {
                ...getCohesiveHeaders(method),
                ...(config.headers || {})
            },
            timeout: config.timeout || 15000,
            decompress: true,
            maxRedirects: config.maxRedirects || 5,
            validateStatus: config.validateStatus || ((status) => status < 400 || status === 429),
            ...config
        });

        return res;
    }, config.retries || 3, config.baseDelay || 1500);
}

export default {
    fetchHtml,
    fetchJson,
    fetchBuffer,
    postForm,
    postJson,
    customRequest,
    getCohesiveHeaders
};