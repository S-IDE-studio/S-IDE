//! S-IDE Core Daemon
//! 
//! AI-optimized development environment backend.
//! Rust implementation of the Core Daemon.

use clap::Parser;
use std::net::SocketAddr;
use tracing::{info, warn};

mod config;
mod error;
mod routes;
mod server;
mod utils;

use crate::config::Config;
use crate::server::create_server;

/// S-IDE Core Daemon - AI-optimized development environment
#[derive(Parser, Debug)]
#[command(name = "side-core")]
#[command(about = "S-IDE Backend Server - AI-optimized development environment")]
#[command(version)]
struct Cli {
    /// Subcommand to run
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Parser, Debug)]
enum Commands {
    /// Start the server (daemon mode)
    Start {
        /// Port to listen on
        #[arg(short, long, default_value = "8787")]
        port: u16,
        
        /// Host to bind to
        #[arg(short, long, default_value = "0.0.0.0")]
        host: String,
        
        /// Run as daemon (background process)
        #[arg(short, long)]
        daemon: bool,
    },
    
    /// Check daemon status
    Status {
        /// Server port
        #[arg(short, long, default_value = "8787")]
        port: u16,
        
        /// Server host
        #[arg(short, long, default_value = "localhost")]
        host: String,
    },
    
    /// Validate configuration
    Validate,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let cli = Cli::parse();

    match cli.command {
        Some(Commands::Start { port, host, daemon }) => {
            if daemon {
                warn!("Daemon mode not yet implemented in Rust version");
            }
            
            info!("Starting S-IDE Core Daemon (Rust) v{}", env!("CARGO_PKG_VERSION"));
            info!("Listening on {}:{}", host, port);
            
            let config = Config::load()?;
            let addr: SocketAddr = format!("{}:{}", host, port).parse()?;
            
            let server = create_server(config).await?;
            let listener = tokio::net::TcpListener::bind(addr).await?;
            
            info!("Server ready");
            axum::serve(listener, server).await?;
        }
        
        Some(Commands::Status { port, host }) => {
            check_status(&host, port).await?;
        }
        
        Some(Commands::Validate) => {
            Config::load()?;
            info!("Configuration is valid");
        }
        
        None => {
            // Default: start server
            let config = Config::load()?;
            let addr: SocketAddr = "0.0.0.0:8787".parse()?;
            
            info!("Starting S-IDE Core Daemon (Rust) v{}", env!("CARGO_PKG_VERSION"));
            
            let server = create_server(config).await?;
            let listener = tokio::net::TcpListener::bind(addr).await?;
            
            info!("Server ready on http://{}", addr);
            axum::serve(listener, server).await?;
        }
    }

    Ok(())
}

async fn check_status(host: &str, port: u16) -> anyhow::Result<()> {
    use std::time::Duration;
    use tokio::time::timeout;
    
    let url = format!("http://{}:{}/api/health", host, port);
    
    match timeout(Duration::from_secs(5), reqwest::get(&url)).await {
        Ok(Ok(resp)) if resp.status().is_success() => {
            let data: serde_json::Value = resp.json().await?;
            println!("Daemon Status: Running");
            println!("  Version: {}", data["version"].as_str().unwrap_or("unknown"));
            println!("  Uptime: {}s", data["uptime"].as_u64().unwrap_or(0));
            println!("  Status: {}", data["status"].as_str().unwrap_or("unknown"));
        }
        _ => {
            println!("Daemon Status: Not running or unreachable");
            println!("  Tried: {}", url);
            std::process::exit(1);
        }
    }
    
    Ok(())
}
