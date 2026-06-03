import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.loombus.mobile",
  appName: "Loombus",
  webDir: "public",
  server: {
    url: "https://loombus.com",
    cleartext: false,
  },
};

export default config;
