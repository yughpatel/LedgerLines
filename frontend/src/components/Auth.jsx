import { useState } from "react";
import { login, signup } from "../api";
import { AlertIcon, BrandMark, CheckIcon, DotIcon } from "./icons";

// Mirrors UserCreate in app/schemas/user.py: signup only. Login has no complexity
// rule, so applying these there would lock out existing accounts.
// Browsers accept "a@b" for type="email", but the backend's EmailStr wants a
// dotted domain; checking here turns a 422 round-trip into an instant message.
function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const PASSWORD_MAX_LENGTH = 20;
const PASSWORD_RULES = [
  { label: "8 to 20 characters", test: (v) => v.length >= 8 && v.length <= PASSWORD_MAX_LENGTH },
  { label: "One capital letter", test: (v) => /[A-Z]/.test(v) },
  { label: "One number", test: (v) => /\d/.test(v) },
  // The accepted set is narrow and non-obvious, so it's spelled out
  { label: 'One symbol from  ! @ # $ % ^ & * ( ) , . ? " : { } | < >', test: (v) => /[!@#$%^&*(),.?":{}|<>]/.test(v) },
];

// The left half on wide screens: a daybook page, Date / Particulars / ₹
function DaybookArt() {
  const rows = [["1 Nov", "By salary", "85,000.00"], ["2 Nov", "To groceries", "1,860.00"], ["3 Nov", "To flat rent", "22,000.00"], ["3 Nov", "To gas cylinder", "1,249.00"]];
  const ruled = "grid h-10 grid-cols-[70px_1fr_130px] items-end pb-2 [&>*]:px-3";
  return (
    <div aria-hidden="true" className="w-full max-w-lg">
      <div className="border border-l-[6px] border-line border-l-brand bg-canvas bg-[repeating-linear-gradient(to_bottom,transparent_0_39px,var(--color-line)_39px_40px)] font-serif">
        <div className={ruled}>
          <span className="-mb-2 flex h-10 items-end border-r-2 border-margin pb-2 font-sans text-xs font-semibold tracking-wide text-muted">Date</span>
          <span className="font-sans text-xs font-semibold tracking-wide text-muted">Particulars</span>
          <span className="text-right font-sans text-xs font-semibold text-muted">₹</span>
        </div>
        {rows.map(([d, p, a]) => (
          <div key={p} className={ruled}>
            <span className="-mb-2 flex h-10 items-end border-r-2 border-margin pb-2 text-[15px] text-muted">{d}</span>
            <span className="text-lg italic">{p}</span>
            <span className="text-right font-mono text-[15px]">{a}</span>
          </div>
        ))}
        <div className={ruled}><span className="-mb-2 h-10 border-r-2 border-margin" /><span /><span /></div>
        <div className={ruled}>
          <span className="-mb-2 h-10 border-r-2 border-margin" />
          <span className="text-lg italic">Left over</span>
          <span className="justify-self-end border-b-4 border-double border-brand-ink pb-0.5 text-right font-mono text-[15px] font-semibold text-brand-ink">59,891.00</span>
        </div>
        <div className={ruled}><span className="-mb-2 h-10 border-r-2 border-margin" /><span /><span /></div>
      </div>
      <p className="mt-5 max-w-[24ch] font-serif text-[26px] leading-tight">Every rupee in the daybook, written down by day.</p>
    </div>
  );
}

function Field({ id, label, children }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "h-11 w-full rounded-control border border-field bg-surface px-3 placeholder:text-muted";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";

  function switchMode(next) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  }

  function fail(message) {
    setError(message);
    setErrorKey((k) => k + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email || !password) return fail("Enter your email and password.");
    if (!looksLikeEmail(email)) return fail("Enter a valid email address, like you@example.com.");
    if (isSignup) {
      // The checklist below the field already shows which rules are unmet
      if (PASSWORD_RULES.some((rule) => !rule.test(password))) return fail("The password doesn't meet every rule below yet.");
      if (password !== confirm) return fail("The two passwords don't match.");
    }

    setBusy(true);
    try {
      if (isSignup) {
        await signup(email, password);
      }
      const { access_token } = await login(email, password);
      localStorage.setItem("ll_token", access_token);
      onLogin(access_token);
    } catch (err) {
      fail(err.message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh grid-cols-1 min-[900px]:grid-cols-[1.1fr_1fr]">
      <aside className="hidden items-center justify-center border-r border-line bg-surface p-12 min-[900px]:flex">
        <DaybookArt />
      </aside>

      <main className="flex flex-col justify-center px-4 py-8 sm:px-6">
        <div key={mode} className="mx-auto grid w-full max-w-[400px] animate-fade-up gap-5">
          <span className="flex items-center gap-2.5 font-serif text-[22px] font-semibold"><BrandMark /> LedgerLines</span>
          <div>
            <h1 className="text-[28px]">{isSignup ? "Create your account" : "Welcome back"}</h1>
            <p className="mt-1 text-muted">{isSignup ? "Track what comes in and what goes out." : "Sign in to see your month."}</p>
          </div>

          {error && (
            <div key={errorKey} role="alert" className="flex animate-shake items-start gap-2 rounded-control bg-danger-soft px-3 py-2.5 text-sm font-semibold text-danger-text">
              <AlertIcon size={18} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="grid gap-4">
            <Field id="auth-email" label="Email">
              <input
                id="auth-email" type="email" autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={inputClass}
              />
            </Field>

            <Field id="auth-password" label="Password">
              <div className="relative">
                <input
                  id="auth-password" type={showPassword ? "text" : "password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={isSignup ? "auth-rules" : undefined}
                  className={`${inputClass} pr-20`}
                />
                <button
                  type="button" aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1 top-1/2 h-9 -translate-y-1/2 rounded-[6px] px-3 text-sm font-semibold hover:bg-surface-2"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {isSignup && (
                <ul id="auth-rules" className="mt-1 grid gap-1 text-[13px]">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(password);
                    return (
                      <li key={rule.label} className={`flex items-center gap-1.5 transition-colors ${met ? "text-income" : "text-muted"}`}>
                        {met ? <CheckIcon size={16} /> : <DotIcon size={16} />}
                        <span>{rule.label}</span>
                        <span className="sr-only">{met ? ", done" : ", not yet"}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Field>

            {isSignup && (
              <Field id="auth-confirm" label="Confirm password">
                <input
                  id="auth-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass}
                />
              </Field>
            )}

            <button
              type="submit" disabled={busy}
              className="h-11 w-full rounded-control bg-brand font-semibold text-on-brand transition-[background-color,transform] hover:bg-brand-hover active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-muted">
            {isSignup ? "Have an account?" : "New here?"}{" "}
            <button
              type="button" onClick={() => switchMode(isSignup ? "login" : "signup")}
              className="min-h-11 px-1 font-semibold text-brand-ink underline underline-offset-4"
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
