import { SceneTriggerType } from "../../../generated/prisma/client";

export const SCENE_TEMPLATES = [
  {
    id: "scheduled_check_in",
    title: "Scheduled check-in",
    description: "At a chosen time, DoraBot asks whether the elder is okay.",
    category: "care",
    devices: [
      { name: "DoraBot", role: "speaks the check-in" },
    ],
    ifLabel: "The schedule reaches the selected check-in time.",
    thenLabel: "DoraBot asks the elder a calm wellness question.",
    setupNote: "Good for daily reassurance without opening a full call.",
    triggerType: SceneTriggerType.schedule,
    triggerConfig: {
      schemaVersion: 1,
      condition: {
        kind: "schedule",
        deviceType: "dorabot",
        schedule: { frequency: "daily", time: "09:00" },
      },
    },
    actions: {
      schemaVersion: 1,
      steps: [
        {
          type: "dorabot_voice_check_in",
          target: "dorabot",
          message: "Good morning. Are you feeling okay today? Please answer Eldora so your family knows you are safe.",
        },
      ],
    },
  },
  {
    id: "fall_response",
    title: "Fall response",
    description: "DoraShield detects a fall and sends a critical phone alert.",
    category: "safety",
    devices: [
      { name: "DoraShield", role: "detects the fall" },
    ],
    ifLabel: "DoraShield detects a fall event.",
    thenLabel: "Family receives a critical FCM alert and the event appears in Message Center.",
    setupNote: "Use after DoraShield is paired for fall detection.",
    triggerType: SceneTriggerType.device_status_changes,
    triggerConfig: {
      schemaVersion: 1,
      condition: { kind: "fall_detected", deviceType: "dorashield" },
    },
    actions: {
      schemaVersion: 1,
      steps: [
        {
          type: "send_push_alert",
          target: "caregiver",
          notificationType: "alarm",
          title: "Fall detected",
          body: "DoraShield detected a fall. Check immediately.",
          severity: "critical",
          sound: "critical_alert",
        },
      ],
    },
  },
  {
    id: "medication_reminder",
    title: "Medication reminder",
    description: "Schedule DoraBot to speak a daily medicine reminder.",
    category: "care",
    devices: [
      { name: "DoraBot", role: "speaks the reminder" },
    ],
    ifLabel: "It is 07:00 every morning.",
    thenLabel: "DoraBot speaks the reminder and asks for confirmation.",
    setupNote: "For daily care routines managed by family.",
    triggerType: SceneTriggerType.schedule,
    triggerConfig: {
      schemaVersion: 1,
      condition: {
        kind: "schedule",
        deviceType: "dorabot",
        schedule: { frequency: "daily", time: "07:00" },
      },
    },
    actions: {
      schemaVersion: 1,
      steps: [
        {
          type: "speak_on_dorabot",
          target: "dorabot",
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
