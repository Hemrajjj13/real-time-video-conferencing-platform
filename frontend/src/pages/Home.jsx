import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const createMeetingCode = () =>
  `room-${Math.random().toString(36).slice(2, 6)}-${Date.now().toString().slice(-4)}`;

const RECENT_ROOM_WINDOW_MS = 15 * 60 * 1000;

const HomePage = () => {
  const navigate = useNavigate();
  const { user, logout, getHistory } = useAuth();
  const [meetingCode, setMeetingCode] = useState("");
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async () => {
      try {
        const data = await getHistory();
        if (mounted) {
          const recentHistory = data
            .filter((item) => {
              const timestamp = new Date(item.date).getTime();
              return Number.isFinite(timestamp) && Date.now() - timestamp <= RECENT_ROOM_WINDOW_MS;
            })
            .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime())
            .slice(0, 3);

          setHistory(recentHistory);
        }
      } catch {
        if (mounted) {
          setHistory([]);
        }
      } finally {
        if (mounted) {
          setLoadingHistory(false);
        }
      }
    };

    loadHistory();

    return () => {
      mounted = false;
    };
  }, [getHistory]);

  const goToRoom = (code) => {
    const trimmedCode = code.trim().toLowerCase().replace(/\s+/g, "-");
    if (!trimmedCode) {
      return;
    }

    navigate(`/meeting/${trimmedCode}`);
  };

  return (
    <div className="app-shell dashboard-shell">
      <header className="topbar">
        <Link className="brand" to="/home">
          SyncSpace
        </Link>

        <div className="topbar-links">
          <Link className="ghost-button" to="/history">
            History
          </Link>
          <button className="ghost-button" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </header>

      <section className="dashboard-grid">
        <article className="dashboard-card accent-card">
          <span className="eyebrow">Welcome</span>
          <h1>{user?.name || user?.username || "User"}</h1>
          <p>
            Create a new room or enter an existing meeting code. The room page will
            save the code into your history automatically after you join.
          </p>

          <div className="room-actions">
            <label className="field-block">
              Meeting code
              <input
                onChange={(event) => setMeetingCode(event.target.value)}
                placeholder="team-standup"
                value={meetingCode}
              />
            </label>

            <div className="inline-actions">
              <button className="primary-button" onClick={() => goToRoom(meetingCode)} type="button">
                Join meeting
              </button>
              <button
                className="ghost-button"
                onClick={() => {
                  const code = createMeetingCode();
                  setMeetingCode(code);
                  goToRoom(code);
                }}
                type="button"
              >
                Create instant room
              </button>
            </div>
          </div>
        </article>

        <article className="dashboard-card">
          <span className="eyebrow">Quick guide</span>
          <h2>How meetings work</h2>
          <ul className="plain-list">
            <li>Create a room or enter a room code, then join with your display name.</li>
            <li>Use camera, mic, chat, and screen share controls inside the meeting.</li>
            <li>Recent rooms appear on the home page for a short time after you join.</li>
            <li>If camera access is unavailable, your avatar tile is shown instead.</li>
          </ul>
        </article>

        <article className="dashboard-card">
          <h2>Recent rooms</h2>
          {loadingHistory ? <p>Loading recent meetings...</p> : null}
          {!loadingHistory && history.length === 0 ? (
            <p>No recent rooms in the last 15 minutes.</p>
          ) : null}
          <div className="history-list">
            {history.map((item) => (
              <div
                className="history-item"
                key={item._id || `${item.meetingCode}-${item.date}`}
              >
                <div className="history-item-copy">
                  <strong>{item.meetingCode}</strong>
                  <span>{new Date(item.date).toLocaleString()}</span>
                </div>
                <button
                  className="primary-button history-join-button"
                  onClick={() => goToRoom(item.meetingCode)}
                  type="button"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="about-strip">
        <div className="about-card">
          <span className="eyebrow">About</span>
          <h2>Simple meetings for small teams</h2>
          <p>
            SyncSpace is a lightweight meeting app for quick video rooms, live chat,
            recent room history, and everyday collaboration without extra clutter.
          </p>
        </div>

        <div className="copyright-note">
          <p>© 2026 SyncSpace. Built for collaboration and learning.</p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
