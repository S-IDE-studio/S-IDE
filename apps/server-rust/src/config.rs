//! Configuration management for S-IDE Core Daemon
//! 
//! Implements INV-4: Config-as-Code
//! Configuration resolution chain: env vars -> config file -> defaults

use crate::error::Error;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

const DEFAULT_PORT: u16 = 8787;
const DEFAULT_HOST: &str = "0.0.0.0";
const DEFAULT_DB_PATH: &str = "./data/side.db";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    /// Server port
    #[serde(default = "default_port")]
    pub port: u16,
    
    /// Server host
    #[serde(default = "default_host")]
    pub host: String,
    
    /// Database path
    #[serde(default = "default_db_path")]
    pub db_path: PathBuf,
    
    /// Maximum request body size (bytes)
    #[serde(default = "default_max_body_size")]
    pub max_body_size: usize,
    
    /// Maximum file size (bytes)
    #[serde(default = "default_max_file_size")]
    pub max_file_size: usize,
    
    /// CORS origin
    pub cors_origin: Option<String>,
    
    /// Basic auth credentials
    pub auth: Option<AuthConfig>,
    
    /// Log level
    #[serde(default = "default_log_level")]
    pub log_level: String,
    
    /// Environment
    #[serde(default = "default_env")]
    pub env: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub username: String,
    pub password: String,
}

fn default_port() -> u16 { DEFAULT_PORT }
fn default_host() -> String { DEFAULT_HOST.to_string() }
fn default_db_path() -> PathBuf { PathBuf::from(DEFAULT_DB_PATH) }
fn default_max_body_size() -> usize { 1024 * 1024 } // 1MB
fn default_max_file_size() -> usize { 50 * 1024 * 1024 } // 50MB
fn default_log_level() -> String { "info".to_string() }
fn default_env() -> String { "development".to_string() }

impl Default for Config {
    fn default() -> Self {
        Self {
            port: DEFAULT_PORT,
            host: DEFAULT_HOST.to_string(),
            db_path: PathBuf::from(DEFAULT_DB_PATH),
            max_body_size: default_max_body_size(),
            max_file_size: default_max_file_size(),
            cors_origin: None,
            auth: None,
            log_level: default_log_level(),
            env: default_env(),
        }
    }
}

impl Config {
    /// Load configuration from environment and config file
    /// 
    /// Resolution order (higher priority first):
    /// 1. Environment variables (SIDE_PORT, SIDE_HOST, etc.)
    /// 2. Config file (~/.side-ide/config.toml or ./config.toml)
    /// 3. Default values
    pub fn load() -> crate::error::Result<Self> {
        let mut config = Config::default();
        
        // Try to load from config file
        if let Ok(file_config) = Self::from_file() {
            config = config.merge(file_config);
        }
        
        // Override with environment variables
        config = config.merge_from_env();
        
        Ok(config)
    }
    
    /// Load configuration from file
    fn from_file() -> crate::error::Result<Self> {
        let config_paths = [
            PathBuf::from("./config.toml"),
            dirs::home_dir()
                .map(|h| h.join(".side-ide").join("config.toml"))
                .unwrap_or_default(),
        ];
        
        for path in &config_paths {
            if path.exists() {
                let content = std::fs::read_to_string(path)?;
                let config: Config = toml::from_str(&content)
                    .map_err(|e| Error::Config(format!("Invalid TOML: {}", e)))?;
                return Ok(config);
            }
        }
        
        Err(Error::Config("No config file found".to_string()))
    }
    
    /// Merge another config into self (other takes precedence for Some values)
    fn merge(mut self, other: Config) -> Self {
        self.port = other.port;
        self.host = other.host;
        self.db_path = other.db_path;
        self.max_body_size = other.max_body_size;
        self.max_file_size = other.max_file_size;
        if other.cors_origin.is_some() {
            self.cors_origin = other.cors_origin;
        }
        if other.auth.is_some() {
            self.auth = other.auth;
        }
        self.log_level = other.log_level;
        self.env = other.env;
        self
    }
    
    /// Override config from environment variables
    fn merge_from_env(mut self) -> Self {
        if let Ok(port) = std::env::var("SIDE_PORT") {
            if let Ok(port) = port.parse() {
                self.port = port;
            }
        }
        
        if let Ok(host) = std::env::var("SIDE_HOST") {
            self.host = host;
        }
        
        if let Ok(db_path) = std::env::var("SIDE_DB_PATH") {
            self.db_path = PathBuf::from(db_path);
        }
        
        if let Ok(cors_origin) = std::env::var("SIDE_CORS_ORIGIN") {
            self.cors_origin = Some(cors_origin);
        }
        
        if let Ok(log_level) = std::env::var("RUST_LOG") {
            self.log_level = log_level;
        }
        
        if let Ok(env) = std::env::var("SIDE_ENV") {
            self.env = env;
        }
        
        self
    }
    
    /// Validate configuration
    pub fn validate(&self) -> crate::error::Result<()> {
        if self.port == 0 {
            return Err(Error::Validation("Port cannot be 0".to_string()));
        }
        
        if self.host.is_empty() {
            return Err(Error::Validation("Host cannot be empty".to_string()));
        }
        
        if self.max_body_size == 0 {
            return Err(Error::Validation("Max body size cannot be 0".to_string()));
        }
        
        Ok(())
    }
    
    /// Get database URL for SQLx
    pub fn database_url(&self) -> String {
        format!("sqlite:{}", self.db_path.display())
    }
    
    /// Check if running in production
    pub fn is_production(&self) -> bool {
        self.env == "production"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert_eq!(config.port, 8787);
        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.log_level, "info");
    }
    
    #[test]
    fn test_config_validation() {
        let mut config = Config::default();
        config.port = 0;
        assert!(config.validate().is_err());
        
        let config = Config::default();
        assert!(config.validate().is_ok());
    }
}
