import { resolve } from "node:path";
import yauzl from "yauzl";

const defaultArtifact =
  "node_modules/@capacitor/background-runner/android/src/main/libs/android-js-engine-release.aar";
const artifactArgument = process.argv.find((value) =>
  value.startsWith("--artifact=")
);
const artifact = resolve(
  process.cwd(),
  artifactArgument?.slice("--artifact=".length) || defaultArtifact
);

function readEntry(zip, entry) {
  return new Promise((resolveEntry, rejectEntry) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) {
        rejectEntry(error);
        return;
      }

      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("error", rejectEntry);
      stream.on("end", () => resolveEntry(Buffer.concat(chunks)));
    });
  });
}

function loadAlignments(buffer, filename) {
  if (
    buffer.length < 64 ||
    buffer[0] !== 0x7f ||
    buffer.toString("ascii", 1, 4) !== "ELF"
  ) {
    throw new Error(`${filename} is not a readable ELF library.`);
  }

  const elfClass = buffer[4];
  const byteOrder = buffer[5];
  if (byteOrder !== 1) {
    throw new Error(`${filename} uses an unsupported non-little-endian ELF format.`);
  }

  const alignments = [];
  if (elfClass === 2) {
    const programHeaderOffset = Number(buffer.readBigUInt64LE(32));
    const programHeaderEntrySize = buffer.readUInt16LE(54);
    const programHeaderCount = buffer.readUInt16LE(56);
    for (let index = 0; index < programHeaderCount; index += 1) {
      const offset = programHeaderOffset + index * programHeaderEntrySize;
      if (buffer.readUInt32LE(offset) === 1) {
        alignments.push(Number(buffer.readBigUInt64LE(offset + 48)));
      }
    }
  } else if (elfClass === 1) {
    const programHeaderOffset = buffer.readUInt32LE(28);
    const programHeaderEntrySize = buffer.readUInt16LE(42);
    const programHeaderCount = buffer.readUInt16LE(44);
    for (let index = 0; index < programHeaderCount; index += 1) {
      const offset = programHeaderOffset + index * programHeaderEntrySize;
      if (buffer.readUInt32LE(offset) === 1) {
        alignments.push(buffer.readUInt32LE(offset + 28));
      }
    }
  } else {
    throw new Error(`${filename} uses an unsupported ELF class.`);
  }

  if (alignments.length === 0) {
    throw new Error(`${filename} contains no loadable ELF segments.`);
  }
  return { elfClass, alignments };
}

const libraries = await new Promise((resolveLibraries, rejectLibraries) => {
  yauzl.open(artifact, { lazyEntries: true }, (openError, zip) => {
    if (openError || !zip) {
      rejectLibraries(
        openError ?? new Error(`Unable to open Android artifact ${artifact}.`)
      );
      return;
    }

    const found = [];
    zip.on("error", rejectLibraries);
    zip.on("entry", async (entry) => {
      try {
        if (/\.so$/i.test(entry.fileName)) {
          found.push({
            filename: entry.fileName,
            buffer: await readEntry(zip, entry),
          });
        }
        zip.readEntry();
      } catch (error) {
        rejectLibraries(error);
      }
    });
    zip.on("end", () => resolveLibraries(found));
    zip.readEntry();
  });
});

if (libraries.length === 0) {
  throw new Error(`No native Android libraries were found in ${artifact}.`);
}

let checked64BitLibraries = 0;
for (const library of libraries) {
  const { elfClass, alignments } = loadAlignments(
    library.buffer,
    library.filename
  );
  if (elfClass !== 2) continue;

  checked64BitLibraries += 1;
  const invalidAlignment = alignments.find((alignment) => alignment < 0x4000);
  if (invalidAlignment !== undefined) {
    throw new Error(
      `${library.filename} has a load segment aligned to 0x${invalidAlignment.toString(
        16
      )}; 64-bit libraries must use at least 0x4000 alignment for 16 KB devices.`
    );
  }
}

if (checked64BitLibraries === 0) {
  throw new Error(`No 64-bit Android native libraries were found in ${artifact}.`);
}

console.log(
  `Android 16 KB ELF verification passed for ${checked64BitLibraries} 64-bit native libraries in ${artifact}.`
);
console.log(
  "For the final AAB, also confirm PAGE_ALIGNMENT_16K with the current Android bundle analysis tools before Play upload."
);
