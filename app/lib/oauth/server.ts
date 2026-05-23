import { createHash, randomBytes } from "node:crypto";
import prisma from "~/lib/prisma.server";

const ACCESS_TOKEN_EXPIRY = 60 * 60; // 1 hour
const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_EXPIRY = 60 * 10; // 10 minutes
export const DEVICE_CODE_EXPIRY = 60 * 15; // 15 minutes

/**
 * Generate a random token, eg auth code, access token, refresh token, device code, etc.
 *
 * @param bytes - The number of bytes to generate
 * @returns The generated token
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Generate a code challenge from a verifier. Used for PKCE (Proof Key for Code Exchange).
 *
 * @param verifier - The verifier to generate a code challenge from
 * @returns The generated code challenge
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Create an access token and refresh token for a user and client.  The access
 * token is used to access the API and the refresh token is used to refresh the
 * access token. The access token is valid for 1 hour and the refresh token is
 * valid for 30 days.
 *
 * @param userId - The user ID
 * @param clientId - The client ID
 * @param scopes - The scopes to grant
 * @returns The access token and refresh token, and the expiration time in seconds
 */
export async function createAccessToken({
  userId,
  clientId,
  scopes,
}: {
  userId: string;
  clientId: string;
  scopes: string[];
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const now = new Date();

  await prisma.oAuthAccessToken.create({
    data: {
      token: accessToken,
      userId,
      clientId,
      scopes,
      expiresAt: new Date(now.getTime() + ACCESS_TOKEN_EXPIRY * 1000),
    },
  });

  await prisma.oAuthRefreshToken.create({
    data: {
      token: refreshToken,
      userId,
      clientId,
      scopes,
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_EXPIRY * 1000),
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY,
  };
}

/**
 * Verify an access token and return the user ID and scopes.
 *
 * @param token - The access token to verify
 * @returns The user ID and scopes
 * @throws {Error} If the access token is invalid or expired
 */
export async function verifyAccessToken(token: string): Promise<{
  userId: string;
  scopes: string[];
} | null> {
  const accessToken = await prisma.oAuthAccessToken.findUnique({
    where: { token },
    select: { userId: true, scopes: true, expiresAt: true },
  });

  if (!accessToken || accessToken.expiresAt < new Date()) {
    return null;
  }

  return { userId: accessToken.userId, scopes: accessToken.scopes };
}

/**
 * Revoke an access token and refresh token for a user and client.
 *
 * @param token - The access token to revoke
 * @returns The user ID and scopes
 * @throws {Error} If the access token is invalid or expired
 */
export async function revokeToken(token: string): Promise<void> {
  await prisma.oAuthAccessToken.deleteMany({ where: { token } });
  await prisma.oAuthRefreshToken.deleteMany({ where: { token } });
}

/**
 * Create a device code for a user and client. The device code is used to
 * authorize a device. The device code is valid for 15 minutes.
 *
 * @param userId - The user ID
 * @param clientId - The client ID
 * @param scopes - The scopes to grant
 * @returns The device code and the expiration time in seconds
 */
export async function createDeviceCode({
  userId,
  clientId,
  scopes,
}: {
  userId: string;
  clientId: string;
  scopes: string[];
}): Promise<{ deviceCode: string; expiresIn: number }> {
  const deviceCode = generateToken();

  await prisma.oAuthDeviceCode.create({
    data: {
      code: deviceCode,
      userId,
      clientId,
      scopes,
      expiresIn: DEVICE_CODE_EXPIRY,
    },
  });

  return { deviceCode, expiresIn: DEVICE_CODE_EXPIRY };
}

/**
 * Verify a device code and return the user ID, client ID, and scopes.
 *
 * @param code - The device code to verify
 * @returns The user ID, client ID, and scopes
 * @throws {Error} If the device code is invalid or expired
 */
export async function verifyDeviceCode(code: string): Promise<{
  userId: string | null;
  clientId: string;
  scopes: string[];
} | null> {
  const deviceCode = await prisma.oAuthDeviceCode.findUnique({
    where: { code },
    select: {
      userId: true,
      clientId: true,
      scopes: true,
      createdAt: true,
      expiresIn: true,
    },
  });

  if (!deviceCode) return null;

  const expiresAt = new Date(
    deviceCode.createdAt.getTime() + deviceCode.expiresIn * 1000,
  );
  if (expiresAt < new Date()) {
    await prisma.oAuthDeviceCode.delete({ where: { code } });
    return null;
  }

  return {
    userId: deviceCode.userId,
    clientId: deviceCode.clientId,
    scopes: deviceCode.scopes,
  };
}

/**
 * Approve a device code and set the verifiedAt timestamp.
 *
 * @param code - The device code to approve
 * @returns The user ID, client ID, and scopes
 * @throws {Error} If the device code is invalid or expired
 */
export async function approveDeviceCode(code: string): Promise<void> {
  await prisma.oAuthDeviceCode.update({
    where: { code },
    data: { verifiedAt: new Date() },
  });
}

/**
 * Check if a device code is approved.
 *
 * @param code - The device code to check
 * @returns True if the device code is approved, false otherwise
 */
export async function isDeviceCodeApproved(code: string): Promise<boolean> {
  const deviceCode = await prisma.oAuthDeviceCode.findUnique({
    where: { code },
    select: { verifiedAt: true },
  });
  // oxlint-disable-next-line eqeqeq
  return deviceCode?.verifiedAt != null;
}
