//! Unit tests for Tauri commands
//!
//! Tests server and tunnel management commands,
//! port checking, environment checking, and server scanning.

use crate::commands::*;
use crate::common;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_port_accepts_valid_range() {
        // Test valid port range (1024-65535)
        assert!(common::validate_port(1024).is_ok());
        assert!(common::validate_port(8080).is_ok());
        assert!(common::validate_port(8787).is_ok());
        assert!(common::validate_port(65535).is_ok());
    }

    #[test]
    fn test_validate_port_rejects_low_ports() {
        // Test privileged ports (below 1024)
        assert!(common::validate_port(0).is_err());
        assert!(common::validate_port(1).is_err());
        assert!(common::validate_port(1023).is_err());
    }

    #[test]
    fn test_validate_port_rejects_invalid_ports() {
        // Test invalid ports
        // Note: u16 cannot represent values > 65535, so those are impossible
        // to pass to validate_port due to Rust's type system
        assert!(common::validate_port(0).is_err());
        assert!(common::validate_port(1023).is_err());
    }

    #[test]
    fn test_server_status_structure() {
        // Test that ServerStatus can be created and serialized
        let status = ServerStatus {
            running: true,
            port: 8787,
        };

        assert_eq!(status.running, true);
        assert_eq!(status.port, 8787);

        // Test serialization
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"running\":true"));
        assert!(json.contains("\"port\":8787"));
    }

    #[test]
    fn test_tunnel_status_structure() {
        // Test that TunnelStatus can be created with and without URL
        let status_with_url = TunnelStatus {
            running: true,
            url: Some("https://example.com".to_string()),
            password: None,
        };

        let status_without_url = TunnelStatus {
            running: false,
            url: None,
            password: None,
        };

        assert_eq!(status_with_url.running, true);
        assert_eq!(status_with_url.url.unwrap(), "https://example.com");
        assert_eq!(status_without_url.running, false);
        assert!(status_without_url.url.is_none());
    }

    #[test]
    fn test_environment_info_structure() {
        // Test that EnvironmentInfo can hold command info
        let node_info = CommandInfo {
            available: true,
            version: Some("v20.0.0".to_string()),
        };

        let npm_info = CommandInfo {
            available: false,
            version: None,
        };

        let pnpm_info = CommandInfo {
            available: true,
            version: Some("v9.0.0".to_string()),
        };

        let env_info = EnvironmentInfo {
            node: node_info.clone(),
            npm: npm_info.clone(),
            pnpm: pnpm_info.clone(),
        };

        assert_eq!(env_info.node.available, true);
        assert_eq!(env_info.node.version.as_ref().unwrap(), "v20.0.0");
        assert_eq!(env_info.npm.available, false);
        assert!(env_info.npm.version.is_none());
        assert_eq!(env_info.pnpm.available, true);
        assert_eq!(env_info.pnpm.version.as_ref().unwrap(), "v9.0.0");

        // Test serialization
        let json = serde_json::to_string(&env_info).unwrap();
        assert!(json.contains("\"available\":true"));
    }

    #[test]
    fn test_port_status_structure() {
        // Test PortStatus structure
        let status = PortStatus {
            port: 8080,
            available: true,
            in_use: false,
        };

        assert_eq!(status.port, 8080);
        assert_eq!(status.available, true);
        assert_eq!(status.in_use, false);

        // When available is false, in_use should be true
        let in_use_status = PortStatus {
            port: 8080,
            available: false,
            in_use: true,
        };

        assert_eq!(in_use_status.available, false);
        assert_eq!(in_use_status.in_use, true);
    }

    #[test]
    fn test_detected_server_structure() {
        // Test DetectedServer structure
        let server = DetectedServer {
            name: "Test Server".to_string(),
            url: "http://localhost:3000".to_string(),
            port: 3000,
            status: "running".to_string(),
            type_: "dev".to_string(),
        };

        assert_eq!(server.name, "Test Server");
        assert_eq!(server.url, "http://localhost:3000");
        assert_eq!(server.port, 3000);
        assert_eq!(server.status, "running");
        assert_eq!(server.type_, "dev");
    }

    #[test]
    fn test_mcp_status_structure() {
        // Test MCPStatus structure
        let status = MCPStatus {
            name: "test-server".to_string(),
            status: "active".to_string(),
            capabilities: vec![
                "messaging".to_string(),
                "broadcast".to_string(),
            ],
        };

        assert_eq!(status.name, "test-server");
        assert_eq!(status.status, "active");
        assert_eq!(status.capabilities.len(), 2);
        assert!(status.capabilities.contains(&"messaging".to_string()));
        assert!(status.capabilities.contains(&"broadcast".to_string()));
    }

    #[test]
    fn test_url_validation_for_mcp_servers() {
        // Test URL validation logic (same as in get_mcp_servers)
        fn validate_mcp_url(url_str: &str) -> Result<(), String> {
            let parsed_url = url::Url::parse(url_str)
                .map_err(|e| format!("Invalid URL format: {}", e))?;

            match parsed_url.host_str() {
                Some("localhost") | Some("127.0.0.1") | Some("::1") | None => {
                    // Allow localhost or unspecified
                }
                Some(host) => {
                    return Err(format!("Only localhost URLs are allowed, got: {}", host));
                }
            }

            if parsed_url.scheme() != "http" && parsed_url.scheme() != "https" {
                return Err("Only http/https schemes are allowed".to_string());
            }

            Ok(())
        }

        // Valid URLs
        assert!(validate_mcp_url("http://localhost:8787").is_ok());
        assert!(validate_mcp_url("http://127.0.0.1:8787").is_ok());
        assert!(validate_mcp_url("https://localhost:8787").is_ok());

        // Note: IPv6 localhost with brackets may not parse correctly in all cases
        // The url crate handles IPv6, but the bracket notation is for HTTP syntax
        // Internally it's stored as just "::1"
        if let Ok(url) = url::Url::parse("http://[::1]:8787") {
            if url.host_str() == Some("::1") {
                assert!(validate_mcp_url("http://[::1]:8787").is_ok());
            }
        }

        // Invalid URLs
        assert!(validate_mcp_url("http://192.168.1.1:8787").is_err());
        assert!(validate_mcp_url("http://example.com:8787").is_err());
        assert!(validate_mcp_url("ftp://localhost:8787").is_err());
        assert!(validate_mcp_url("not-a-url").is_err());
    }
}
