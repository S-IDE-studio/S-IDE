//! PTY (Pseudo Terminal) Manager

use std::collections::HashMap;
use std::io::Write;

use parking_lot::Mutex;
use portable_pty::{CommandBuilder, PtySize};
use tokio::sync::{mpsc, oneshot};
use tracing::{info, warn};

use crate::models::terminal::{Terminal, TerminalSize};

/// Commands that can be sent to the PTY manager
#[derive(Debug)]
pub enum PtyCommand {
    CreateSession {
        terminal: Terminal,
        size: TerminalSize,
        respond_to: oneshot::Sender<anyhow::Result<String>>,
    },
    WriteToSession {
        id: String,
        data: String,
        respond_to: oneshot::Sender<anyhow::Result<()>>,
    },
    ResizeSession {
        id: String,
        size: TerminalSize,
        respond_to: oneshot::Sender<anyhow::Result<()>>,
    },
    KillSession {
        id: String,
        respond_to: oneshot::Sender<anyhow::Result<()>>,
    },
    GetSessionStatus {
        id: String,
        respond_to: oneshot::Sender<Option<bool>>,
    },
    ListSessions {
        respond_to: oneshot::Sender<Vec<(String, bool)>>,
    },
    CleanupDeadSessions {
        respond_to: oneshot::Sender<usize>,
    },
}

/// Inner PTY session storage
struct PtySession {
    terminal: Terminal,
    master: Mutex<Box<dyn portable_pty::MasterPty + Send>>,
    child: Mutex<Box<dyn portable_pty::Child + Send>>,
}

/// Manages all active PTY sessions
#[derive(Clone)]
pub struct PtyManager {
    sender: mpsc::UnboundedSender<PtyCommand>,
}

impl PtyManager {
    /// Create a new PTY manager
    pub fn new() -> anyhow::Result<Self> {
        let (sender, mut receiver) = mpsc::unbounded_channel::<PtyCommand>();
        
        // Spawn the manager task
        tokio::task::spawn_blocking(move || {
            let mut sessions: HashMap<String, PtySession> = HashMap::new();
            let pty_system = portable_pty::native_pty_system();

            while let Some(cmd) = receiver.blocking_recv() {
                match cmd {
                    PtyCommand::CreateSession { terminal, size, respond_to } => {
                        let result = create_session(&*pty_system, &mut sessions, terminal, size);
                        let _ = respond_to.send(result);
                    }
                    PtyCommand::WriteToSession { id, data, respond_to } => {
                        let result = write_to_session(&sessions, &id, &data);
                        let _ = respond_to.send(result);
                    }
                    PtyCommand::ResizeSession { id, size, respond_to } => {
                        let result = resize_session(&sessions, &id, size);
                        let _ = respond_to.send(result);
                    }
                    PtyCommand::KillSession { id, respond_to } => {
                        let result = kill_session(&mut sessions, &id);
                        let _ = respond_to.send(result);
                    }
                    PtyCommand::GetSessionStatus { id, respond_to } => {
                        let status = get_session_status(&sessions, &id);
                        let _ = respond_to.send(status);
                    }
                    PtyCommand::ListSessions { respond_to } => {
                        let list = list_sessions(&sessions);
                        let _ = respond_to.send(list);
                    }
                    PtyCommand::CleanupDeadSessions { respond_to } => {
                        let count = cleanup_dead_sessions(&mut sessions);
                        let _ = respond_to.send(count);
                    }
                }
            }

            // Cleanup all sessions when manager shuts down
            for (id, session) in sessions {
                let mut child = session.child.lock();
                let _ = child.kill();
                info!("Cleaned up PTY session on shutdown: {}", id);
            }
        });

        info!("PTY manager initialized");
        Ok(Self { sender })
    }

    /// Create a new terminal session
    pub async fn create_session(&self, terminal: Terminal, size: TerminalSize) -> anyhow::Result<String> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(PtyCommand::CreateSession {
            terminal,
            size,
            respond_to: tx,
        })?;
        rx.await?
    }

    /// Write to a session
    pub async fn write_to_session(&self, id: &str, data: &str) -> anyhow::Result<()> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(PtyCommand::WriteToSession {
            id: id.to_string(),
            data: data.to_string(),
            respond_to: tx,
        })?;
        rx.await?
    }

    /// Resize a session
    pub async fn resize_session(&self, id: &str, size: TerminalSize) -> anyhow::Result<()> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(PtyCommand::ResizeSession {
            id: id.to_string(),
            size,
            respond_to: tx,
        })?;
        rx.await?
    }

    /// Kill a session
    pub async fn kill_session(&self, id: &str) -> anyhow::Result<()> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(PtyCommand::KillSession {
            id: id.to_string(),
            respond_to: tx,
        })?;
        rx.await?
    }

    /// Check if a session is running
    pub async fn is_running(&self, id: &str) -> Option<bool> {
        let (tx, rx) = oneshot::channel();
        self.sender.send(PtyCommand::GetSessionStatus {
            id: id.to_string(),
            respond_to: tx,
        }).ok()?;
        rx.await.ok().flatten()
    }

    /// List all active sessions
    pub async fn list_sessions(&self) -> Vec<(String, bool)> {
        let (tx, rx) = oneshot::channel();
        if self.sender.send(PtyCommand::ListSessions { respond_to: tx }).is_err() {
            return vec![];
        }
        rx.await.unwrap_or_default()
    }

    /// Clean up dead sessions
    pub async fn cleanup_dead_sessions(&self) -> usize {
        let (tx, rx) = oneshot::channel();
        if self.sender.send(PtyCommand::CleanupDeadSessions { respond_to: tx }).is_err() {
            return 0;
        }
        rx.await.unwrap_or(0)
    }

    /// Get the number of active sessions
    pub async fn session_count(&self) -> usize {
        self.list_sessions().await.len()
    }
}

