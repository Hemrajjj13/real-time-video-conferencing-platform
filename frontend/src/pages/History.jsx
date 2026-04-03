import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const HistoryPage = () => {
  const { getHistory } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const data = await getHistory();
        if (mounted) {
          setHistory(data.slice().reverse());
        }
      } catch (historyError) {
        if (mounted) {
          setError(historyError.message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [getHistory]);

  return (
    <div className="app-shell history-shell">
      <header className="topbar">
        <Link className="brand" to="/home">
          SyncSpace
        </Link>
        <div className="topbar-links">
          <Link className="ghost-button" to="/home">
            Back home
          </Link>
        </div>
      </header>

      <section className="history-page-header">
        <span className="eyebrow">Meeting history</span>
        <h1>Rooms you have joined</h1>
        <p>Each saved code can be reused to re-enter the same meeting room.</p>
      </section>

      {loading ? <p className="status-banner">Loading history...</p> : null}
      {error ? <p className="status-banner error-banner">{error}</p> : null}

      <section className="history-grid">
        {!loading && history.length === 0 ? (
          <article className="dashboard-card">
            <h2>No history yet</h2>
            <p>Your meeting activity will show up here after you join a room.</p>
          </article>
        ) : null}

        {history.map((item) => (
          <article className="dashboard-card" key={item._id || `${item.meetingCode}-${item.date}`}>
            <span className="eyebrow">Room code</span>
            <h2>{item.meetingCode}</h2>
            <p>{new Date(item.date).toLocaleString()}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

export default HistoryPage;
