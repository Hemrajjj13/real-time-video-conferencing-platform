import axios from "axios";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import environment from "../environment";

const AuthContext = createContext(null);

const STORAGE_TOKEN_KEY = "zoom_clone_token";
const STORAGE_USER_KEY = "zoom_clone_user";
const STORAGE_HISTORY_KEY = "zoom_clone_history";

const api = axios.create({
  baseURL: `${environment}/api/v1/users`,
  timeout: 10000,
});

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(STORAGE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readStoredHistory = () => {
  try {
    const raw = localStorage.getItem(STORAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const normalizeError = (error, fallbackMessage) =>
  error?.response?.data?.message || error?.message || fallbackMessage;

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_TOKEN_KEY) || "");
  const [user, setUser] = useState(() => readStoredUser());
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_USER_KEY);
    }
  }, [user]);

  const register = useCallback(async ({ name, username, password }) => {
    setAuthLoading(true);
    try {
      const response = await api.post("/register", { name, username, password });
      return response.data?.message || "User registered successfully.";
    } catch (error) {
      throw new Error(normalizeError(error, "Unable to register."));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const login = useCallback(async ({ username, password }) => {
    setAuthLoading(true);
    try {
      const response = await api.post("/login", { username, password });
      setToken(response.data?.token || "");
      setUser(
        response.data?.user || {
          username,
          name: username,
        },
      );
      return response.data;
    } catch (error) {
      throw new Error(normalizeError(error, "Unable to login."));
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken("");
    setUser(null);
  }, []);

  const getHistory = useCallback(async () => {
    const localHistory = readStoredHistory();

    if (!token) {
      return localHistory;
    }

    try {
      const response = await api.get("/get_all_activity", {
        params: { token },
      });

      const remoteHistory = Array.isArray(response.data)
        ? response.data.map((item) => ({
            ...item,
            meetingCode: item.meetingCode || item.mettingCode || "",
          }))
        : [];

      const mergedHistory = [...remoteHistory];
      const knownKeys = new Set(
        remoteHistory.map((item) => `${item.meetingCode}-${item.date}`),
      );

      localHistory.forEach((item) => {
        const key = `${item.meetingCode}-${item.date}`;
        if (!knownKeys.has(key)) {
          mergedHistory.push(item);
        }
      });

      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(mergedHistory));
      return mergedHistory;
    } catch (error) {
      if (localHistory.length > 0) {
        return localHistory;
      }

      throw new Error(normalizeError(error, "Unable to load meeting history."));
    }
  }, [token]);

  const addToHistory = useCallback(async (meetingCode) => {
    if (!meetingCode) {
      return null;
    }

    const historyEntry = {
      _id: `local-${meetingCode}-${Date.now()}`,
      meetingCode,
      date: new Date().toISOString(),
    };

    const currentLocalHistory = readStoredHistory();
    const nextLocalHistory = [
      historyEntry,
      ...currentLocalHistory.filter((item) => item.meetingCode !== meetingCode),
    ].slice(0, 50);

    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(nextLocalHistory));

    if (!token) {
      return historyEntry;
    }

    try {
      const response = await api.post("/add_to_activity", {
        token,
        meeting_code: meetingCode,
      });
      return response.data;
    } catch (error) {
      return historyEntry;
    }
  }, [token]);

  const value = useMemo(
    () => ({
      api,
      token,
      user,
      authLoading,
      isAuthenticated: Boolean(token),
      register,
      login,
      logout,
      getHistory,
      addToHistory,
    }),
    [token, user, authLoading, register, login, logout, getHistory, addToHistory],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
