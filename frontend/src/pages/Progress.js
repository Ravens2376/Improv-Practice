import { useState, useEffect } from 'react';
import { getStats } from '../api';

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const DRILL_LABELS = {
  scene: 'Scene',
  character: 'Character',
  environment: 'Environment',
  word_association: 'Word Assoc.',
  emotional: 'Emotional',
  story: 'Story',
  object: 'Object Work',
};

export default function Progress() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats().then(s => { setStats(s); setLoading(false); });
  }, []);

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading...</div>;

  const drillEntries = Object.entries(stats.drill_counts || {}).sort((a, b) => b[1] - a[1]);
  const maxDrillCount = drillEntries.length ? drillEntries[0][1] : 1;

  return (
    <div style={{ padding: '24px 16px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Progress</h2>

      {/* Streak + stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Streak', value: `${stats.current_streak}🔥`, sub: 'days' },
          { label: 'Days Logged', value: stats.total_logged_days, sub: '20min+ sessions' },
          { label: 'Total Sessions', value: stats.total_sessions, sub: 'all time' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Drill breakdown */}
      {drillEntries.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
            Drills Practiced
          </div>
          {drillEntries.map(([type, count]) => (
            <div key={type} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{DRILL_LABELS[type] || type}</span>
                <span style={{ color: 'var(--text-muted)' }}>{count}</span>
              </div>
              <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${(count / maxDrillCount) * 100}%`, background: 'var(--accent)', borderRadius: 3, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent sessions */}
      {stats.recent_sessions?.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Recent Sessions
          </div>
          {stats.recent_sessions.map(s => (
            <div key={s.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 14 }}>{new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{formatTime(s.duration_seconds)}</span>
                  {s.logged_day && <span style={{ fontSize: 12, background: 'var(--success)', color: 'black', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>✓ Day</span>}
                </div>
              </div>
              {s.drill_types?.filter(Boolean).length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {s.drill_types.filter(Boolean).map(t => (
                    <span key={t} style={{ fontSize: 11, background: 'var(--surface2)', borderRadius: 6, padding: '3px 8px', color: 'var(--text-muted)' }}>
                      {DRILL_LABELS[t] || t}
                    </span>
                  ))}
                </div>
              )}
              {s.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>"{s.notes}"</div>}
            </div>
          ))}
        </div>
      )}

      {stats.total_sessions === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, fontSize: 15 }}>
          No sessions yet — start practicing!
        </div>
      )}
    </div>
  );
}
