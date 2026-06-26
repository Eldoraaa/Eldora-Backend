import { SceneTriggerType } from "../../../generated/prisma/client";

export const SCENE_TEMPLATES = [
  {
    id: "scheduled_reminder",
    title: "Daily / weekly reminder",
    description: "Schedule DoraBot to speak any reminder or greeting at a chosen time.",
    category: "care",
    devices: [
      { name: "DoraBot", role: "speaks the reminder" },
    ],
    ifLabel: "Set when this reminder should play.",
    thenLabel: "Write what DoraBot should say.",
    setupNote: "Use for medication, meals, hydration, check-ins, greetings, or any routine.",
    triggerType: SceneTriggerType.schedule,
    triggerConfig: {
      schemaVersion: 1,
      condition: {
        kind: "schedule",
        deviceType: "dorabot",
        schedule: { frequency: "daily", time: "08:00" },
      },
    },
    actions: {
      schemaVersion: 1,
      steps: [
        {
          type: "speak_on_dorabot",
          target: "dorabot",
          message: "This is your reminder. Please take care of yourself.",
        },
      ],
    },
  },
];
