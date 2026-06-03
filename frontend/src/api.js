const API = process.env.REACT_APP_API_URL || 'http://localhost:8002';

export async function getPrompt(drillType, context = '') {
  const params = context ? `?context=${encodeURIComponent(context)}` : '';
  const res = await fetch(`${API}/api/prompt/${drillType}${params}`);
  if (!res.ok) throw new Error('Failed to get prompt');
  return res.json();
}

export async function createSession(data) {
  const res = await fetch(`${API}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function logDrill(data) {
  await fetch(`${API}/api/drill-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getStats() {
  const res = await fetch(`${API}/api/stats`);
  return res.json();
}

export async function addFavorite(drillType, promptText) {
  const res = await fetch(`${API}/api/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drill_type: drillType, prompt_text: promptText }),
  });
  return res.json();
}

export async function getFavorites() {
  const res = await fetch(`${API}/api/favorites`);
  return res.json();
}

export async function deleteFavorite(id) {
  await fetch(`${API}/api/favorites/${id}`, { method: 'DELETE' });
}

export async function analyzeObjectWork(objectName, withFrames, withoutFrames) {
  const res = await fetch(`${API}/api/object-analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object_name: objectName,
      with_frames: withFrames,
      without_frames: withoutFrames,
    }),
  });
  return res.json();
}
