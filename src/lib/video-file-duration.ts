const ISO_BOX_HEADER_BYTES = 16;
const MAX_ISO_BOX_COUNT = 10000;
const MAX_WEBM_METADATA_BYTES = 4 * 1024 * 1024;
const WEBM_DEFAULT_TIMECODE_SCALE = 1_000_000;
const UINT32_MULTIPLIER = 0x1_0000_0000;

const WEBM_SEGMENT_ID = 0x18538067;
const WEBM_INFO_ID = 0x1549a966;
const WEBM_TIMECODE_SCALE_ID = 0x2ad7b1;
const WEBM_DURATION_ID = 0x4489;

type IsoBoxHeader = {
  type: string;
  start: number;
  payloadStart: number;
  end: number;
};

type EbmlVint = {
  value: number;
  length: number;
  unknown: boolean;
};

function readUint64(view: DataView, offset: number) {
  const high = view.getUint32(offset, false);
  const low = view.getUint32(offset + 4, false);
  const value = high * UINT32_MULTIPLIER + low;

  if (!Number.isSafeInteger(value)) {
    throw new Error("Video metadata value is too large.");
  }

  return value;
}

function readAscii(view: DataView, offset: number, length: number) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

async function readIsoBoxHeader(
  file: File,
  offset: number,
  boundary: number
): Promise<IsoBoxHeader | null> {
  if (offset < 0 || offset + 8 > boundary || offset + 8 > file.size) {
    return null;
  }

  const headerBuffer = await file
    .slice(offset, Math.min(offset + ISO_BOX_HEADER_BYTES, boundary, file.size))
    .arrayBuffer();
  if (headerBuffer.byteLength < 8) return null;

  const view = new DataView(headerBuffer);
  const size32 = view.getUint32(0, false);
  const type = readAscii(view, 4, 4);
  let headerSize = 8;
  let boxSize: number;

  if (size32 === 1) {
    if (headerBuffer.byteLength < 16) {
      throw new Error("Video metadata contains an incomplete extended box.");
    }
    headerSize = 16;
    boxSize = readUint64(view, 8);
  } else if (size32 === 0) {
    boxSize = boundary - offset;
  } else {
    boxSize = size32;
  }

  if (boxSize < headerSize) {
    throw new Error("Video metadata contains an invalid box size.");
  }

  const end = offset + boxSize;
  if (end > boundary || end > file.size) {
    throw new Error("Video metadata box exceeds the file boundary.");
  }

  return {
    type,
    start: offset,
    payloadStart: offset + headerSize,
    end,
  };
}

async function findIsoBox(
  file: File,
  start: number,
  end: number,
  targetType: string
) {
  let offset = start;
  let boxCount = 0;

  while (offset + 8 <= end && boxCount < MAX_ISO_BOX_COUNT) {
    const box = await readIsoBoxHeader(file, offset, end);
    if (!box) break;
    if (box.type === targetType) return box;
    if (box.end <= offset) break;
    offset = box.end;
    boxCount += 1;
  }

  return null;
}

async function readIsoDurationSeconds(file: File) {
  const movieBox = await findIsoBox(file, 0, file.size, "moov");
  if (!movieBox) {
    throw new Error("The video does not contain a readable movie header.");
  }

  const movieHeaderBox = await findIsoBox(
    file,
    movieBox.payloadStart,
    movieBox.end,
    "mvhd"
  );
  if (!movieHeaderBox) {
    throw new Error("The video does not contain duration metadata.");
  }

  const metadataBuffer = await file
    .slice(
      movieHeaderBox.payloadStart,
      Math.min(movieHeaderBox.payloadStart + 40, movieHeaderBox.end)
    )
    .arrayBuffer();
  if (metadataBuffer.byteLength < 20) {
    throw new Error("The video duration metadata is incomplete.");
  }

  const view = new DataView(metadataBuffer);
  const version = view.getUint8(0);
  let timescale: number;
  let duration: number;

  if (version === 0) {
    timescale = view.getUint32(12, false);
    duration = view.getUint32(16, false);
  } else if (version === 1) {
    if (metadataBuffer.byteLength < 32) {
      throw new Error("The video duration metadata is incomplete.");
    }
    timescale = view.getUint32(20, false);
    duration = readUint64(view, 24);
  } else {
    throw new Error("The video uses an unsupported movie-header version.");
  }

  if (!timescale || !duration) {
    throw new Error("The video duration metadata is empty.");
  }

  const durationSeconds = duration / timescale;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("The video duration could not be calculated.");
  }

  return Math.ceil(durationSeconds);
}