// Helper functions for the manager task
fn create_session(
    pty_system: &(dyn portable_pty::PtySystem),
    sessions: &mut HashMap<String, PtySession>,
    terminal: Terminal,
    size: TerminalSize,
) -> anyhow::Result<String> {
    let terminal_id = terminal.id.clone();
    
    let shell = terminal
        .shell
        .clone()
        .or_else(|| std::env::var("SHELL").ok())
        .unwrap_or_else(|| {
            if cfg!(windows) {
                "powershell.exe".to_string()
            } else {
                "sh".to_string()
            }
        });

    let cwd = terminal
        .cwd
        .clone()
        .filter(|p| std::path::Path::new(p).exists())
        .unwrap_or_else(|| std::env::current_dir()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| "/".to_string()));

    let pty_pair = pty_system.openpty(PtySize {
        rows: size.rows,
        cols: size.cols,
        pixel_width: 0,
        pixel_height: 0,
    })?;

    let mut cmd_builder = CommandBuilder::new(&shell);
    cmd_builder.cwd(cwd);

    let child = pty_pair.slave.spawn_command(cmd_builder)?;
    
    info!(
        "Created PTY session: {} (shell: {})",
        terminal_id, shell
    );

    let session = PtySession {
        terminal,
        master: Mutex::new(pty_pair.master),
        child: Mutex::new(child),
    };

    sessions.insert(terminal_id.clone(), session);
    Ok(terminal_id)
}

fn write_to_session(
    sessions: &HashMap<String, PtySession>,
    id: &str,
    data: &str,
) -> anyhow::Result<()> {
    if let Some(session) = sessions.get(id) {
        let master = session.master.lock();
        let mut writer = master.take_writer()?;
        writer.write_all(data.as_bytes())?;
        writer.flush()?;
        Ok(())
    } else {
        Err(anyhow::anyhow!("Session '{}' not found", id))
    }
}

fn resize_session(
    sessions: &HashMap<String, PtySession>,
    id: &str,
    size: TerminalSize,
) -> anyhow::Result<()> {
    if let Some(session) = sessions.get(id) {
        let master = session.master.lock();
        master.resize(PtySize {
            rows: size.rows,
            cols: size.cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;
        Ok(())
    } else {
        Err(anyhow::anyhow!("Session '{}' not found", id))
    }
}

fn kill_session(
    sessions: &mut HashMap<String, PtySession>,
    id: &str,
) -> anyhow::Result<()> {
    if let Some(session) = sessions.remove(id) {
        let mut child = session.child.lock();
        child.kill()?;
        info!("Killed PTY session: {}", id);
        Ok(())
    } else {
        Err(anyhow::anyhow!("Session '{}' not found", id))
    }
}

fn get_session_status(
    sessions: &HashMap<String, PtySession>,
    id: &str,
) -> Option<bool> {
    sessions.get(id).map(|session| {
        let mut child = session.child.lock();
        matches!(child.try_wait(), Ok(None))
    })
}

fn list_sessions(
    sessions: &HashMap<String, PtySession>,
) -> Vec<(String, bool)> {
    sessions
        .iter()
        .map(|(id, session)| {
            let mut child = session.child.lock();
            let is_running = matches!(child.try_wait(), Ok(None));
            (id.clone(), is_running)
        })
        .collect()
}

fn cleanup_dead_sessions(
    sessions: &mut HashMap<String, PtySession>,
) -> usize {
    let dead_sessions: Vec<String> = sessions
        .iter()
        .filter(|(_, session)| {
            let mut child = session.child.lock();
            !matches!(child.try_wait(), Ok(None))
        })
        .map(|(id, _)| id.clone())
        .collect();

    for id in &dead_sessions {
        sessions.remove(id);
        info!("Cleaned up dead PTY session: {}", id);
    }

    dead_sessions.len()
}
