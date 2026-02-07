# Remote Access Via Tailscale (Desktop)

## Goal

Replace the existing Remote Access (localtunnel) UX with a Tailscale-first flow that:

- Keeps access private to the user's tailnet (no public tunnel URLs, no IP "password" prompts).
- Provides an in-app, guided setup experience in the Desktop app (Tauri) without attempting to bypass Tailscale's authentication model.
- Shows a stable, copyable access URL (Tailscale IP or MagicDNS) and a QR code for phone access.

Non-goals:

- Bundling Tailscale or performing unattended login.
- Managing ACLs, tailnet policies, or Funnel/public exposure.

## Architecture

### Backend (Tauri / Rust)

- Add a `tailscale` module that shells out to the `tailscale` CLI (when installed) and reads `tailscale status --json`.
- Expose a new Tauri command `get_tailscale_status` returning a stable summary:
  - `installed`
  - `backend_state`
  - `auth_url` (when login is required)
  - `self_dns_name` and `tailscale_ips`

The parser is resilient to schema changes by extracting only the fields needed from `serde_json::Value`.

### Frontend (Web UI inside Desktop)

- Replace the Remote Access status bar control to show:
  - Connected state when Tailscale backend is running and a host is available.
  - Copyable URL `http://<dns-or-ip>:<port>`
  - Quick actions:
    - Install Tailscale (external link) if missing
    - Open Login (external link) if `NeedsLogin` and `auth_url` is available

- Replace the Remote Access panel content to show:
  - Current status + URL + QR
  - A short "how to access from phone" guide based on Tailscale
  - Optional BasicAuth configuration (server-side) and server restart button (existing behavior)

## Data Flow

1. UI polls `get_tailscale_status` on an interval.
2. UI chooses host:
   - Prefer `self_dns_name`, otherwise first `tailscale_ips[]`.
3. UI builds remote URL: `http://<host>:<settings.port>`.
4. QR code uses the same URL.

## Error Handling

- If not running in Tauri, Remote Access UI hides itself (status bar) and panel shows limited guidance.
- If Tailscale isn't installed: show install CTA and keep URL empty.
- If login is required and `auth_url` exists: show "Open Login" CTA.

## Testing

- Rust unit tests cover parsing of `tailscale status --json` into a stable summary.
- Web unit tests cover URL/host selection utilities.