function readEbmlVint(
  bytes: Uint8Array,
  offset: number,
  removeMarker: boolean
): EbmlVint | null {
  if (offset >= bytes.length) return null;

  const firstByte = bytes[offset];
  let marker = 0x80;
  let length = 1;

  while (length <= 8 && (firstByte & marker) === 0) {
    marker >>= 1;
    length += 1;
  }

  if (length > 8 || offset + length > bytes.length) {
    return null;
  }

  const markerPayload = firstByte & (marker - 1);
  let value = removeMarker ? markerPayload : firstByte;
  let unknown = removeMarker && markerPayload === marker - 1;

  for (let index = 1; index < length; index += 1) {
    const nextByte = bytes[offset + index];
    value = value * 256 + nextByte;
    if (!Number.isSafeInteger(value)) {
      throw new Error("WebM metadata value is too large.");
    }
    if (removeMarker && nextByte !== 0xff) {
      unknown = false;
    }
  }

  return { value, length, unknown };
}

function readEbmlUnsigned(bytes: Uint8Array, start: number, length: number) {
  if (length <= 0 || length > 8 || start + length > bytes.length) {
    throw new Error("WebM integer metadata is invalid.");
  }

  let value = 0;
  for (let index = 0; index < length; index += 1) {
    value = value * 256 + bytes[start + index];
    if (!Number.isSafeInteger(value)) {
      throw new Error("WebM integer metadata is too large.");
    }
  }
  return value;
}

function readEbmlFloat(bytes: Uint8Array, start: number, length: number) {
  if (start + length > bytes.length) {
    throw new Error("WebM floating-point metadata is incomplete.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset + start, length);
  if (length === 4) return view.getFloat32(0, false);
  if (length === 8) return view.getFloat64(0, false);
  throw new Error("WebM duration metadata uses an unsupported size.");
}

function findEbmlElement(
  bytes: Uint8Array,
  start: number,
  end: number,
  targetId: number
) {
  let offset = start;

  while (offset < end && offset < bytes.length) {
    const id = readEbmlVint(bytes, offset, false);
    if (!id) return null;
    const size = readEbmlVint(bytes, offset + id.length, true);
    if (!size) return null;

    const payloadStart = offset + id.length + size.length;
    const declaredEnd = size.unknown ? end : payloadStart + size.value;
    const payloadEnd = Math.min(declaredEnd, end, bytes.length);

    if (id.value === targetId) {
      return {
        payloadStart,
        payloadEnd,
        complete: size.unknown || declaredEnd <= bytes.length,
      };
    }

    if (declaredEnd <= offset || declaredEnd > bytes.length) {
      return null;
    }
    offset = declaredEnd;
  }

  return null;
}

async function readWebmDurationSeconds(file: File) {
  const metadataBuffer = await file
    .slice(0, Math.min(file.size, MAX_WEBM_METADATA_BYTES))
    .arrayBuffer();
  const bytes = new Uint8Array(metadataBuffer);
  const segment = findEbmlElement(bytes, 0, bytes.length, WEBM_SEGMENT_ID);
  if (!segment) {
    throw new Error("The WebM segment metadata could not be found.");
  }

  const info = findEbmlElement(
    bytes,
    segment.payloadStart,
    segment.payloadEnd,
    WEBM_INFO_ID
  );
  if (!info || !info.complete) {
    throw new Error("The WebM information block could not be read.");
  }

  let timecodeScale = WEBM_DEFAULT_TIMECODE_SCALE;
  let durationUnits: number | null = null;
  let offset = info.payloadStart;

  while (offset < info.payloadEnd) {
    const id = readEbmlVint(bytes, offset, false);
    if (!id) break;
    const size = readEbmlVint(bytes, offset + id.length, true);
    if (!size || size.unknown) break;

    const payloadStart = offset + id.length + size.length;
    const payloadLength = size.value;
    const payloadEnd = payloadStart + payloadLength;
    if (payloadEnd > info.payloadEnd || payloadEnd > bytes.length) break;

    if (id.value === WEBM_TIMECODE_SCALE_ID) {
      timecodeScale = readEbmlUnsigned(bytes, payloadStart, payloadLength);
    } else if (id.value === WEBM_DURATION_ID) {
      durationUnits = readEbmlFloat(bytes, payloadStart, payloadLength);
    }

    offset = payloadEnd;
  }

  if (!durationUnits || !timecodeScale) {
    throw new Error("The WebM duration metadata is empty.");
  }

  const durationSeconds =
    (durationUnits * timecodeScale) / 1_000_000_000;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("The WebM duration could not be calculated.");
  }

  return Math.ceil(durationSeconds);
}

export async function readVideoFileDurationSeconds(file: File) {
  const mimeType = file.type.trim().toLowerCase();

  if (mimeType === "video/webm") {
    return readWebmDurationSeconds(file);
  }

  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    return readIsoDurationSeconds(file);
  }

  try {
    return await readIsoDurationSeconds(file);
  } catch {
    return readWebmDurationSeconds(file);
  }
}
