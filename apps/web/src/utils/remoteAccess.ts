export interface RemoteAccessHostInput {
  dnsName: string | null;
  ips: string[];
}

export function pickRemoteAccessHost(input: RemoteAccessHostInput): string | null {
  if (input.dnsName && input.dnsName.trim()) {
    // Some environments may include a trailing dot (FQDN form). Browsers can mis-handle this.
    return input.dnsName.trim().replace(/\.$/, "");
  }
  if (input.ips.length > 0) return input.ips[0]!.trim();
  return null;
}

export function buildRemoteAccessUrl(input: {
  host: string;
  port: number;
  scheme?: "http" | "https";
  omitPort?: boolean;
}): string {
  const scheme = input.scheme ?? "http";
  const host = input.host;
  const includePort = !(input.omitPort ?? false);
  return includePort ? `${scheme}://${host}:${input.port}` : `${scheme}://${host}`;
}
