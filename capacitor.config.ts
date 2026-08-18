/// <reference types="@capacitor/background-runner" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.loombus.mobile",
  appName: "Loombus",
  webDir: "public",
  server: {
    url: "https://loombus.com",
    cleartext: false,
  },
  plugins: {
    BackgroundRunner: {
      label: "com.loombus.mobile.background.refresh",
      src: "runners/loombus-background.js",
      event: "refreshLoombus",
      repeat: false,
      interval: 60,
      autoStart: true,
    },
  },
};

export default config;
