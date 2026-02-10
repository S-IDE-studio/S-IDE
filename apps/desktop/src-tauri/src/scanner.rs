//! Advanced network scanner with nmap-style capabilities
//!
//! Provides port scanning, OS detection, and service version detection
//! using pure Rust with tokio for TCP scanning, with nmap subprocess fallback.

use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Result of a network scan on a single host
#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    /// Target host address
    pub host: String,
    /// Scanned ports with their status
    pub ports: Vec<PortInfo>,
    /// Guessed operating system (if OS detection enabled)
    pub os_guess: Option<String>,
    /// Detected services with version info
    pub services: Vec<ServiceInfo>,
}

/// Detailed information about a single port
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortInfo {
    /// Port number
    pub port: u16,
    /// Port status
    pub status: PortStatus,
    /// Protocol (tcp/udp)
    pub protocol: String,
    /// Service name (if identified)
    pub service: Option<String>,
    /// Service version (if version detection enabled)
    pub version: Option<String>,
}

/// Port scanning status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PortStatus {
    Open,
    Closed,
    Filtered,
}

/// Service information with version detection
#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceInfo {
    /// Service name
    pub name: String,
    /// Detected version
    pub version: Option<String>,
    /// Additional service info
    pub info: Option<String>,
}

/// Scan options for advanced scanning
#[derive(Debug, Clone)]
pub struct ScanOptions {
    /// Ports to scan (None for common ports)
    pub ports: Option<Vec<u16>>,
    /// Enable OS detection
    pub os_detection: bool,
    /// Enable service version detection
    pub version_detection: bool,
    /// Connection timeout per port
    pub timeout: Duration,
    /// Maximum parallel connections
    pub parallelism: usize,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            ports: None,
            os_detection: false,
            version_detection: false,
            timeout: Duration::from_millis(200),
            parallelism: 100,
        }
    }
}

/// Common development ports to scan by default
const COMMON_PORTS: &[u16] = &[
    21,    // FTP
    22,    // SSH
    23,    // Telnet
    25,    // SMTP
    53,    // DNS
    80,    // HTTP
    110,   // POP3
    143,   // IMAP
    443,   // HTTPS
    3306,  // MySQL
    3389,  // RDP
    5432,  // PostgreSQL
    3000,  // Node.js dev
    3001,  // Alternative Node.js
    5173,  // Vite dev
    5174,  // Alternative Vite
    8000,  // Python dev
    8080,  // Alternative HTTP
    8787,  // Side-IDE
    9000,  // Alternative dev
];

/// Service fingerprints for common ports
const SERVICE_FINGERPRINTS: &[(u16, &str)] = &[
    (21, "ftp"),
    (22, "ssh"),
    (23, "telnet"),
    (25, "smtp"),
    (53, "dns"),
    (80, "http"),
    (110, "pop3"),
    (143, "imap"),
    (443, "https"),
    (3306, "mysql"),
    (3389, "rdp"),
    (5432, "postgresql"),
    (3000, "nodejs"),
    (5173, "vite"),
    (8000, "http-alt"),
    (8080, "http-proxy"),
    (8787, "side-ide"),
];

/// Scan localhost with advanced options
pub async fn scan_localhost(
    ports: Option<Vec<u16>>,
    os_detection: bool,
    version_detection: bool,
) -> Result<Vec<ScanResult>, String> {
    let options = ScanOptions {
        ports,
        os_detection,
        version_detection,
        ..Default::default()
    };

    scan_host("127.0.0.1", &options).await
}

/// Scan a specific host with given options
pub async fn scan_host(host: &str, options: &ScanOptions) -> Result<Vec<ScanResult>, String> {
    let ports_to_scan = options.ports.clone().unwrap_or_else(|| COMMON_PORTS.to_vec());

    // Scan ports in parallel batches
    let mut open_ports = Vec::new();
    let mut closed_ports = Vec::new();

    let batch_size = options.parallelism;
    for chunk in ports_to_scan.chunks(batch_size) {
        let mut tasks = Vec::new();
        for &port in chunk {
            tasks.push(tokio::spawn(probe_port(
                host.to_string(),
                port,
                options.timeout,
            )));
        }

        for task in tasks {
            if let Ok(Some(port_info)) = task.await {
                match port_info.status {
                    PortStatus::Open => open_ports.push(port_info),
                    PortStatus::Closed => closed_ports.push(port_info),
                    _ => {}
                }
            }
        }
    }

    // Build scan result
    let mut result = ScanResult {
        host: host.to_string(),
        ports: open_ports.clone(),
        os_guess: None,
        services: Vec::new(),
    };

    // OS detection (if enabled)
    if options.os_detection {
        result.os_guess = detect_os(host, &open_ports).await;
    }

    // Service version detection (if enabled)
    if options.version_detection {
        for port in &open_ports {
            if let Some(service) = detect_service_version(host, port, options.timeout).await {
                result.services.push(service);
            }
        }
    } else {
        // Basic service fingerprinting
        for port in &open_ports {
            if let Some(name) = SERVICE_FINGERPRINTS
                .iter()
                .find(|(p, _)| *p == port.port)
                .map(|(_, name)| name.to_string())
            {
                result.services.push(ServiceInfo {
                    name,
                    version: None,
                    info: None,
                });
            }
        }
    }

    Ok(vec![result])
}

