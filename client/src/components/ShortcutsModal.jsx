import Button from './ui/Button.jsx';
import Modal from './ui/Modal.jsx';

export const SHORTCUTS = [
  { key: 'T', label: 'Focus the new-topic input' },
  { key: 'P', label: 'Start a quick-check poll' },
  { key: 'F', label: 'Toggle present mode' },
  { key: '?', label: 'Show this help' },
  { key: 'Esc', label: 'Close dialogs and present mode' },
];

export default function ShortcutsModal({ onClose }) {
  return (
    <Modal title={<>Keyboard <em>shortcuts</em></>} description="Ignored while you are typing in a field." onClose={onClose}>
      <ul className="shortcuts">
        {SHORTCUTS.map((shortcut) => (
          <li key={shortcut.key}>
            <span>{shortcut.label}</span>
            <kbd>{shortcut.key}</kbd>
          </li>
        ))}
      </ul>
      <div className="modal-actions" style={{ marginTop: 20 }}>
        <Button onClick={onClose}>Got it</Button>
      </div>
    </Modal>
  );
}
