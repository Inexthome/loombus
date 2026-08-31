import fs from "node:fs";

const packagePath = "ios/App/CapApp-SPM/Package.swift";
const googlePackage =
  '        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", exact: "9.2.0"),';
const googleProduct =
  '                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),';

if (!fs.existsSync(packagePath)) {
  throw new Error(`Missing generated Capacitor Swift package: ${packagePath}`);
}

let source = fs.readFileSync(packagePath, "utf8");

if (!source.includes("GoogleSignIn-iOS")) {
  const dependencyAnchor =
    '        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.4.1"),';

  if (!source.includes(dependencyAnchor)) {
    throw new Error("Unable to locate Capacitor Swift package dependency anchor.");
  }

  source = source.replace(
    dependencyAnchor,
    `${dependencyAnchor}\n${googlePackage}`,
  );
}

if (!source.includes('.product(name: "GoogleSignIn", package: "GoogleSignIn-iOS")')) {
  const productAnchor =
    '                .product(name: "Capacitor", package: "capacitor-swift-pm"),';

  if (!source.includes(productAnchor)) {
    throw new Error("Unable to locate Capacitor Swift target dependency anchor.");
  }

  source = source.replace(
    productAnchor,
    `${productAnchor}\n${googleProduct}`,
  );
}

fs.writeFileSync(packagePath, source);

console.log("Restored GoogleSignIn-iOS dependency after Capacitor iOS sync.");
