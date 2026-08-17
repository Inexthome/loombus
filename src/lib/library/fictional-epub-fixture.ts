import { createHash } from "node:crypto";

const encoder = new TextEncoder();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Buffer {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value >>> 0, 0);
  return out;
}

function u32(value: number): Buffer {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value >>> 0, 0);
  return out;
}

export type FictionalEpubFixture = {
  buffer: Buffer;
  sha256: string;
  byteSize: number;
};

export function buildFictionalLibraryEpub(): FictionalEpubFixture {
  const files = [
    ["mimetype", "application/epub+zip"],
    ["META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`],
    ["OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?>\n<package version="3.0" xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Loombus Fictional EPUB Validation</dc:title><dc:creator>Loombus QA</dc:creator><dc:identifier>loombus-fictional-epub-validation</dc:identifier><dc:language>en</dc:language></metadata><manifest><item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/><itemref idref="c2"/></spine></package>`],
    ["OEBPS/chapter1.xhtml", `<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Validation Chapter One</title></head><body><h1>Validation Chapter One</h1><p>This is fictional EPUB content created solely to validate the Loombus ingestion pipeline.</p><script>throw new Error('must never execute')</script></body></html>`],
    ["OEBPS/chapter2.xhtml", `<?xml version="1.0" encoding="UTF-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Validation Chapter Two</title></head><body><h1>Validation Chapter Two</h1><p>Normalized sections, stable locators, private reading progress, highlights, and notes remain separate from the original EPUB object.</p></body></html>`],
  ] as const;

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, text] of files) {
    const nameBytes = Buffer.from(encoder.encode(name));
    const data = Buffer.from(encoder.encode(text));
    const checksum = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(checksum), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data,
    ]);
    localParts.push(local);

    const central = Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(checksum), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]);
    centralParts.push(central);
    offset += local.length;
  }

  const localBody = Buffer.concat(localParts);
  const centralBody = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBody.length), u32(localBody.length), u16(0),
  ]);
  const buffer = Buffer.concat([localBody, centralBody, end]);
  return {
    buffer,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    byteSize: buffer.length,
  };
}
