import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPrompt, analyzeObjectWork, createSession } from '../api';

function extractFrames(videoBlob, count = 4) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(videoBlob);
    video.src = url;
    video.muted = true;
    const frames = [];
    const canvas = document.createElement('canvas');

    video.addEventListener('loadedmetadata', () => {
      const duration = video.duration;
      const interval = duration / (count + 1);
      let captured = 0;

      const captureAt = (time) => {
        video.currentTime = time;
      };

      video.addEventListener('seeked', () => {
        if (captured >= count) {
          URL.revokeObjectURL(url);
          resolve(frames);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const frame = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        frames.push(frame);
        captured++;
        if (captured < count) captureAt(interval * (captured + 1));
        else resolve(frames);
      });

      captureAt(interval);
    });

    video.load();
  });
}

export default function ObjectWork() {
  const navigate = useNavigate();
  const [step, setStep] = useState('intro');
  const [objectPrompt, setObjectPrompt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [withBlob, setWithBlob] = useState(null);
  const [withoutBlob, setWithoutBlob] = useState(null);
  const [withUrl, setWithUrl] = useState(null);
  const [withoutUrl, setWithoutUrl] = useState(null);
  const [sideBySide, setSideBySide] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [hasObject, setHasObject] = useState(null);
  const [customObjectInput, setCustomObjectInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [sessionStart] = useState(Date.now());
  const [recordDuration, setRecordDuration] = useState(null); // null = freeform
  const [countdown, setCountdown] = useState(null);          // 3,2,1 or null
  const [recordTimeLeft, setRecordTimeLeft] = useState(null); // counts down during recording
  const countdownRef = useRef(null);
  const recordTimerRef = useRef(null);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const [lastObject, setLastObject] = useState('');

  const fetchObjectPrompt = useCallback(async (exclude = '') => {
    setLoading(true);
    setObjectPrompt(null);
    const context = exclude ? `seed:${Math.random()},exclude:${exclude}` : `seed:${Math.random()}`;
    const result = await getPrompt('object', context);
    if (result.data) setLastObject(result.data.object || '');
    setObjectPrompt(result.data);
    setLoading(false);
  }, []);

  async function fetchCustomObjectPrompt(objectName) {
    setLoading(true);
    setObjectPrompt(null);
    setShowCustomInput(false);
    const result = await getPrompt('object', `object:${objectName},seed:${Math.random()}`);
    if (result.data) { result.data.object = objectName; setLastObject(objectName); }
    setObjectPrompt(result.data);
    setLoading(false);
  }

  async function fetchSameObjectPrompt(objectName) {
    setLoading(true);
    setObjectPrompt(null);
    const result = await getPrompt('object', `object:${objectName},seed:${Math.random()}`);
    if (result.data) { result.data.object = objectName; setLastObject(objectName); }
    setObjectPrompt(result.data);
    setLoading(false);
  }

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play();
    }
  }

  async function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  async function startRecording() {
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = e => chunksRef.current.push(e.data);
    recorder.start();
    setRecording(true);
  }

  async function stopRecording() {
    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        resolve(blob);
      };
      mediaRecorderRef.current.stop();
      setRecording(false);
    });
  }

  async function handleStartWithObject() {
    setStep('with_object');
    // Wait for the video element to render before attaching the stream
    setTimeout(async () => {
      await startCamera();
    }, 100);
  }

  async function handleStartRecordWith() {
    await startRecording();
  }

  async function handleStopRecordWith() {
    clearInterval(recordTimerRef.current);
    setRecordTimeLeft(null);
    const blob = await stopRecording();
    setWithBlob(blob);
    setWithUrl(URL.createObjectURL(blob));
    await stopCamera();
    setStep('without_object');
    setTimeout(async () => { await startCamera(); }, 100);
  }

  async function handleStartRecordWithout() {
    await startRecording();
  }

  async function handleStopRecordWithout() {
    clearInterval(recordTimerRef.current);
    setRecordTimeLeft(null);
    const blob = await stopRecording();
    setWithoutBlob(blob);
    setWithoutUrl(URL.createObjectURL(blob));
    await stopCamera();
    setStep('review');
  }

  function startWithCountdown(onStart, onAutoStop) {
    let count = 3;
    setCountdown(count);
    countdownRef.current = setInterval(() => {
      count -= 1;
      if (count === 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);
        onStart();
        if (recordDuration) {
          let t = recordDuration;
          setRecordTimeLeft(t);
          recordTimerRef.current = setInterval(() => {
            t -= 1;
            setRecordTimeLeft(t);
            if (t <= 0) {
              clearInterval(recordTimerRef.current);
              setRecordTimeLeft(null);
              onAutoStop();
            }
          }, 1000);
        }
      } else {
        setCountdown(count);
      }
    }, 1000);
  }

  function RecordingStep({ title, subtitle, onStart, onStop, isWithStep }) {
    return (
      <div style={{ padding: '20px 16px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 14 }}>{subtitle}</p>

        {/* Camera feed — always mounted, never conditionally removed */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <video ref={videoRef} style={{ width: '100%', borderRadius: 'var(--radius)', background: '#000', transform: 'scaleX(-1)', display: 'block' }} muted playsInline />

          {/* Countdown overlay */}
          {countdown !== null && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#00000088', borderRadius: 'var(--radius)',
            }}>
              <span style={{ fontSize: 96, fontWeight: 900, color: 'white', lineHeight: 1 }}>{countdown}</span>
            </div>
          )}

          {/* Recording timer overlay */}
          {recording && recordTimeLeft !== null && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: '#cc000099', borderRadius: 8, padding: '4px 12px',
              color: 'white', fontSize: 18, fontWeight: 700,
            }}>
              {recordTimeLeft}s
            </div>
          )}

          {/* Recording indicator dot */}
          {recording && (
            <div style={{
              position: 'absolute', top: 10, left: 10,
              background: '#cc0000', borderRadius: 20, width: 12, height: 12,
              boxShadow: '0 0 0 3px #cc000066',
            }} />
          )}
        </div>

        {/* Duration selector — only shown before recording starts, BELOW camera so video element doesn't remount */}
        {!recording && countdown === null && (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Recording Duration</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[null, 5, 10, 15, 20].map(d => (
                <button
                  key={d ?? 'free'}
                  onClick={() => setRecordDuration(d)}
                  style={{
                    background: recordDuration === d ? 'var(--accent)' : 'var(--surface2)',
                    color: recordDuration === d ? 'white' : 'var(--text-muted)',
                    borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {d ? `${d}s` : 'Free'}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          {!recording && countdown === null ? (
            <button
              onClick={() => startWithCountdown(onStart, onStop)}
              style={{ width: '100%', background: 'var(--danger)', color: 'white', borderRadius: 10, padding: '16px', fontSize: 15, fontWeight: 700 }}
            >
              ● {recordDuration ? `Record ${recordDuration}s` : 'Record'}
            </button>
          ) : countdown !== null ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 15, padding: '14px', fontWeight: 600 }}>Get ready...</div>
          ) : (
            recordDuration
              ? <div style={{ textAlign: 'center', color: 'var(--danger)', fontSize: 14, padding: '14px', fontWeight: 600 }}>Recording — auto-stops at {recordDuration}s</div>
              : <button onClick={onStop} style={{ width: '100%', background: 'var(--warning)', color: 'black', borderRadius: 10, padding: '16px', fontSize: 15, fontWeight: 700 }}>
                  ■ {isWithStep ? 'Stop & Continue' : 'Stop & Review'}
                </button>
          )}
        </div>
      </div>
    );
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    const [withFrames, withoutFrames] = await Promise.all([
      extractFrames(withBlob),
      extractFrames(withoutBlob),
    ]);
    const result = await analyzeObjectWork(objectPrompt?.object || 'object', withFrames, withoutFrames);
    setAnalysis(result.feedback);
    setAnalyzing(false);
  }

  async function handleEndSession() {
    const secs = Math.floor((Date.now() - sessionStart) / 1000);
    await createSession({ duration_seconds: secs, drill_types: ['object'], notes: '' });
    navigate('/progress');
  }

  function handleSkip() {
    setHasObject(false);
    setObjectPrompt(null);
    fetchObjectPrompt(lastObject);
  }

  // STEP: intro
  if (step === 'intro') {
    return (
      <div style={{ padding: '20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => navigate('/')} style={{ background: 'var(--surface2)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-muted)', fontSize: 18 }}>←</button>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Object Work</h2>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 60 }}>Finding an object...</div>
        ) : !objectPrompt ? (
          <div style={{ textAlign: 'center', marginTop: 60 }}>
            <button onClick={fetchObjectPrompt} style={{ background: 'var(--accent)', color: 'white', borderRadius: 12, padding: '16px 32px', fontSize: 16, fontWeight: 700 }}>
              Get Object Prompt
            </button>
          </div>
        ) : (
          <div>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '20px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Today's Object</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{objectPrompt.object}</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>{objectPrompt.scene_context}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>Try these actions:</div>
              {objectPrompt.actions?.map((a, i) => (
                <div key={i} style={{ fontSize: 14, padding: '6px 0', borderBottom: '1px solid var(--surface2)' }}>• {a}</div>
              ))}
            </div>

            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                Do you have a <strong>{objectPrompt.object}</strong> nearby?
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <button
                  onClick={() => { setHasObject(true); handleStartWithObject(); }}
                  style={{ flex: 1, background: 'var(--success)', color: 'white', borderRadius: 10, padding: '14px', fontSize: 15, fontWeight: 700 }}
                >
                  Yes, let's go
                </button>
                <button
                  onClick={handleSkip}
                  style={{ flex: 1, background: 'var(--surface2)', color: 'var(--text-muted)', borderRadius: 10, padding: '14px', fontSize: 15 }}
                >
                  Try another
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => fetchSameObjectPrompt(objectPrompt.object)}
                  style={{ flex: 1, background: 'var(--surface2)', color: 'var(--text-muted)', borderRadius: 10, padding: '12px', fontSize: 13 }}
                >
                  🔄 Same object, new scene
                </button>
                <button
                  onClick={() => setShowCustomInput(v => !v)}
                  style={{ flex: 1, background: 'var(--surface2)', color: 'var(--accent)', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 600 }}
                >
                  ✏️ Choose my own
                </button>
              </div>
              {showCustomInput && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={customObjectInput}
                    onChange={e => setCustomObjectInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && customObjectInput.trim() && fetchCustomObjectPrompt(customObjectInput.trim())}
                    placeholder="e.g. water bottle, notebook..."
                    style={{
                      flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)',
                      borderRadius: 8, padding: '10px 12px', color: 'var(--text)', fontSize: 14,
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => customObjectInput.trim() && fetchCustomObjectPrompt(customObjectInput.trim())}
                    style={{ background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '10px 16px', fontSize: 14, fontWeight: 700 }}
                  >
                    Go
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // STEP: with_object
  if (step === 'with_object') {
    return <RecordingStep
      title={`Step 1: With the ${objectPrompt?.object}`}
      subtitle={`${objectPrompt?.scene_context} Use it naturally.`}
      onStart={handleStartRecordWith}
      onStop={handleStopRecordWith}
      isWithStep={true}
    />;
  }

  // STEP: without_object
  if (step === 'without_object') {
    return <RecordingStep
      title={`Step 2: Without the ${objectPrompt?.object}`}
      subtitle={`Put the ${objectPrompt?.object} down. Mime using it — same actions, same intention.`}
      onStart={handleStartRecordWithout}
      onStop={handleStopRecordWithout}
      isWithStep={false}
    />;
  }

  // STEP: review
  if (step === 'review') {
    const withVideoRef = { current: null };
    const withoutVideoRef = { current: null };

    function playSynced() {
      if (withVideoRef.current && withoutVideoRef.current) {
        withVideoRef.current.currentTime = 0;
        withoutVideoRef.current.currentTime = 0;
        withVideoRef.current.play();
        withoutVideoRef.current.play();
      }
    }

    function fullscreenVideo(ref) {
      if (ref.current) ref.current.requestFullscreen();
    }

    function retryWithSameObject() {
      setWithBlob(null);
      setWithoutBlob(null);
      setWithUrl(null);
      setWithoutUrl(null);
      setAnalysis(null);
      setStep('with_object');
      setTimeout(async () => { await startCamera(); }, 100);
    }

    if (sideBySide) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 50, padding: '8px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Review — {objectPrompt?.object}</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={playSynced} style={{ background: 'var(--success)', color: 'white', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700 }}>▶ Play Both</button>
              <button onClick={() => setSideBySide(false)} style={{ background: 'var(--accent)', color: 'white', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>✕ Exit</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>With {objectPrompt?.object}</div>
              <video ref={el => withVideoRef.current = el} src={withUrl} controls playsInline
                style={{ width: '100%', flex: 1, minHeight: 0, borderRadius: 8, objectFit: 'contain', background: '#000' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textAlign: 'center' }}>Without</div>
              <video ref={el => withoutVideoRef.current = el} src={withoutUrl} controls playsInline
                style={{ width: '100%', flex: 1, minHeight: 0, borderRadius: 8, objectFit: 'contain', background: '#000' }} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', overflowY: 'auto', zIndex: 50, padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Review — {objectPrompt?.object}</h2>
          <button onClick={() => setSideBySide(true)}
            style={{ background: 'var(--surface2)', color: 'var(--text-muted)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600 }}>
            ⛶ Side by Side
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>With {objectPrompt?.object}</span>
              <button onClick={() => fullscreenVideo(withVideoRef)} style={{ background: 'none', color: 'var(--text-muted)', fontSize: 12 }}>⛶</button>
            </div>
            <video ref={el => withVideoRef.current = el} src={withUrl} controls playsInline
              style={{ width: '100%', borderRadius: 10, maxHeight: '45vh', objectFit: 'contain', background: '#000' }} />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Without</span>
              <button onClick={() => fullscreenVideo(withoutVideoRef)} style={{ background: 'none', color: 'var(--text-muted)', fontSize: 12 }}>⛶</button>
            </div>
            <video ref={el => withoutVideoRef.current = el} src={withoutUrl} controls playsInline
              style={{ width: '100%', borderRadius: 10, maxHeight: '45vh', objectFit: 'contain', background: '#000' }} />
          </div>
        </div>

        <button onClick={playSynced}
          style={{ width: '100%', background: 'var(--surface2)', color: 'var(--text)', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
          ▶ Play Both at Same Time
        </button>

        {!analysis && (
          <button onClick={handleAnalyze} disabled={analyzing}
            style={{ width: '100%', background: 'var(--accent)', color: 'white', borderRadius: 10, padding: '16px', fontSize: 15, fontWeight: 700, marginBottom: 12, opacity: analyzing ? 0.7 : 1 }}>
            {analyzing ? 'Analyzing...' : '🤖 Get AI Coaching Feedback'}
          </button>
        )}

        {analysis && (
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Coach Feedback</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{analysis}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <button onClick={retryWithSameObject}
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 600 }}>
            🔄 Retry Same Object
          </button>
          <button onClick={() => { setStep('intro'); setWithBlob(null); setWithoutBlob(null); setWithUrl(null); setWithoutUrl(null); setAnalysis(null); setObjectPrompt(null); setSideBySide(false); }}
            style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--surface2)', color: 'var(--text-muted)', borderRadius: 10, padding: '14px', fontSize: 14 }}>
            Try Another
          </button>
        </div>
        <button onClick={handleEndSession}
          style={{ width: '100%', background: 'var(--surface2)', color: 'var(--text)', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 600 }}>
          End Session
        </button>
      </div>
    );
  }

  return null;
}
