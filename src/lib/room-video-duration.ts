const SEGMENT_BYTES = 16 * 1024 * 1024;

function findSequence(data: Uint8Array, sequence: readonly number[]) {
  outer: for (let index = 0; index <= data.length - sequence.length; index += 1) {
    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (data[index + offset] !== sequence[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

function parseMp4Duration(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const marker = findSequence(bytes, [0x6d, 0x76, 0x68, 0x64]); // mvhd
  if (marker < 0 || marker + 32 > bytes.length) return null;

  const view = new DataView(buffer);
  const version = view.getUint8(marker + 4);
  let timescale = 0;
  let duration = 0;

  if (version === 0 && marker + 24 <= bytes.length) {
    timescale = view.getUint32(marker + 16, false);
    duration = view.getUint32(marker + 20, false);
  } else if (version === 1 && marker + 36 <= bytes.length) {
    timescale = view.getUint32(marker + 24, false);
    duration = Number(view.getBigUint64(marker + 28, false));
  }

  if (!Number.isFinite(timescale) || timescale <= 0) return null;
  const seconds = duration / timescale;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function readVariableInteger(data: Uint8Array, offset: number) {
  const first = data[offset];
  if (first === undefined || first === 0) return null;
  let width = 1;
  let mask = 0x80;
  while (width <= 8 && (first & mask) === 0) {
    width += 1;
    mask >>= 1;
  }
  if (width > 8 || offset + width > data.length) return null;

  let value = first & (mask - 1);
  for (let index = 1; index < width; index += 1) {
    value = value * 256 + data[offset + index];
  }
  return { width, value };
}

function readUnsigned(data: Uint8Array, offset: number, length: number) {
  if (length < 1 || length > 8 || offset + length > data.length) return null;
  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value = value * 256 + data[offset + index];
  }
  return Number.isFinite(value) ? value : null;
}

function readFloat(data: Uint8Array, offset: number, length: number) {
  if ((length !== 4 && length !== 8) || offset + length > data.length) return null;
  const view = new DataView(data.buffer, data.byteOffset + offset, length);
  return length === 4 ? view.getFloat32(0, false) : view.getFloat64(0, false);
}

function readEbmlElement(
  data: Uint8Array,
  id: readonly number[],
  reader: (data: Uint8Array, offset: number, length: number) => number | null
) {
  const marker = findSequence(data, id);
  if (marker < 0) return null;
  const size = readVariableInteger(data, marker + id.length);
  if (!size) return null;
  return reader(data, marker + id.length + size.width, size.value);
}

function parseWebmDuration(buffer: ArrayBuffer) {
  const data = new Uint8Array(buffer);
  const duration = readEbmlElement(data, [0x44, 0x89], readFloat);
  if (!duration || !Number.isFinite(duration) || duration <= 0) return null;
  const scale =
    readEbmlElement(data, [0x2a, 0xd7, 0xb1], readUnsigned) ?? 1_000_000;
  const seconds = (duration * scale) / 1_000_000_000;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

async function readSegment(file: File, start: number, end: number) {
  return file.slice(start, end).arrayBuffer();
}

export async function readRoomVideoDuration(file: File) {
  const firstEnd = Math.min(file.size, SEGMENT_BYTES);
  const first = await readSegment(file, 0, firstEnd);
  const mime = file.type.trim().toLowerCase();

  const firstDuration =
    mime === "video/webm" ? parseWebmDuration(first) : parseMp4Duration(first);
  if (firstDuration) return Math.ceil(firstDuration);

  if (file.size > firstEnd && mime !== "video/webm") {
    const start = Math.max(0, file.size - SEGMENT_BYTES);
    const last = await readSegment(file, start, file.size);
    const lastDuration = parseMp4Duration(last);
    if (lastDuration) return Math.ceil(lastDuration);
  }

  throw new Error(
    "Unable to verify this video duration. Export it as MP4, MOV, or WebM and try again."
  );
}
