import fs from "node:fs";

const projectPath = "ios/App/App.xcodeproj/project.pbxproj";
const expectedBuild = "2";

if (!fs.existsSync(projectPath)) {
  throw new Error(`Missing Xcode project file: ${projectPath}`);
}

let source = fs.readFileSync(projectPath, "utf8");
const matches = [...source.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)];

if (matches.length !== 4) {
  throw new Error(
    `Expected four iOS CURRENT_PROJECT_VERSION settings (app Debug/Release and Live Activities Debug/Release), found ${matches.length}.`,
  );
}

source = source.replace(
  /CURRENT_PROJECT_VERSION = \d+;/g,
  `CURRENT_PROJECT_VERSION = ${expectedBuild};`,
);

const normalized = [...source.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map(
  (match) => match[1],
);

if (normalized.some((value) => value !== expectedBuild)) {
  throw new Error("Unable to align all iOS Xcode build settings to build 2.");
}

fs.writeFileSync(projectPath, source);
console.log(
  "Aligned Xcode app and Live Activities CURRENT_PROJECT_VERSION to iOS build 2.",
);
