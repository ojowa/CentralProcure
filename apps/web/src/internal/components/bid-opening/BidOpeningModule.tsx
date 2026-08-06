import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { InternalModule, BidOpeningSessionSummary, BidOpeningSessionDetail, TenderSummary } from '../../types/internal';
import { fetchBidOpeningSessions, fetchBidOpeningSessionDetails, createBidOpeningSession, updateBidOpeningSession, fetchModuleData } from '../../services/moduleService';

interface Props {
  module: InternalModule;
  token: string | null;
  role?: string | null;
  initialData?: any;
}

export const BidOpeningModule = ({ module, token, role, initialData }: Props) => {
  const searchParams = useSearchParams();
  const [view, setViewState] = useState<'list' | 'create' | 'control'>(
    (searchParams.get('view') as 'list' | 'create' | 'control') || 'list'
  );
  const setView = (v: 'list' | 'create' | 'control') => {
    setViewState(v);
    const params = new URLSearchParams(window.location.search);
    params.set('view', v);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  };
  const [sessions, setSessions] = useState<BidOpeningSessionSummary[]>([]);
  const [selectedSession, setSelectedSession] = useState<BidOpeningSessionDetail | null>(null);
  const [publishedTenders, setPublishedTenders] = useState<TenderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time clock state
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Form states
  const [newSession, setNewSession] = useState({ 
    TenderId: '', SessionTitle: '', Location: '', ScheduledAt: '', Notes: '' 
  });

  useEffect(() => {
    if (initialData && initialData.Items) {
      setSessions(initialData.Items);
    } else if (token) {
      loadSessions();
    }
  }, [initialData, token]);

  const loadSessions = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchBidOpeningSessions(token);
      setSessions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartCreate = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch published tenders to link a session to
      const tenderData: any = await fetchModuleData('create-tender', token);
      setPublishedTenders(tenderData?.Items || []);
      setView('create');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      await createBidOpeningSession(newSession, token);
      loadSessions();
      setView('list');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleControlSession = async (sessionId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchBidOpeningSessionDetails(sessionId, token);
      setSelectedSession(data);
      setView('control');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: 'Open' | 'Closed') => {
    if (!token || !selectedSession) return;
    setLoading(true);
    try {
      const updateData: any = { Status: status };
      if (status === 'Open') updateData.OpenedAt = new Date().toISOString();
      if (status === 'Closed') updateData.ClosedAt = new Date().toISOString();
      
      await updateBidOpeningSession(selectedSession.SessionId, updateData, token);
      const updated = await fetchBidOpeningSessionDetails(selectedSession.SessionId, token);
      setSelectedSession(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isTimeForOpening = selectedSession ? now >= new Date(selectedSession.ScheduledAt) : false;

  const getCountdown = () => {
    if (!selectedSession) return null;
    const diff = new Date(selectedSession.ScheduledAt).getTime() - now.getTime();
    if (diff <= 0) return "00:00:00";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <section className="portal-module">
      <header className="portal-module__header">
        <div>
          <h2>{module.title}</h2>
          <p>{module.description}</p>
        </div>
        {view === 'list' && (
          <button className="plan-button" onClick={handleStartCreate}>+ Schedule Session</button>
        )}
        {view !== 'list' && (
          <button className="plan-button plan-button--secondary" onClick={() => setView('list')}>Back to Sessions</button>
        )}
      </header>

      {error && <div className="portal-alert">{error}</div>}

      {view === 'list' && (
        <div className="portal-table-container">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Scheduled At</th>
                <th>Session Title</th>
                <th>Location</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.SessionId}>
                  <td><strong>{new Date(s.ScheduledAt).toLocaleString()}</strong></td>
                  <td>{s.SessionTitle}</td>
                  <td>{s.Location}</td>
                  <td><span className={`plan-badge plan-badge--${(s.Status || 'Scheduled').toLowerCase()}`}>{s.Status}</span></td>
                  <td>
                    <button className="plan-button plan-button--sm" onClick={() => handleControlSession(s.SessionId)}>Control Panel</button>
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="plan-empty">No bid opening sessions scheduled.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {view === 'create' && (
        <form className="portal-form" onSubmit={handleCreateSession}>
          <h3>Schedule Public Bid Opening</h3>
          <div className="portal-form-grid">
            <label className="plan-field">
              <span>Select Tender</span>
              <select className="plan-input" required value={newSession.TenderId} onChange={e => setNewSession({...newSession, TenderId: e.target.value})}>
                <option value="">-- Choose Tender --</option>
                {publishedTenders.map(t => (
                  <option key={t.TenderId} value={t.TenderId}>{t.Title}</option>
                ))}
              </select>
            </label>
            <label className="plan-field">
              <span>Session Title</span>
              <input className="plan-input" required value={newSession.SessionTitle} onChange={e => setNewSession({...newSession, SessionTitle: e.target.value})} placeholder="e.g. Bid Opening for NIS HQ Office Equipment" />
            </label>
            <label className="plan-field">
              <span>Scheduled Date & Time</span>
              <input type="datetime-local" className="plan-input" required value={newSession.ScheduledAt} onChange={e => setNewSession({...newSession, ScheduledAt: e.target.value})} />
            </label>
            <label className="plan-field">
              <span>Location / Venue</span>
              <input className="plan-input" value={newSession.Location} onChange={e => setNewSession({...newSession, Location: e.target.value})} placeholder="e.g. Conference Room A or Online Link" />
            </label>
          </div>
          <label className="plan-field">
            <span>Special Instructions / Notes</span>
            <textarea className="plan-input" rows={3} value={newSession.Notes} onChange={e => setNewSession({...newSession, Notes: e.target.value})} />
          </label>
          <div className="portal-form-actions">
            <button type="submit" className="plan-button" disabled={loading}>Schedule Session</button>
          </div>
        </form>
      )}

      {view === 'control' && selectedSession && (
        <div className="session-control-view">
          <div className="plan-summary-card">
            <div className="session-countdown" style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Statutory Opening Countdown</div>
              <h1 style={{ margin: '8px 0', fontSize: '4rem', fontFamily: 'monospace', color: isTimeForOpening ? '#059669' : '#1e293b' }}>
                {isTimeForOpening ? 'READY TO OPEN' : getCountdown()}
              </h1>
              <p style={{ fontWeight: 500 }}>Scheduled for: {new Date(selectedSession.ScheduledAt).toLocaleString()}</p>
              <div style={{ color: '#64748b' }}>Current System Time: {now.toLocaleTimeString()}</div>
            </div>

            <div className="portal-module-grid">
              <article className="portal-module-card">
                <h3>Opening Rule</h3>
                <p>PPA Section 27: Bids must be opened immediately following the deadline for submission.</p>
              </article>
              <article className="portal-module-card">
                <h3>Current Status</h3>
                <p>{selectedSession.Status}</p>
                {selectedSession.OpenedAt && <small>Opened: {new Date(selectedSession.OpenedAt).toLocaleString()}</small>}
              </article>
            </div>
          </div>

          <div className="session-actions" style={{ marginTop: '32px', display: 'flex', gap: '16px', justifyContent: 'center' }}>
            {selectedSession.Status === 'Scheduled' && (
              <button 
                className={`plan-button ${isTimeForOpening ? '' : 'plan-button--secondary'}`}
                style={{ padding: '20px 40px', fontSize: '1.2rem', cursor: isTimeForOpening ? 'pointer' : 'not-allowed', minWidth: '300px' }}
                disabled={!isTimeForOpening || loading}
                onClick={() => handleUpdateStatus('Open')}
              >
                {isTimeForOpening ? '🔓 UNLOCK & OPEN BIDS' : `⏳ Waiting (${getCountdown()})`}
              </button>
            )}

            {selectedSession.Status === 'Open' && (
              <button 
                className="plan-button plan-button--danger" 
                style={{ padding: '20px 40px', fontSize: '1.2rem' }}
                disabled={loading}
                onClick={() => handleUpdateStatus('Closed')}
              >
                🏁 CLOSE SESSION & SIGN RECORD
              </button>
            )}

            {selectedSession.Status === 'Closed' && (
              <div className="portal-alert portal-alert--success" style={{ width: '100%' }}>
                <h3>Session Completed</h3>
                <p>All bids for this tender have been officially opened and timestamped. The Bid Opening Record is now available for public display and evaluation.</p>
                <button className="plan-button plan-button--secondary" style={{ marginTop: '16px' }} disabled title="Coming soon">Download Bid Opening Record (PDF)</button>
              </div>
            )}
          </div>
          
          {!isTimeForOpening && selectedSession.Status === 'Scheduled' && (
            <div className="portal-alert" style={{ marginTop: '24px' }}>
              <strong>Security Lock:</strong> PPA compliance requires that the &quot;Open Bids&quot; action remains locked until the scheduled closing time.
            </div>
          )}
        </div>
      )}
    </section>
  );
};
