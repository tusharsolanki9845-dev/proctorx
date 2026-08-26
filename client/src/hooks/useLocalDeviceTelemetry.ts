import { useEffect, useState } from "react";
import { readLocalDeviceTelemetry, subscribeLocalDeviceTelemetry } from "@/lib/deviceTelemetry";

export function useLocalDeviceTelemetry() {
  const [telemetry, setTelemetry] = useState(() => typeof window === "undefined" ? { microphone: "inactive" as const, updatedAt: 0 } : readLocalDeviceTelemetry());
  useEffect(() => subscribeLocalDeviceTelemetry(setTelemetry), []);
  return telemetry;
}
