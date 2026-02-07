//! Unit tests for Tailscale integration (status parsing and auth URL handling).

use crate::tailscale::{parse_status_json, TailscaleStatusSummary};

#[test]
fn parse_status_json_logged_in_extracts_ips_and_dns() {
    // Minimal-ish sample based on tailscaled LocalAPI schema.
    let json = r#"
    {
      "BackendState": "Running",
      "Self": {
        "HostName": "home-pc",
        "DNSName": "home-pc.tailnet-123.ts.net",
        "TailscaleIPs": ["100.64.12.34", "fd7a:115c:a1e0:ab12::1234"]
      }
    }
    "#;

    let status = parse_status_json(json).expect("should parse");
    assert_eq!(
        status,
        TailscaleStatusSummary {
            installed: true,
            backend_state: Some("Running".to_string()),
            auth_url: None,
            self_hostname: Some("home-pc".to_string()),
            self_dns_name: Some("home-pc.tailnet-123.ts.net".to_string()),
            tailscale_ips: vec!["100.64.12.34".to_string(), "fd7a:115c:a1e0:ab12::1234".to_string()],
        }
    );
}

#[test]
fn parse_status_json_needs_login_extracts_auth_url() {
    let json = r#"
    {
      "BackendState": "NeedsLogin",
      "AuthURL": "https://login.tailscale.com/a/abcdef123456",
      "Self": {
        "HostName": "home-pc",
        "DNSName": "home-pc.tailnet-123.ts.net",
        "TailscaleIPs": []
      }
    }
    "#;

    let status = parse_status_json(json).expect("should parse");
    assert_eq!(status.backend_state.as_deref(), Some("NeedsLogin"));
    assert_eq!(
        status.auth_url.as_deref(),
        Some("https://login.tailscale.com/a/abcdef123456")
    );
}

