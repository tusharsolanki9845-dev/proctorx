const remoteUrl = process.env.PROCTORX_ANDROID_SERVER_URL?.trim();

if (!remoteUrl) {
  throw new Error("Set PROCTORX_ANDROID_SERVER_URL to the HTTPS URL of the published ProctorX site before syncing Android.");
}

const parsed = new URL(remoteUrl);
if (parsed.protocol !== "https:") {
  throw new Error("PROCTORX_ANDROID_SERVER_URL must use HTTPS so camera and microphone permission flows remain available.");
}

console.log(`Android wrapper will load ${parsed.origin}.`);
