#!/usr/bin/env node
const { checkEnvironment, formatDoctorReport } = await import("../src/utils/doctor.js");
const { nativeStatus } = await import("../src/utils/native.js");

const report = checkEnvironment();
console.log(formatDoctorReport(report));

const native = nativeStatus();
console.log("Modul native (opsional, ada fallback):");
for (const [name, ok] of Object.entries(native)) {
  console.log(`  ${ok ? "OK  " : "--  "} ${name}${ok ? "" : " (nonaktif sebagian, bot tetap jalan)"}`);
}

process.exit(report.coreOk ? 0 : 1);
