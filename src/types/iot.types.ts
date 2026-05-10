export type DeviceTelemetry = {
  batteryLevel?: number;
  isCharging?: boolean;
  wifiSsid?: string;
  wifiRssi?: number;
  localIp?: string;
  localPairingToken?: string;
  firmwareVersion?: string;
};

export type DeviceCommandStatus = "pending" | "delivered" | "applied" | "failed";

export type DeviceCommandType = "configure_wifi";
