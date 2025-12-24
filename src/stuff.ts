
interface Story {
  type: string;
  teaser: {
    title: string;
    intro: string;
    image: {
      id: string;
      alt: string;
      url: string;
    }
  }
  author: {
    id: string;
    name: string;
    jobTitle: string;
    email: string;
    biography: string;
    location: string;
    url: string;
  }
  updatedDate: string; // ISO 8601 date string
  publishedDate: string; // ISO 8601 date string
}

export async function requestStory(storyId: number): Promise<Story> {
  const response = await fetch(`https://www.stuff.co.nz/api/v1.0/stuff/story/${storyId}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const data = await response.json();
  return data as Story;
}

// everything below this was vibe-coded, honestly IDK how well it works
export async function getImageSize(url: string): Promise<{ width: number; height: number } | null> {
  try {
    // Fetch first chunk of the resource using Range to avoid downloading full image
    const maxProbeSize = 512 * 1024; // 512KB should cover headers/metadata for most formats
    const res = await fetch(url, { headers: { 'Range': `bytes=0-${maxProbeSize - 1}` } });
    if (!res.ok && res.status !== 206) {
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length === 0) return null;

    // Try parsers in common order
    return (
      parsePNG(buf) ||
      parseGIF(buf) ||
      parseJPEG(buf) ||
      parseWEBP(buf) ||
      null
    );
  } catch {
    return null;
  }
}

function parsePNG(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG signature
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let i = 0; i < sig.length; i++) {
    if (bytes[i] !== sig[i]) return null;
  }
  // IHDR chunk starts at offset 8: length(4) + type(4) + data...
  if (bytes.length < 24) return null;
  const type = readString(bytes, 12, 4);
  if (type !== 'IHDR') return null;
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function parseGIF(bytes: Uint8Array): { width: number; height: number } | null {
  // GIF87a / GIF89a
  if (bytes.length < 10) return null;
  const header = readString(bytes, 0, 6);
  if (header !== 'GIF87a' && header !== 'GIF89a') return null;
  const width = readUint16LE(bytes, 6);
  const height = readUint16LE(bytes, 8);
  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function parseJPEG(bytes: Uint8Array): { width: number; height: number } | null {
  // JPEG starts with 0xFFD8
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  let offset = 2;
  while (offset + 1 < bytes.length) {
    // Find next marker
    if (bytes[offset] !== 0xFF) { offset++; continue; }
    let marker = bytes[offset + 1];
    // Skip padding FFs
    while (marker === 0xFF && offset + 2 < bytes.length) {
      offset++;
      marker = bytes[offset + 1];
    }
    offset += 2;

    // Standalone markers without length
    if (marker === 0xD8 || marker === 0xD9) {
      continue;
    }
    if (offset + 1 >= bytes.length) break;
    const length = readUint16BE(bytes, offset);
    if (length < 2) return null;
    // SOFn markers define the frame header containing size
    if (
      (marker >= 0xC0 && marker <= 0xC3) ||
      (marker >= 0xC5 && marker <= 0xC7) ||
      (marker >= 0xC9 && marker <= 0xCB) ||
      (marker >= 0xCD && marker <= 0xCF)
    ) {
      if (offset + 7 >= bytes.length) return null;
      const precision = bytes[offset + 2];
      // height/width are next 2 + 2 bytes (big-endian)
      const height = readUint16BE(bytes, offset + 3);
      const width = readUint16BE(bytes, offset + 5);
      if (precision === 0 || width === 0 || height === 0) return null;
      return { width, height };
    }
    offset += length;
  }
  return null;
}

function parseWEBP(bytes: Uint8Array): { width: number; height: number } | null {
  // RIFF....WEBP
  if (bytes.length < 16) return null;
  if (readString(bytes, 0, 4) !== 'RIFF') return null;
  if (readString(bytes, 8, 4) !== 'WEBP') return null;

  let offset = 12; // first chunk after RIFF+WEBP
  while (offset + 8 <= bytes.length) {
    const chunkTag = readString(bytes, offset, 4);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const chunkDataStart = offset + 8;
    if (chunkDataStart + chunkSize > bytes.length) break;

    if (chunkTag === 'VP8X') {
      if (chunkSize < 10) return null;
      // VP8X: 1 byte flags, 3 reserved, then 3 bytes (LE) width-1, 3 bytes (LE) height-1
      const w = readUint24LE(bytes, chunkDataStart + 4) + 1;
      const h = readUint24LE(bytes, chunkDataStart + 7) + 1;
      if (w > 0 && h > 0) return { width: w, height: h };
      return null;
    }

    if (chunkTag === 'VP8L') {
      // Lossless: first byte signature should be 0x2F, next 4 bytes contain size info
      if (chunkSize < 5) return null;
      const sig = bytes[chunkDataStart];
      if (sig !== 0x2F) return null;
      const b0 = bytes[chunkDataStart + 1];
      const b1 = bytes[chunkDataStart + 2];
      const b2 = bytes[chunkDataStart + 3];
      const b3 = bytes[chunkDataStart + 4];
      const width = 1 + ((b0 | ((b1 & 0x3F) << 8)) >>> 0);
      const height = 1 + ((((b1 >> 6) | (b2 << 2) | ((b3 & 0x0F) << 10))) >>> 0);
      if (width > 0 && height > 0) return { width, height };
      return null;
    }

    if (chunkTag === 'VP8 ') {
      // Lossy: look for signature 0x9D 0x01 0x2A then 2 bytes LE width/height
      // The signature typically appears at offset 3 within the keyframe header
      // but commonly at chunkDataStart + 3 or +10 depending on frame tag.
      // We'll scan the first 64 bytes of the chunk for signature.
      const scanEnd = Math.min(chunkDataStart + chunkSize, chunkDataStart + 64);
      for (let i = chunkDataStart; i + 7 < scanEnd; i++) {
        if (bytes[i] === 0x9D && bytes[i + 1] === 0x01 && bytes[i + 2] === 0x2A) {
          const w = readUint16LE(bytes, i + 3) & 0x3FFF;
          const h = readUint16LE(bytes, i + 5) & 0x3FFF;
          if (w > 0 && h > 0) return { width: w, height: h };
          break;
        }
      }
    }

    // Chunks are padded to even sizes
    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }
  return null;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  if (offset + length > bytes.length) return '';
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return 0;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  if (offset + 3 > bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (
    (bytes[offset]) |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (
    (bytes[offset] << 24) >>> 0 |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    (bytes[offset + 3])
  ) >>> 0;
}