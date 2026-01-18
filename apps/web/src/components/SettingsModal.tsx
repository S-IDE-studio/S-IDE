import { useState, useEffect } from 'react';

interface Settings {
  port: number;
  basicAuthEnabled: boolean;
  basicAuthUser: string;
  basicAuthPassword: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => Promise<void>;
}

const LABEL_SETTINGS = '設定';
const LABEL_SERVER = 'サーバー設定';
const LABEL_PORT = 'ポート番号';
const LABEL_AUTH = 'Basic認証';
const LABEL_AUTH_ENABLE = 'Basic認証を有効にする';
const LABEL_USERNAME = 'ユーザー名';
const LABEL_PASSWORD = 'パスワード';
const LABEL_PASSWORD_NOTE = '※ 12文字以上推奨';
const LABEL_CANCEL = 'キャンセル';
const LABEL_SAVE = '保存';
const LABEL_RESTART_NOTE = '※ 設定を保存すると、サーバーが再起動されます';

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
  const [port, setPort] = useState(8787);
  const [basicAuthEnabled, setBasicAuthEnabled] = useState(false);
  const [basicAuthUser, setBasicAuthUser] = useState('');
  const [basicAuthPassword, setBasicAuthPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load current settings from server
      fetch('/api/settings')
        .then(res => res.json())
        .then((data: Settings) => {
          setPort(data.port);
          setBasicAuthEnabled(data.basicAuthEnabled);
          setBasicAuthUser(data.basicAuthUser);
          setBasicAuthPassword(data.basicAuthPassword);
        })
        .catch(err => {
          console.error('Failed to load settings:', err);
        });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        port,
        basicAuthEnabled,
        basicAuthUser,
        basicAuthPassword
      });
      onClose();
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{LABEL_SETTINGS}</h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <section className="settings-section">
              <h3 className="settings-section-title">{LABEL_SERVER}</h3>

              <div className="form-group">
                <label htmlFor="port" className="form-label">
                  {LABEL_PORT}
                </label>
                <input
                  type="number"
                  id="port"
                  className="form-input"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  min={1024}
                  max={65535}
                  required
                />
              </div>

              <div className="form-group">
                <h4 className="form-subsection-title">{LABEL_AUTH}</h4>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={basicAuthEnabled}
                    onChange={(e) => setBasicAuthEnabled(e.target.checked)}
                  />
                  <span>{LABEL_AUTH_ENABLE}</span>
                </label>
              </div>

              {basicAuthEnabled && (
                <>
                  <div className="form-group">
                    <label htmlFor="username" className="form-label">
                      {LABEL_USERNAME}
                    </label>
                    <input
                      type="text"
                      id="username"
                      className="form-input"
                      value={basicAuthUser}
                      onChange={(e) => setBasicAuthUser(e.target.value)}
                      required={basicAuthEnabled}
                      autoComplete="username"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="password" className="form-label">
                      {LABEL_PASSWORD}
                    </label>
                    <input
                      type="password"
                      id="password"
                      className="form-input"
                      value={basicAuthPassword}
                      onChange={(e) => setBasicAuthPassword(e.target.value)}
                      required={basicAuthEnabled}
                      minLength={12}
                      autoComplete="new-password"
                    />
                    <p className="form-note">{LABEL_PASSWORD_NOTE}</p>
                  </div>
                </>
              )}
            </section>

            <p className="settings-restart-note">{LABEL_RESTART_NOTE}</p>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="ghost-button"
              onClick={onClose}
              disabled={isSaving}
            >
              {LABEL_CANCEL}
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSaving}
            >
              {isSaving ? '保存中...' : LABEL_SAVE}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
