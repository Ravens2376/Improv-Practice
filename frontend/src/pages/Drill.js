import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPrompt, addFavorite, logDrill, createSession } from '../api';

const DRILL_LABELS = {
  scene: 'Scene Starter',
  character: 'Character Work',
  environment: 'Environment',
  word_association: 'Word Association',
  emotional: 'Emotional Drill',
  story: 'Story Structure',
};

const TIMER_OPTIONS = [60, 120, 180, 300];

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTotalTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function renderPromptData(type, data) {
  if (!data) return null;

  if (type === 'scene' || type === 'word_association') {
    return (
      <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5, color: 'var(--text)' }}>
        {data.text}
      </div>
    );
  }

  if (type === 'character') {
    return <LayeredPrompt layers={[
      { label: 'Who you are', text: data.layer1 },
      { label: 'Physical detail', text: data.layer2 },
      { label: 'What you\'re carrying', text: data.layer3 },
    ]} />;
  }

  if (type === 'environment') {
    return <LayeredPrompt layers={[
      { label: 'Where you are', text: data.location },
      { label: 'What you see / touch', text: data.detail1 },
      { label: 'What you hear / smell', text: data.detail2 },
      { label: 'Something just happened', text: data.circumstance },
    ]} />;
  }

  if (type === 'emotional') {
    return <LayeredPrompt layers={[
      { label: 'Emotion', text: data.emotion },
      { label: 'What caused it', text: data.trigger },
      { label: 'In your body', text: data.physicality },
    ]} />;
  }

  if (type === 'story') {
    return <LayeredPrompt layers={[
      { label: 'Once upon a time', text: data.once_upon_a_time },
      { label: 'Every day', text: data.every_day },
      { label: 'Until one day', text: data.until_one_day },
      { label: 'Because of that', text: data.because_of_that },
      { label: 'Until finally', text: data.until_finally },
      { label: 'The moral', text: data.moral },
    ]} />;
  }

  if (data.raw) {
    return <div style={{ fontSize: 16, lineHeight: 1.6 }}>{data.raw}</div>;
  }

  return null;
}

