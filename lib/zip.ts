/**
 * Minimal, dependency-free ZIP builder (STORE method — no compression).
 * Good enough for bundling a handful of already-compressed files (PDFs,
 * images) for download. Produces a valid .zip that all OSes can open.
 */
import { deflateRawSync } from "zlib";

interface ZipEntry {
  name: string;
  data: Buffer;
}

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function dosDateTime(d = new Date()): { date: number; time: number } {
  const time = ((d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2))) & 0xffff;
  const date = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
  return { date, time };
}

/** De-duplicate names inside the archive (a.pdf, a (2).pdf, …) */
function uniqueNames(entries: ZipEntry[]): ZipEntry[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const lower = e.name.toLowerCase();
    const n = seen.get(lower) || 0;
    seen.set(lower, n + 1);
    if (n === 0) return e;
    const dot = e.name.lastIndexOf(".");
    const base = dot > 0 ? e.name.slice(0, dot) : e.name;
    const ext = dot > 0 ? e.name.slice(dot) : "";
    return { ...e, name: `${base} (${n + 1})${ext}` };
  });
}

/**
 * Build a ZIP buffer from a list of { name, data } entries.
 * Uses DEFLATE (raw) so PDFs/text shrink a bit; store for already-compressed.
 */
export function buildZip(rawEntries: ZipEntry[]): Buffer {
  const entries = uniqueNames(rawEntries);
  const { date, time } = dosDateTime();

  const fileParts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const crc = crc32(entry.data);
    const uncompressedSize = entry.data.length;

    // Try DEFLATE; fall back to STORE if it doesn't help
    const deflated = deflateRawSync(entry.data);
    const useDeflate = deflated.length < uncompressedSize;
    const method = useDeflate ? 8 : 0;
    const body = useDeflate ? deflated : entry.data;
    const compressedSize = body.length;

    // Local file header
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0x0800, 6);       // flags: UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressedSize, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);           // extra length

    fileParts.push(local, nameBuf, body);

    // Central directory header
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);              // version made by
    cd.writeUInt16LE(20, 6);             // version needed
    cd.writeUInt16LE(0x0800, 8);        // flags
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressedSize, 20);
    cd.writeUInt32LE(uncompressedSize, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);            // extra length
    cd.writeUInt16LE(0, 32);            // comment length
    cd.writeUInt16LE(0, 34);            // disk number
    cd.writeUInt16LE(0, 36);            // internal attrs
    cd.writeUInt32LE(0, 38);            // external attrs
    cd.writeUInt32LE(offset, 42);       // local header offset

    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const fileBuf = Buffer.concat(fileParts);

  // End of central directory
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(fileBuf.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([fileBuf, centralBuf, eocd]);
}
