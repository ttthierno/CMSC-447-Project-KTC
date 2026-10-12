
import "dotenv/config";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma.js";

const secret = process.env.BETTER_AUTH_SECRET;

if (!secret) {
  throw new Error(
    "BETTER_AUTH_SECRET is missing from the server .env file."
  );
}

export const auth = betterAuth({
  appName: "KonTraCk",

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",

  secret,

  trustedOrigins: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
  ],

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,

    sendResetPassword: async ({ user, url }) => {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "Configure a real email provider before production use."
        );
      }

      console.log("\n=== KONTRACK PASSWORD RESET ===");
      console.log("Recipient:", user.email);
      console.log("Reset link:", url);
      console.log("================================\n");
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,

    sendVerificationEmail: async ({ user, url }) => {
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "Configure a real email provider before production use."
        );
      }

      console.log("\n=== KONTRACK EMAIL VERIFICATION ===");
      console.log("Recipient:", user.email);
      console.log("Verification link:", url);
      console.log("===================================\n");
    },
  },

 advanced: {
  database: {
    generateId: "serial",
  },
},
});


