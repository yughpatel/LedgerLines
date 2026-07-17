import { useState } from "react";
import Auth from "./components/Auth";
import TransactionList from "./components/TransactionList";
import "./App.css";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("ll_token"));

  function handleLogin(newToken) {
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem("ll_token");
    setToken(null);
  }

  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }
  return <TransactionList token={token} onLogout={handleLogout} />;
}
