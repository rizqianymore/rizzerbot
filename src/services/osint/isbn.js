import axios from "axios";

const UA =
  "Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36";

const client = axios.create({
  timeout: 15000,
  validateStatus: () => true,
});

const OPENLIBRARY_BASE = "https://openlibrary.org";
const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1";

function normalizeIsbn(input) {
  return String(input || "")
    .replace(/[^0-9Xx]/g, "")
    .toUpperCase();
}

function isValidIsbn10(isbn) {
  if (isbn.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const ch = isbn[i];
    if (!/^\d$/.test(ch)) return false;
    sum += parseInt(ch, 10) * (10 - i);
  }
  const last = isbn[9];
  if (last === "X") sum += 10;
  else if (/^\d$/.test(last)) sum += parseInt(last, 10);
  else return false;
  return sum % 11 === 0;
}

function isValidIsbn13(isbn) {
  if (isbn.length !== 13) return false;
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(isbn[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(isbn[12], 10);
}

export function validateIsbn(isbn) {
  const clean = normalizeIsbn(isbn);
  if (clean.length === 10) return { valid: isValidIsbn10(clean), clean, type: "ISBN-10" };
  if (clean.length === 13) return { valid: isValidIsbn13(clean), clean, type: "ISBN-13" };
  return { valid: false, clean, type: "UNKNOWN", reason: "ISBN harus 10 atau 13 digit" };
}

async function fetchOpenLibrary(isbn) {
  const clean = normalizeIsbn(isbn);
  const url = `${OPENLIBRARY_BASE}/api/books?bibkeys=ISBN:${clean}&format=json&jscmd=data`;
  const res = await client.get(url, { headers: { "User-Agent": UA } });
  if (res.status !== 200) throw new Error(`OpenLibrary HTTP ${res.status}`);
  const key = `ISBN:${clean}`;
  const data = res.data[key];
  if (!data) return null;

  return {
    source: "OpenLibrary",
    title: data.title || "-",
    authors: (data.authors || []).map((a) => a.name).join(", ") || "-",
    publisher: (data.publishers || []).map((p) => p.name).join(", ") || "-",
    publishDate: data.publish_date || "-",
    pages: data.number_of_pages || "-",
    isbn10: (data.identifiers?.isbn_10 || []).join(", ") || "-",
    isbn13: (data.identifiers?.isbn_13 || []).join(", ") || "-",
    subjects:
      (data.subjects || [])
        .slice(0, 10)
        .map((s) => s.name)
        .join(", ") || "-",
    coverUrl: data.cover?.large || data.cover?.medium || data.cover?.small || null,
    openLibraryUrl: data.url || `https://openlibrary.org/isbn/${clean}`,
    raw: data,
  };
}

async function fetchGoogleBooks(isbn) {
  const clean = normalizeIsbn(isbn);
  const url = `${GOOGLE_BOOKS_BASE}/volumes?q=isbn:${clean}`;
  const res = await client.get(url, { headers: { "User-Agent": UA } });
  if (res.status !== 200) throw new Error(`Google Books HTTP ${res.status}`);
  const items = res.data.items;
  if (!items || items.length === 0) return null;

  const v = items[0].volumeInfo;
  return {
    source: "Google Books",
    title: v.title || "-",
    authors: (v.authors || []).join(", ") || "-",
    publisher: v.publisher || "-",
    publishDate: v.publishedDate || "-",
    pages: v.pageCount || "-",
    isbn10:
      (v.industryIdentifiers || [])
        .filter((i) => i.type === "ISBN_10")
        .map((i) => i.identifier)
        .join(", ") || "-",
    isbn13:
      (v.industryIdentifiers || [])
        .filter((i) => i.type === "ISBN_13")
        .map((i) => i.identifier)
        .join(", ") || "-",
    subjects: (v.categories || []).join(", ") || "-",
    coverUrl: v.imageLinks?.large || v.imageLinks?.medium || v.imageLinks?.small || v.imageLinks?.thumbnail || null,
    googleBooksUrl: v.infoLink || `https://books.google.com/books?vid=ISBN${clean}`,
    raw: v,
  };
}

export async function searchIsbn(isbn) {
  const validation = validateIsbn(isbn);
  if (!validation.valid) {
    throw new Error(validation.reason || "ISBN tidak valid");
  }

  const clean = validation.clean;
  let result = null;
  const errors = [];

  // Try OpenLibrary first (free, no key, good coverage)
  try {
    result = await fetchOpenLibrary(clean);
    if (result) return { ...result, validation };
  } catch (err) {
    errors.push(`OpenLibrary: ${err.message}`);
  }

  // Fallback to Google Books
  try {
    result = await fetchGoogleBooks(clean);
    if (result) return { ...result, validation };
  } catch (err) {
    errors.push(`Google Books: ${err.message}`);
  }

  if (!result) {
    throw new Error(`Buku tidak ditemukan di OpenLibrary & Google Books. ${errors.join("; ")}`);
  }

  return { ...result, validation };
}

export async function searchBookByTitle(title) {
  if (!title || title.trim().length < 2) {
    throw new Error("Judul terlalu pendek (minimal 2 karakter)");
  }

  const q = title.trim();

  // Try OpenLibrary search
  try {
    const url = `${OPENLIBRARY_BASE}/search.json?q=${encodeURIComponent(q)}&limit=5`;
    const res = await client.get(url, { headers: { "User-Agent": UA } });
    if (res.status === 200 && res.data.docs && res.data.docs.length > 0) {
      const doc = res.data.docs[0];
      return {
        source: "OpenLibrary (Search)",
        title: doc.title || "-",
        authors: (doc.author_name || []).join(", ") || "-",
        publisher: (doc.publisher || []).slice(0, 3).join(", ") || "-",
        publishDate: doc.first_publish_year ? String(doc.first_publish_year) : "-",
        pages: doc.number_of_pages_median || "-",
        isbn10: (doc.isbn || []).find((i) => i.length === 10) || "-",
        isbn13: (doc.isbn || []).find((i) => i.length === 13) || "-",
        subjects: (doc.subject || []).slice(0, 10).join(", ") || "-",
        coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
        openLibraryUrl: `https://openlibrary.org${doc.key}`,
        raw: doc,
      };
    }
  } catch (err) {
    console.warn("[ISBN] OpenLibrary search error:", err.message);
  }

  // Fallback to Google Books search
  try {
    const url = `${GOOGLE_BOOKS_BASE}/volumes?q=intitle:${encodeURIComponent(q)}&maxResults=5`;
    const res = await client.get(url, { headers: { "User-Agent": UA } });
    if (res.status === 200 && res.data.items && res.data.items.length > 0) {
      const v = res.data.items[0].volumeInfo;
      return {
        source: "Google Books (Search)",
        title: v.title || "-",
        authors: (v.authors || []).join(", ") || "-",
        publisher: v.publisher || "-",
        publishDate: v.publishedDate || "-",
        pages: v.pageCount || "-",
        isbn10:
          (v.industryIdentifiers || [])
            .filter((i) => i.type === "ISBN_10")
            .map((i) => i.identifier)
            .join(", ") || "-",
        isbn13:
          (v.industryIdentifiers || [])
            .filter((i) => i.type === "ISBN_13")
            .map((i) => i.identifier)
            .join(", ") || "-",
        subjects: (v.categories || []).join(", ") || "-",
        coverUrl: v.imageLinks?.large || v.imageLinks?.medium || v.imageLinks?.small || v.imageLinks?.thumbnail || null,
        googleBooksUrl: v.infoLink || "-",
        raw: v,
      };
    }
  } catch (err) {
    console.warn("[ISBN] Google Books search error:", err.message);
  }

  throw new Error("Buku tidak ditemukan (coba cari via ISBN untuk hasil lebih akurat)");
}

export function formatIsbnResult(data) {
  const { validation, ...book } = data;
  let text = `📚 *CEK ISBN*\n\n`;
  text += `*${book.title}*\n\n`;
  text += `✍️ *Penulis:* ${book.authors}\n`;
  text += `🏢 *Penerbit:* ${book.publisher}\n`;
  text += `📅 *Tahun Terbit:* ${book.publishDate}\n`;
  text += `📄 *Halaman:* ${book.pages}\n`;
  text += `🔖 *ISBN-10:* ${book.isbn10}\n`;
  text += `🔖 *ISBN-13:* ${book.isbn13}\n`;
  text += `📂 *Subjek/Kategori:* ${book.subjects}\n`;
  text += `🌐 *Sumber:* ${book.source}\n`;
  if (book.openLibraryUrl) text += `🔗 *OpenLibrary:* ${book.openLibraryUrl}\n`;
  if (book.googleBooksUrl) text += `🔗 *Google Books:* ${book.googleBooksUrl}\n`;
  if (validation) text += `\n_Tipe: ${validation.type} (${validation.clean})_`;
  return text;
}