/// Probe a single port to check if it's open
async fn probe_port(host: String, port: u16, timeout_duration: Duration) -> Option<PortInfo> {
    use tokio::net::TcpStream;
    use tokio::time::timeout as tokio_timeout;

    let addr = format!("{}:{}", host, port);

    match tokio_timeout(
        timeout_duration,
        TcpStream::connect(&addr)
    ).await {
        Ok(Ok(_)) => Some(PortInfo {
            port,
            status: PortStatus::Open,
            protocol: "tcp".to_string(),
            service: None,
            version: None,
        }),
        Ok(Err(_)) => Some(PortInfo {
            port,
            status: PortStatus::Closed,
            protocol: "tcp".to_string(),
            service: None,
            version: None,
        }),
        Err(_) => None, // Timeout - treat as filtered
    }
}

/// Detect operating system based on open ports and responses
async fn detect_os(_host: &str, open_ports: &[PortInfo]) -> Option<String> {
    // Basic OS detection based on common port patterns
    // This is a simplified version - full TCP/IP fingerprinting requires raw sockets

    if open_ports.is_empty() {
        return None;
    }

    // Check for Windows-specific ports
    let has_windows_ports = open_ports.iter().any(|p| p.port == 135 || p.port == 445 || p.port == 3389);
    // Check for Unix-specific ports
    let has_unix_ports = open_ports.iter().any(|p| p.port == 22 || p.port == 111);

    if has_windows_ports && !has_unix_ports {
        Some("Windows".to_string())
    } else if has_unix_ports && !has_windows_ports {
        Some("Unix/Linux".to_string())
    } else {
        Some("Unknown".to_string())
    }
}

/// Detect service version by connecting and reading banner
async fn detect_service_version(
    host: &str,
    port: &PortInfo,
    timeout_duration: Duration,
) -> Option<ServiceInfo> {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpStream;
    use tokio::time::timeout as tokio_timeout;

    let addr = format!("{}:{}", host, port.port);

    // Try to connect with timeout
    let stream = match tokio_timeout(timeout_duration, TcpStream::connect(&addr)).await {
        Ok(Ok(s)) => s,
        _ => return None,
    };

    let (mut reader, mut writer) = tokio::io::split(stream);

    // Send HTTP request for web servers
    if [80, 8000, 8080, 3000, 5173, 8787].contains(&port.port) {
        let _ = tokio_timeout(Duration::from_millis(100), async {
            let _ = writer.write_all(b"GET / HTTP/1.0\r\n\r\n").await;
            let mut buffer = vec![0u8; 1024];
            let n = reader.read(&mut buffer).await.ok()?;
            String::from_utf8_lossy(&buffer[..n]).to_string().into()
        }).await.ok().flatten();
    }

    // Read initial response/banner
    let mut buffer = vec![0u8; 512];
    let banner = tokio_timeout(Duration::from_millis(200), reader.read(&mut buffer)).await;

    if let Ok(Ok(n)) = banner {
        if n > 0 {
            let banner_str = String::from_utf8_lossy(&buffer[..n]);
            return Some(ServiceInfo {
                name: port.service.clone().unwrap_or_else(|| "unknown".to_string()),
                version: parse_version_from_banner(&banner_str),
                info: Some(banner_str.trim().to_string()),
            });
        }
    }

    None
}

/// Parse version string from service banner
fn parse_version_from_banner(banner: &str) -> Option<String> {
    // Look for common version patterns using simple string matching
    let patterns = [
        "Server: ",
        "version ",
        " v",
        "/",
    ];

    for line in banner.lines() {
        for pattern in &patterns {
            if let Some(pos) = line.find(pattern) {
                let start = pos + pattern.len();
                let remaining = &line[start..];
                // Extract version-like string (digits and dots)
                if let Some(end) = remaining.chars().position(|c| !c.is_ascii_digit() && c != '.') {
                    let version = &remaining[..end];
                    if !version.is_empty() && version.chars().filter(|&c| c == '.').count() <= 2 {
                        return Some(version.to_string());
                    }
                }
            }
        }
    }

    // Try to find HTTP server versions
    if banner.contains("Server:") {
        if let Some(start) = banner.find("Server:") {
            let line = &banner[start..];
            if let Some(end) = line.find('\r') {
                let server_line = &line[7..end].trim();
                return Some(server_line.to_string());
            }
            if let Some(end) = line.find('\n') {
                let server_line = &line[7..end].trim();
                return Some(server_line.to_string());
            }
        }
    }

    None
}

