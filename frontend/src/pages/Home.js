import { useNavigate } from 'react-router-dom';

const DRILLS = [
  { type: 'scene',         label: 'Scene Starter',      icon: '🎬', color: '#7c3aed' },
  { type: 'character',     label: 'Character Work',     icon: '🎭', color: '#0891b2' },
  { type: 'environment',   label: 'Environment',        icon: '🌍', color: '#059669' },
  { type: 'word_association', label: 'Word Association', icon: '💬', color: '#d97706' },
  { type: 'emotional',     label: 'Emotional Drill',    icon: '❤️',  color: '#be123c' },
  { type: 'story',         label: 'Story Structure',    icon: '📖', color: '#4338ca' },
  { type: 'first_last',    label: 'First / Last Line',  icon: '🎤', color: '#b45309', special: '/first-last' },
  { type: 'object',        label: 'Object Work',        icon: '📦', color: '#0f766e', special: '/object-work' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '24px 16px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>Improv Coach</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Solo practice. Every day.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {DRILLS.map(drill => (
          <button
            key={drill.type}
            onClick={() => navigate(drill.special || `/drill/${drill.type}`)}
            style={{
              background: 'var(--surface)',
              border: `1px solid ${drill.color}44`,
              borderRadius: 'var(--radius)',
              padding: '20px 14px',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
              textAlign: 'left',
              transition: 'transform 0.1s, border-color 0.15s',
              active: { transform: 'scale(0.97)' },
            }}
            onPointerDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
            onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
            onPointerLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span style={{ fontSize: 28 }}>{drill.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
              {drill.label}
            </span>
          </button>
        ))}

        <button
          onClick={() => {
            const types = DRILLS.filter(d => !d.special);
            const random = types[Math.floor(Math.random() * types.length)];
            navigate(`/drill/${random.type}`);
          }}
          style={{
            background: 'linear-gradient(135deg, #7c3aed22, #0891b222)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius)',
            padding: '20px 14px',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
            textAlign: 'left',
          }}
          onPointerDown={e => e.currentTarget.style.transform = 'scale(0.96)'}
          onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onPointerLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          <span style={{ fontSize: 28 }}>🎲</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', lineHeight: 1.3 }}>
            Random Drill
          </span>
        </button>
      </div>
    </div>
  );
}
