import { SceneTriggerType } from "../../../generated/prisma/client";

export const SCENE_TEMPLATES = [
  {
    id: "scheduled_check_in",
    title: "Scheduled check-in",
    description: "At a chosen time, Core asks whether the elder is okay.",
    category: "care",
    devices: [
      { name: "Eldora Core", role: "speaks the check-in" },
    ],
    ifLabel: "The schedule reaches the selected check-in time.",
    thenLabel: "Eldora Core asks the elder a calm wellness question.",
    setupNote: "Good for daily reassurance without opening a full call.",
    triggerType: SceneTriggerType.schedule,
    triggerConfig: {
      schemaVersion: 1,
      condition: {
        kind: "schedule",
        deviceType: "eldora_core",
        schedule: { frequency: "daily", time: "09:00" },
      },
    },
    actions: {
      schemaVersion: 1,
      steps: [
        {
          type: "core_voice_check_in",
          target: "eldora_core",
          message: "Good morning. Are you feeling okay today? Please answer Eldora so your family knows you are safe.",
        },
      ],
    },
  },
  {
    id: "fall_response",
    title: "Fall response",
    description: "AegisWear detects a fall and sends a critical phone alert.",
    category: "safety",
    devices: [
      { name: "AegisWear", role: "detects the fall" },
    ],
    ifLabel: "AegisWear detects a fall event.",
    thenLabel: "Family receives a critical FCM alert and the event appears in Message Center.",
    setupNote: "Use after AegisWear is paired for fall detection.",
    triggerType: SceneTriggerType.device_status_changes,
    triggerConfig: {
      schemaVersion: 1,
      condition: { kind: "fall_detected", deviceType: "aegiswear" },
    },
    actions: {
      schemaVersion: 1,
      steps: [
        {
          type: "send_push_alert",
          target: "caregiver",
          notificationType: "alarm",
          title: "Fall detected",
          body: "AegisWear detected a fall. Check immediately.",
          severity: "critical",
          sound: "critical_alert",
        },
      ],
    },
  },
  {
    id: "core_offline",
    title: "Core offline",
    description: "Family is notified when Eldora Core has been offline too long.",
    category: "device",
    devices: [
      { name: "Eldora Core", role: "monitored for connection" },
    ],
    ifLabel: "Eldora Core is offline for 10 minutes.",
    thenLabel: "Send a device offline notification to family.",
    setupNote: "Useful when Core is moved, powered off, or Wi-Fi changes.",
    triggerType: SceneTriggerType.device_status_changes,
    triggerConfig: {
      schemaVersion: 1,
      condition: {
        kind: "device_offline",
        deviceType: "eldora_core",
        durationMinutes: 10,
      },
    },
    actions: {
      schemaVersion: 1,
      steps: [
        {
          type: "send_push_alert",
          target: "caregiver",
          notificationType: "device",
          title: "Eldora Core offline",
          body: "Eldora Core has been offline for 10 minutes.",
          severity: "warning",
        },
      ],
    },
  },
  {
    id: "medication_reminder",
    title: "Medication reminder",
    description: "Schedule Core to speak a daily medicine reminder.",
    category: "care",
    devices: [
      { name: "Eldora Core", role: "speaks the reminder" },
    ],
    ifLabel: "It is 07:00 every morning.",
    thenLabel: "Eldora Core speaks the reminder and asks for confirmation.",
    setupNote: "For daily care routines managed by family.",
    triggerType: SceneTriggerType.schedule,
    triggerConfig: {
      schemaVersion: 1,
      condition: {
        kind: "schedule",
        deviceType: "eldora_core",
        schedule: { frequency: "daily", time: "07:00" },
      },
    },
    actions: {
      schemaVersion: 1,
      steps: [
        {
          type: "speak_on_core",
          target: "eldora_core",
          message: "It is time for your morning medicine. Please tell Eldora after you take it.",
        },
        {
          type: "send_push_alert_if_no_response",
          target: "caregiver",
          delayMinutes: 15,
          notificationType: "home",
          title: "Medication reminder not confirmed",
          body: "The elder has not confirmed the medication reminder yet.",
          severity: "normal",
        },
      ],
    },
  },
] as const;
