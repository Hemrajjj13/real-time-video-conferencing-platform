import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const defaultForm = {
  name: "",
  username: "",
  password: "",
};

const Authentication = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, register, authLoading, isAuthenticated } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(defaultForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setMode(params.get("mode") === "signup" ? "signup" : "login");
  }, [location.search]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/home", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const validate = () => {
    if (mode === "signup" && form.name.trim().length < 2) {
      return "Please enter your full name.";
    }

    if (form.username.trim().length < 3) {
      return "Username must be at least 3 characters.";
    }

    if (form.password.length < 6) {
      return "Password must be at least 6 characters.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      if (mode === "signup") {
        const message = await register({
          name: form.name.trim(),
          username: form.username.trim(),
          password: form.password,
        });

        setSuccess(message);
        setMode("login");
        setForm((previous) => ({ ...previous, password: "" }));
        navigate("/auth", { replace: true });
      } else {
        await login({
          username: form.username.trim(),
          password: form.password,
        });
        navigate("/home", { replace: true });
      }
    } catch (submissionError) {
      setError(submissionError.message);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <Link className="brand brand-inline" to="/">
          SyncSpace
        </Link>
        <p className="eyebrow">Account access</p>
        <h1>{mode === "login" ? "Welcome back" : "Create an account"}</h1>
        <p className="auth-copy">
          Sign in to manage rooms, save history, and jump into meetings quickly.
        </p>

        <div className="segmented-control">
          <button
            className={mode === "login" ? "segment active" : "segment"}
            onClick={() => setMode("login")}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === "signup" ? "segment active" : "segment"}
            onClick={() => setMode("signup")}
            type="button"
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <label>
              Full name
              <input
                autoComplete="name"
                name="name"
                onChange={updateField}
                placeholder="Aman Gupta"
                value={form.name}
              />
            </label>
          ) : null}

          <label>
            Username
            <input
              autoComplete="username"
              name="username"
              onChange={updateField}
              placeholder="aman123"
              value={form.username}
            />
          </label>

          <label>
            Password
            <input
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              name="password"
              onChange={updateField}
              placeholder="Minimum 6 characters"
              type="password"
              value={form.password}
            />
          </label>

          {error ? <p className="form-message error">{error}</p> : null}
          {success ? <p className="form-message success">{success}</p> : null}

          <button className="primary-button wide-button" disabled={authLoading} type="submit">
            {authLoading
              ? "Please wait..."
              : mode === "login"
                ? "Login"
                : "Create account"}
          </button>
        </form>
      </div>

      <aside className="auth-side-panel">
        <div className="glass-card">
          <div>
            <p className="preview-label">Inside the app</p>
            <ul className="plain-list">
              <li>Create a meeting in one click.</li>
              <li>Join from history without retyping codes.</li>
              <li>Use live chat even if camera access is blocked.</li>
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default Authentication;
