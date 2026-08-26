import type { CapacitorConfig } from "@capacitor/cli";

const remoteUrl = process.env.PROCTORX_ANDROID_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.proctorx.assessment",
  appName: "ProctorX",
  webDir: "dist/public",
  bundledWebRuntime: false,
  ...(remoteUrl ? { server: { url: remoteUrl, cleartext: false, androidScheme: "https" } } : {}),
};

export default config;
