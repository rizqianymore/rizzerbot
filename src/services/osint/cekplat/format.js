import { parsePlat } from "./parse.js";

export function formatPlatInfo(p) {
  const lines = [];
  lines.push(`*INFO PLAT*`);
  lines.push(`Plat: ${p.formatted}`);
  lines.push(`Kode Wilayah: ${p.kode}`);
  lines.push(`Provinsi: ${p.samsat?.provinsi || p.provinsi}`);
  lines.push(`Wilayah: ${p.wilayah}`);
  if (p.negara) lines.push(`Negara: ${p.negara}`);
  if (p.samsat?.daerah) lines.push(`Daerah: ${p.samsat.daerah}`);
  if (p.samsat?.samsat) lines.push(`Samsat: ${p.samsat.samsat}`);
  if (p.samsat?.alamat) lines.push(`Alamat: ${p.samsat.alamat}`);
  if (!p.samsat?.daerah) lines.push(`Cakupan: ${p.areas.join(", ")}`);
  lines.push(`No. Registrasi: ${p.angka}${p.suffix ? ` ${p.suffix}` : ""}`);
  lines.push(`Jenis: ${p.jenis}`);
  if (p.khusus) lines.push(`Khusus: ${p.khusus}`);
  return lines.join("\n");
}

export function getPlatInfoText(input) {
  const parsed = parsePlat(input);
  if (!parsed.valid) return null;
  return formatPlatInfo(parsed);
}
