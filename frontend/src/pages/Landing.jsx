import { Link } from "react-router-dom";

const featureCards = [
  {
    title: "Quick auth flow",
    text: "Sign up, sign in, and keep your room history attached to your account.",
  },
  {
    title: "Live room experience",
    text: "Create or join meetings with video, audio, live chat, and participant tracking.",
  },
  {
    title: "Useful AI helper",
    text: "Generate a simple meeting title, agenda, and discussion prompts without needing a paid API.",
  },
];

const LandingPage = () => {
  return (
    <div className="app-shell landing-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          SyncSpace
        </Link>

        <nav className="topbar-links">
          <Link className="ghost-button" to="/auth">
            Login
          </Link>
          <Link className="primary-button" to="/auth?mode=signup">
            Create account
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Built for practical team meetings</span>
          <h1>Video meetings that stay simple, responsive, and reliable.</h1>
          <p>
            This frontend is rebuilt around your backend routes so login, signup,
            meeting history, room chat, and multi-user joining work together cleanly.
          </p>

          <div className="hero-actions">
            <Link className="primary-button" to="/auth">
              Start now
            </Link>
            <Link className="ghost-button" to="/auth?mode=signup">
              Create your first account
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="preview-card">
            <p className="preview-label">Responsive room layout</p>
            <div className="preview-grid">
              <div className="preview-tile large" />
              <div className="preview-tile" />
              <div className="preview-tile" />
              <div className="preview-chat" />
            </div>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        {featureCards.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
};

export default LandingPage;