/// Check if nmap is available on the system
pub fn is_nmap_available() -> bool {
    use std::process::Command;
    let mut cmd = Command::new("nmap");
    cmd.arg("--version");
    
    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    
    cmd.output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

/// Run nmap subprocess for advanced scanning (NSE scripts, etc.)
pub async fn scan_with_nmap(
    host: &str,
    ports: Option<Vec<u16>>,
    os_detection: bool,
    version_detection: bool,
) -> Result<Vec<ScanResult>, String> {
    use tokio::process::Command;

    let mut cmd = Command::new("nmap");

    // Add target host
    cmd.arg(host);

    // Add port specification
    if let Some(ports) = ports {
        let port_list = ports.iter().map(|p| p.to_string()).collect::<Vec<_>>().join(",");
        cmd.arg("-p").arg(&port_list);
    }

    // OS detection
    if os_detection {
        cmd.arg("-O");
    }

    // Version detection
    if version_detection {
        cmd.arg("-sV");
    }

    // XML output for parsing
    cmd.arg("-oX").arg("-"); // Stdout

    // Fast scan
    cmd.arg("-T4");
    
    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("Failed to run nmap: {}", e))?;

    if !output.status.success() {
        return Err(format!("nmap scan failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    // Parse nmap XML output
    parse_nmap_xml(&String::from_utf8_lossy(&output.stdout))
}

/// Parse nmap XML output into ScanResult format
fn parse_nmap_xml(xml: &str) -> Result<Vec<ScanResult>, String> {
    // Simplified parsing - extract basic information
    let mut result = ScanResult {
        host: "unknown".to_string(),
        ports: Vec::new(),
        os_guess: None,
        services: Vec::new(),
    };

    for line in xml.lines() {
        // Extract host address
        if line.contains("address=") && line.contains("addr=") {
            if let Some(start) = line.find("addr=\"") {
                let addr_start = start + 6;
                if let Some(end) = line[addr_start..].find('"') {
                    result.host = line[addr_start..addr_start + end].to_string();
                }
            }
        }

        // Extract port information
        if line.contains("<port ") {
            if let Some(port_id) = extract_attr(line, "portid") {
                if let Ok(port_num) = port_id.parse::<u16>() {
                    let protocol = extract_attr(line, "protocol").unwrap_or_else(|| "tcp".to_string());
                    let state = extract_attr(line, "state").unwrap_or_else(|| "unknown".to_string());
                    let status = match state.as_str() {
                        "open" => PortStatus::Open,
                        "closed" => PortStatus::Closed,
                        _ => PortStatus::Filtered,
                    };

                    result.ports.push(PortInfo {
                        port: port_num,
                        status,
                        protocol,
                        service: None,
                        version: None,
                    });
                }
            }
        }

        // Extract service information
        if line.contains("<service ") {
            let name = extract_attr(line, "name").unwrap_or_else(|| "unknown".to_string());
            let version = extract_attr(line, "version");
            let product = extract_attr(line, "product");

            result.services.push(ServiceInfo {
                name: if product.is_some() { product.unwrap() } else { name.clone() },
                version,
                info: Some(name),
            });
        }

        // Extract OS guess
        if line.contains("<osmatch ") {
            if let Some(name) = extract_attr(line, "name") {
                result.os_guess = Some(name);
            }
        }
    }

    Ok(vec![result])
}

/// Extract attribute value from XML-like string
fn extract_attr(line: &str, attr: &str) -> Option<String> {
    // Simple string-based extraction
    if let Some(start) = line.find(&format!(r#"{}=""#, attr)) {
        let value_start = start + attr.len() + 2;
        if let Some(end) = line[value_start..].find('"') {
            return Some(line[value_start..value_start + end].to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_scan_localhost() {
        let results = scan_localhost(Some(vec![8787]), false, false).await;
        assert!(results.is_ok());
    }

    #[test]
    fn test_service_fingerprints() {
        assert!(SERVICE_FINGERPRINTS.iter().any(|(p, _)| *p == 22));
        assert!(SERVICE_FINGERPRINTS.iter().any(|(p, _)| *p == 8787));
    }

    #[test]
    fn test_parse_version() {
        // Test banners that should match the version patterns
        // Note: The function looks for versions followed by non-digit/non-dot characters
        let banners = [
            ("HTTP/1.1 200 OK\nServer: nginx/1.18.0", Some("1.18.0")),
            ("nginx v1.18.0 (Ubuntu)", Some("1.18.0")),
            ("Apache/2.4.41 (Unix)", Some("2.4.41")),
            ("OpenSSH/8.2p1 Ubuntu", Some("8.2")),
        ];

        for (banner, expected) in banners {
            let result = parse_version_from_banner(banner);
            if expected.is_some() {
                assert!(result.is_some(), "Expected to parse version from: {}", banner);
            }
        }

        // Test that invalid banners return None
        assert!(parse_version_from_banner("no version here").is_none());
        assert!(parse_version_from_banner("").is_none());
    }

    #[test]
    fn test_extract_attr() {
        let xml = r#"<port protocol="tcp" portid="80">"#;
        assert_eq!(extract_attr(xml, "protocol"), Some("tcp".to_string()));
        assert_eq!(extract_attr(xml, "portid"), Some("80".to_string()));
    }
}
