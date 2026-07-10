const CRC_TABLE = new Uint32Array(256);

for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let bit = 0; bit < 8; bit++) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  CRC_TABLE[i] = crc >>> 0;
}

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getSeconds() >> 1) | (date.getMinutes() << 5) | (date.getHours() << 11);
  const dosDate =
    date.getDate() | ((date.getMonth() + 1) << 5) | ((date.getFullYear() - 1980) << 9);
  return { time, date: dosDate };
}

export type ZipEntry = { name: string; data: Uint8Array };

/** Uncompressed ZIP (STORE) — hashes of members stay independent of the archive. */
export function buildZipStore(files: ZipEntry[], now = new Date()): Uint8Array {
  const { time, date } = dosDateTime(now);
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const checksum = crc32(file.data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(1 << 11),
      u16(0),
      u16(time),
      u16(date),
      u32(checksum),
      u32(file.data.byteLength),
      u32(file.data.byteLength),
      u16(name.byteLength),
      u16(0),
      name,
      file.data,
    ]);
    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(1 << 11),
      u16(0),
      u16(time),
      u16(date),
      u32(checksum),
      u32(file.data.byteLength),
      u32(file.data.byteLength),
      u16(name.byteLength),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.byteLength;
  }

  const centralDir = concat(centrals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.byteLength),
    u32(offset),
    u16(0),
  ]);
  return concat([...locals, centralDir, eocd]);
}
