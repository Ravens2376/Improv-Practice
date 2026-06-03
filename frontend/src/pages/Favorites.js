import { useState, useEffect } from 'react';
import { getFavorites, deleteFavorite } from '../api';

const DRILL_LABELS = {
  scene: 'Scene',
  character: 'Character',
  environment: 'Environment',
  word_association: 'Word Assoc.',
  emotional: 'Emotional',
  story: 'Story',
  object: 'Object Work',
};

function parsePromptText(drillType, text) {
  try {
    const data = JSON.parse(text);
    if (drillType === 'scene' || drillType === 'word_association') return data.text;
    if (drillType === 'character') return `${data.layer1} — ${data.layer2}`;
    if (drillType === 'environment') return `${data.location}: ${data.detail1}`;
    if (drillType === 'emotional') return `${data.emotion} — ${data.trigger}`;
    if (drillType === 'story') return data.once_upon_a_time;
    if (drillType === 'object') return `${data.object}: ${data.scene_context}`;
    return text;
  } catch {
    return text;
  }
}

export default function Favorites() {
  const [favs, setFavs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFavorites().then(f => { setFavs(f); setLoading(false); });
  }, []);

  async function handleDelete(id) {
    await deleteFavorite(id);
    setFavs(f => f.filter(x => x.id !== id));
  }

  if (loading) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ padding: '24px 16px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Saved Prompts</h2>

      {favs.length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 60, fontSize: 15 }}>
          No saved prompts yet — tap ⭐ during a drill to save one.
        </div>
      )}

      {favs.map(fav => (
        <div key={fav.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, background: 'var(--surface2)', borderRadius: 6, padding: '3px 8px', color: 'var(--accent)', fontWeight: 600 }}>
                {DRILL_LABELS[fav.drill_type] || fav.drill_type}
              </span>
              <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 10, color: 'var(--text)' }}>
                {parsePromptText(fav.drill_type, fav.prompt_text)}
              </div>
            </div>
            <button
              onClick={() => handleDelete(fav.id)}
              style={{ background: 'none', color: 'var(--text-muted)', fontSize: 18, padding: '4px', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
