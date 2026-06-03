import { useNavigate, useLocation } from 'react-router-dom';

const tabs = [
  { path: '/', icon: '🎭', label: 'Home' },
  { path: '/progress', icon: '📈', label: 'Progress' },
  { path: '/favorites', icon: '⭐', label: 'Saved' },
];

export default function Nav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: 'var(--surface)',
      borderTop: '1px solid var(--surface2)',
      display: 'flex',
      zIndex: 100,
    }}>
      {tabs.map(tab => {
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1, padding: '12px 0 10px',
              background: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: 11, fontWeight: active ? 600 : 400,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
