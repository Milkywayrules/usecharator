import { lookup } from "node:dns/promises";

function parseIpv4Octets(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const octets = parts.map((part) => Number(part));
  if (
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return null;
  }
  return octets;
}

function isPrivateIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === undefined || b === undefined) {
    return false;
  }
  if (a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return false;
}

function isPrivateIpAddress(address: string): boolean {
  const ipv4 = parseIpv4Octets(address);
  if (ipv4) {
    return isPrivateIpv4(ipv4);
  }

  const normalized = address.toLowerCase();
  if (normalized === "::1") {
    return true;
  }
  if (normalized.startsWith("fe80:")) {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    const mappedIpv4 = parseIpv4Octets(mapped);
    if (mappedIpv4) {
      return isPrivateIpv4(mappedIpv4);
    }
  }

  return false;
}

export async function validatePublicHttpsUrl(
  urlString: string
): Promise<string | null> {
  try {
    await assertPublicHttpsUrl(urlString);
    return null;
  } catch {
    return "customBaseUrl must be a public https endpoint";
  }
}

export async function assertPublicHttpsUrl(urlString: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (cause) {
    throw new Error("url must be a valid https address", { cause });
  }

  if (url.protocol !== "https:") {
    throw new Error("url must use https");
  }

  if (isPrivateIpAddress(url.hostname)) {
    throw new Error("url host is not public");
  }

  const resolved = await lookup(url.hostname, { all: true });
  for (const entry of resolved) {
    if (isPrivateIpAddress(entry.address)) {
      throw new Error("url host resolves to a private address");
    }
  }
}
