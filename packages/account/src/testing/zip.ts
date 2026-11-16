// Reads a zip as the export job writes it (stored or deflated entries, no
// zip64), through its central directory, checking each entry's CRC-32 and
// size: what a player's unzip tool would see.

import { crc32, inflateRawSync } from 'node:zlib';

/** Each entry's path and UTF-8 text, in archive order. */
export function readZip(bytes: Uint8Array): Map<string, string> {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('not a zip: no end of central directory');
  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const files = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    if (buffer.readUInt32LE(at) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buffer.readUInt16LE(at + 10);
    const crc = buffer.readUInt32LE(at + 16);
    const compressed = buffer.readUInt32LE(at + 20);
    const size = buffer.readUInt32LE(at + 24);
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    const offset = buffer.readUInt32LE(at + 42);
    const name = buffer.toString('utf8', at + 46, at + 46 + nameLength);
    if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error(`bad local header for ${name}`);
    const dataAt = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const data = buffer.subarray(dataAt, dataAt + compressed);
    const raw = method === 8 ? inflateRawSync(data) : method === 0 ? data : null;
    if (!raw) throw new Error(`unsupported method ${method} for ${name}`);
    if (raw.length !== size || crc32(raw) !== crc) throw new Error(`corrupt entry ${name}`);
    files.set(name, raw.toString('utf8'));
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