function LayeredPrompt({ layers }) {
  const [revealed, setRevealed] = useState(1);

  useEffect(() => setRevealed(1), [layers]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {layers.map((layer, i) => (
        <div key={i} style={{
          background: 'var(--surface2)',
          borderRadius: 10,
          padding: '14px 16px',
          opacity: i < revealed ? 1 : 0.25,
          transition: 'opacity 0.3s',
          borderLeft: i < revealed ? '3px solid var(--accent)' : '3px solid transparent',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
            {layer.label}
          </div>
          {i < revealed ? (
            <div style={{ fontSize: 16, lineHeight: 1.5 }}>{layer.text}</div>
          ) : (
            <button
              onClick={() => setRevealed(i + 1)}
              style={{
                background: 'var(--accent)', color: 'white', borderRadius: 8,
                padding: '6px 14px', fontSize: 13, fontWeight: 600,
              }}
            >
              Reveal
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Drill() {
  const { type } = useParams();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [timerDuration, setTimerDuration] = useState(120);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [drillsLogged, setDrillsLogged] = useState([]);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  const timerRef = useRef(null);
  const sessionRef = useRef(null);
  const sessionSecondsRef = useRef(0);

  // Session timer
  useEffect(() => {
    sessionRef.current = setInterval(() => {
      sessionSecondsRef.current += 1;
      setSessionSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(sessionRef.current);
  }, []);

  const fetchPrompt = useCallback(async () => {
    setLoading(true);
    setSavedFeedback('');
    try {
      const result = await getPrompt(type);
      setPrompt(result);
    } catch (e) {
      setSavedFeedback('Could not load prompt — is the backend running?');
    }
    setLoading(false);
  }, [type]);

  useEffect(() => { fetchPrompt(); }, [fetchPrompt]);

  // Drill timer
  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (timerRunning && timeLeft === 0) {
      setTimerRunning(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [timerRunning, timeLeft]);

  function startTimer() {
    setTimeLeft(timerDuration);
    setTimerRunning(true);
  }

  function stopTimer() {
    setTimerRunning(false);
    setTimeLeft(null);
  }

  async function handleNext() {
    if (prompt) {
      const promptText = JSON.stringify(prompt.data);
      const newLog = { drill_type: type, prompt_text: promptText };
      setDrillsLogged(prev => [...prev, newLog]);
      if (sessionId) {
        await logDrill({ session_id: sessionId, ...newLog });
      }
    }
    stopTimer();
    fetchPrompt();
  }

  async function handleSaveFavorite() {
    if (!prompt) return;
    await addFavorite(type, JSON.stringify(prompt.data));
    setSavedFeedback('Saved to favorites!');
    setTimeout(() => setSavedFeedback(''), 2000);
  }

  async function handleEndSession() {
    const total = sessionSecondsRef.current;
    const result = await createSession({
      duration_seconds: total,
      drill_types: [...new Set(drillsLogged.map(d => d.drill_type))],
      notes,
    });
    setSessionId(result.id);
    const msg = result.logged_day
      ? '✅ Day logged! (20+ min)'
      : `Session saved (${formatTotalTime(total)} — need ${formatTotalTime(1200 - total)} more to log a day)`;
    alert(msg);
    navigate('/progress');
  }

  const timerColor = timeLeft !== null && timeLeft < 15 ? 'var(--danger)' : 'var(--accent)';

  return (
    <div style={{ padding: '20px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/')} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-muted)', fontSize: 18 }}>
          ←
        </button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{DRILL_LABELS[type]}</h2>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: sessionSeconds >= 1200 ? 'var(--success)' : 'var(--text-muted)' }}>
          {formatTotalTime(sessionSeconds)}
        </span>
      </div>

      {/* Timer controls */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 }}>
        {timeLeft !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(timeLeft)}
            </span>
            <button onClick={stopTimer} style={{ background: 'var(--surface2)', color: 'var(--text-muted)', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
              Stop
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6, flex: 1, flexWrap: 'wrap' }}>
              {TIMER_OPTIONS.map(t => (
                <button
                  key={t}
                  onClick={() => setTimerDuration(t)}
                  style={{
                    background: timerDuration === t ? 'var(--accent)' : 'var(--surface2)',
                    color: timerDuration === t ? 'white' : 'var(--text-muted)',
                    borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600,
                  }}
                >
                  {formatTime(t)}
                </button>
              ))}
            </div>
            <button
              onClick={startTimer}
              style={{ background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Start
            </button>
          </div>
        )}
      </div>

      {/* Prompt card */}
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius)',
        padding: '20px 16px', marginBottom: 16, minHeight: 160,
        display: 'flex', alignItems: loading ? 'center' : 'flex-start', justifyContent: loading ? 'center' : 'flex-start',
      }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Generating prompt...</div>
        ) : prompt ? (
          renderPromptData(type, prompt.data)
        ) : null}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <button
          onClick={handleSaveFavorite}
          style={{ background: 'var(--surface)', border: '1px solid var(--surface2)', borderRadius: 10, padding: '12px', fontSize: 20, flex: '0 0 auto' }}
        >
          ⭐
        </button>
        <button
          onClick={handleNext}
          style={{ background: 'var(--accent)', color: 'white', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700, flex: 1 }}
        >
          Next Prompt
        </button>
      </div>

      {savedFeedback && (
        <div style={{ textAlign: 'center', color: 'var(--success)', fontSize: 13, marginBottom: 12 }}>
          {savedFeedback}
        </div>
      )}

      {/* Notes toggle */}
      <button
        onClick={() => setShowNotes(n => !n)}
        style={{ background: 'none', color: 'var(--text-muted)', fontSize: 13, marginBottom: 8, textDecoration: 'underline' }}
      >
        {showNotes ? 'Hide notes' : 'Add session notes'}
      </button>

      {showNotes && (
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="What felt good? What to work on?"
          rows={3}
          style={{
            width: '100%', background: 'var(--surface)', border: '1px solid var(--surface2)',
            borderRadius: 10, padding: '12px', color: 'var(--text)', fontSize: 14,
            resize: 'none', marginBottom: 12,
          }}
        />
      )}

      {/* End session */}
      <button
        onClick={handleEndSession}
        style={{
          width: '100%', background: 'var(--surface)', border: '1px solid var(--surface2)',
          borderRadius: 10, padding: '14px', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600,
          marginTop: 4,
        }}
      >
        End Session
      </button>
    </div>
  );
}
