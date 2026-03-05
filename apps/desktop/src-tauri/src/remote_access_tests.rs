//! Unit tests for Remote Access target port selection.

use crate::remote_access::select_remote_access_target_port;

#[test]
fn keeps_server_port_when_server_serves_ui() {
    let chosen = select_remote_access_target_port(8787, true, &[]);
    assert_eq!(chosen, Ok(8787));
}

#[test]
fn falls_back_to_vite_port_when_server_has_no_ui() {
    let chosen = select_remote_access_target_port(8787, false, &[5173]);
    assert_eq!(chosen, Ok(5173));
}

#[test]
fn falls_back_to_detected_dev_port_when_vite_port_differs() {
    let chosen = select_remote_access_target_port(8787, false, &[1420]);
    assert_eq!(chosen, Ok(1420));
}

#[test]
fn returns_error_when_no_ui_candidate_found() {
    let chosen = select_remote_access_target_port(8787, false, &[]);
    assert!(chosen.is_err());
}
