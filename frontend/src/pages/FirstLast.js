import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPrompt, addFavorite, createSession } from '../api';

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

export default function FirstLast() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLast, setShowLast] = useState(false);
  const [showLastFromStart, setShowLastFromStart] = useState(false);
  const [timerDuration, setTimerDuration] = useState(120);
  const [timeLeft, setTimeLeft] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState('');
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [drillCount, setDrillCount] = useState(0);

  const timerRef = useRef(null);
  const sessionRef = useRef(null);
  const sessionSecondsRef = useRef(0);

  useEffect(() => {
    sessionRef.current = setInterval(() => {
      sessionSecondsRef.current += 1;
      setSessionSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(sessionRef.current);
  }, []);

  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    } else if (timerRunning && timeLeft === 0) {
      setTimerRunning(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [timerRunning, timeLeft]);

  async function fetchPrompt() {
    setLoading(true);
    setSavedFeedback('');
    setShowLast(false);
    try {
      const result = await getPrompt('first_last');
      setPrompt(result.data);
      if (showLastFromStart) setShowLast(true);
    } catch {
      setSavedFeedback('Could not load prompt — is the backend running?');
    }
    setLoading(false);
  }

  useEffect(() => { fetchPrompt(); }, []);

  // When toggle changes, sync showLast
  useEffect(() => {
    if (showLastFromStart && prompt) setShowLast(true);
  }, [showLastFromStart]);

  function startTimer() {
    setTimeLeft(timerDuration);
    setTimerRunning(true);
  }

  function stopTimer() {
    setTimerRunning(false);
    setTimeLeft(null);
  }

  async function handleNext() {
    stopTimer();
    setDrillCount(c => c + 1);
    fetchPrompt();
  }

  async function handleSaveFavorite() {
    if (!prompt) return;
    await addFavorite('first_last', JSON.stringify(prompt));
    setSavedFeedback('Saved!');
    setTimeout(() => setSavedFeedback(''), 2000);
  }

  async function handleEndSession() {
    const total = sessionSecondsRef.current;
    const result = await createSession({
      duration_seconds: total,
      drill_types: ['first_last'],
      notes,
    });
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
        <button onClick={() => navigate('/')} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-muted)', fontSize: 18 }}>←</button>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>First Line / Last Line</h2>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: sessionSeconds >= 1200 ? 'var(--success)' : 'var(--text-muted)' }}>
          {formatTotalTime(sessionSeconds)}
        </span>
      </div>

      {/* Show last line toggle */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Show last line from the start</span>
        <button
          onClick={() => setShowLastFromStart(v => !v)}
          style={{
            width: 44, height: 24, borderRadius: 12,
            background: showLastFromStart ? 'var(--accent)' : 'var(--surface2)',
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: showLastFromStart ? 23 : 3,
            width: 18, height: 18, borderRadius: 9, background: 'white',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>

      {/* Timer */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16 }}>
        {timeLeft !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: timerColor, fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(timeLeft)}
            </span>
            <button onClick={stopTimer} style={{ background: 'var(--surface2)', color: 'var(--text-muted)', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>Stop</button>
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
            <button onClick={startTimer} style={{ background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
              Start
            </button>
          </div>
        )}
      </div>

      {/* Prompt card */}
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 16px', marginBottom: 16, minHeight: 160 }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Generating prompt...</div>
        ) : prompt ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* First line — always visible */}
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>First Line</div>
              <div style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 500 }}>"{prompt.first_line}"</div>
            </div>

            {/* Last line — revealed or hidden */}
            <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '14px 16px', borderLeft: showLast ? '3px solid var(--success)' : '3px solid transparent' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Last Line</div>
              {showLast ? (
                <div style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 500, color: 'var(--success)' }}>"{prompt.last_line}"</div>
              ) : (
                <button
                  onClick={() => setShowLast(true)}
                  style={{ background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600 }}
                >
                  Reveal Last Line
                </button>
              )}
            </div>

          </div>
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
        <div style={{ textAlign: 'center', color: 'var(--success)', fontSize: 13, marginBottom: 12 }}>{savedFeedback}</div>
      )}

      {/* Notes */}
      <button onClick={() => setShowNotes(n => !n)} style={{ background: 'none', color: 'var(--text-muted)', fontSize: 13, marginBottom: 8, textDecoration: 'underline' }}>
        {showNotes ? 'Hide notes' : 'Add session notes'}
      </button>
      {showNotes && (
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="What felt good? What to work on?"
          rows={3}
          style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface2)', borderRadius: 10, padding: '12px', color: 'var(--text)', fontSize: 14, resize: 'none', marginBottom: 12 }}
        />
      )}

      {/* End session */}
      <button
        onClick={handleEndSession}
        style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--surface2)', borderRadius: 10, padding: '14px', color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, marginTop: 4 }}
      >
        End Session
      </button>
    </div>
  );
}
