/**
 * Data sekolah untuk presensi Telkom Schools.
 *
 * Dipakai untuk:
 *  - menghitung jarak lokasi siswa ke sekolah (feed-back + pre-check radius)
 *  - menampilkan tautan Google Maps sekolah
 *  - (opsional, OFF by default) memakai koordinat sekolah sebagai lokasi
 *    absen — hanya sah kalau sekolah resmi mengizinkan (mematikan cek radius).
 */

const DEFAULT_SCHOOL = {
  name: "SMK Telkom Jakarta",
  latitude: -6.1544783,
  longitude: 106.7507579,
  address: "Jl. Daan Mogot KM 11, Kedaung Kali Angke, Cengkareng, Jakarta Barat",
  url: "https://www.google.com/maps/place/SMK+Telkom+Jakarta/@-6.1544288,106.7501684,19.03z/data=!4m14!1m7!3m6!1s0x2e69f7c113c644b5:0xa3a809c8c4627262!2sSMK+Telkom+Jakarta!8m2!3d-6.1544783!4d106.7507579!16s%2Fg%2F122dry26",
  radiusM: 150,
};

function num(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Data sekolah aktif (bisa dioverride lewat env). */
export function schoolInfo() {
  return {
    name: String(process.env.TELKOM_SCHOOL_NAME || DEFAULT_SCHOOL.name).trim(),
    latitude: num(process.env.TELKOM_SCHOOL_LAT, DEFAULT_SCHOOL.latitude),
    longitude: num(process.env.TELKOM_SCHOOL_LNG, DEFAULT_SCHOOL.longitude),
    address: String(process.env.TELKOM_SCHOOL_ADDRESS || DEFAULT_SCHOOL.address).trim(),
    url: String(process.env.TELKOM_SCHOOL_URL || DEFAULT_SCHOOL.url).trim(),
    radiusM: num(process.env.TELKOM_SCHOOL_RADIUS_M, DEFAULT_SCHOOL.radiusM),
  };
}

/**
 * True kalau lokasi siswa boleh dipakai apa adanya.
 * Kalau env TELKOM_USE_SCHOOL_LOCATION=1, koordinat sekolah yang dipakai
 * (hanya sah bila sekolah resmi mengizinkan).
 */
export function useSchoolLocation() {
  return !["0", "false", "no", "off"].includes(
    String(process.env.TELKOM_USE_SCHOOL_LOCATION ?? "1")
      .trim()
      .toLowerCase()
  );
}

/** Jarak dua titik (meter) — formula haversine. */
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (Number(deg) * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

/** Jarak lokasi siswa ke sekolah (meter). */
export function distanceToSchool(location) {
  if (!location) return null;
  const school = schoolInfo();
  return distanceMeters(Number(location.latitude), Number(location.longitude), school.latitude, school.longitude);
}

/** Tautan Google Maps untuk koordinat tertentu. */
export function mapsLink(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Ringkasan jarak untuk ditampilkan ke siswa. */
export function describeDistance(distance) {
  if (distance === null || distance === undefined) return "";
  if (distance < 1000) return `${distance} m dari sekolah`;
  return `${(distance / 1000).toFixed(1)} km dari sekolah`;
}
