import swaggerJsdoc from "swagger-jsdoc";
import type { Options } from "swagger-jsdoc";
import { config } from "@/config/env";

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Eldora Backend API",
      version: "1.0.0",
      description: "API documentation for Eldora backend services.",
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: `${config.nodeEnv} server`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        deviceKey: {
          type: "apiKey",
          in: "header",
          name: "x-device-key",
        },
        deviceProvisioningSecret: {
          type: "apiKey",
          in: "header",
          name: "x-device-provisioning-secret",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Success" },
            data: { nullable: true },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error message" },
          },
        },
        Device: {
          type: "object",
          properties: {
            id: { type: "string" },
            deviceId: { type: "string" },
            name: { type: "string" },
            elderName: { type: "string" },
            isOnline: { type: "boolean" },
            lastSeen: { type: "string", format: "date-time", nullable: true },
            batteryLevel: { type: "integer", nullable: true },
            isCharging: { type: "boolean" },
            wifiSsid: { type: "string", nullable: true },
            wifiRssi: { type: "integer", nullable: true },
            localIp: { type: "string", nullable: true },
            firmwareVersion: { type: "string", nullable: true },
            caregiverCount: { type: "integer" },
          },
        },
        PairingRequest: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: {
              type: "string",
              enum: ["pending", "approved", "rejected", "expired"],
            },
            expiresAt: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            requester: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                email: { type: "string", format: "email" },
              },
            },
            device: { $ref: "#/components/schemas/Device" },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Unauthorized",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        NotFound: {
          description: "Not found",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
        ValidationError: {
          description: "Validation failed",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApiError" },
            },
          },
        },
      },
    },
  },
  apis: ["src/index.ts", "src/modules/**/*.routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
