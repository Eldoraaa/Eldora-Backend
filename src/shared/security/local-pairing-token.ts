import { createHash, timingSafeEqual } from "crypto";

const LOCAL_PAIRING_TOKEN_HASH_PREFIX = "sha256:";

export function hashLocalPairingToken(token: string): string {
  return `${LOCAL_PAIRING_TOKEN_HASH_PREFIX}${createHash("sha256")
    .update(token)
    .digest("hex")}`;
}

export function localPairingTokenMatches(
  storedToken: string,
  providedToken: string
): boolean {
  const expected = storedToken.startsWith(LOCAL_PAIRING_TOKEN_HASH_PREFIX)
    ? storedToken
    : hashLocalPairingToken(storedToken);
  const actual = hashLocalPairingToken(providedToken);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);

  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
