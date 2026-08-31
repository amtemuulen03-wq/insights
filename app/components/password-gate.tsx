"use client";

import { useState } from "react";
import type { FormEvent } from "react";

function applicationBase() {
  if (typeof window === "undefined") return "/insights";

  return window.location.pathname === "/insights" ||
    window.location.pathname.startsWith("/insights/")
    ? "/insights"
    : "";
}

export default function PasswordGate({
  children,
  initialAuthenticated,
}: {
  children: React.ReactNode;
  initialAuthenticated: boolean;
}) {
  const [authenticated, setAuthenticated] = useState(initialAuthenticated);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`${applicationBase()}/api/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        setMessage(payload.message ?? "Unable to sign in.");
        return;
      }

      setPassword("");
      setAuthenticated(true);
      window.location.reload();
    } catch {
      setMessage("Authentication service is unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  if (authenticated) return children;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0F172A] px-5 py-10">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#829BEA]">
          Marketing Insight
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
          Sign in
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enter the dashboard password to continue.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-950 outline-none transition focus:border-[#829BEA] focus:ring-4 focus:ring-[#829BEA]/15"
            />
          </label>

          {message && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#829BEA] text-sm font-bold text-white transition hover:bg-[#718bdc] disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
