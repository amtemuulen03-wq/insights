/*"use client";

import {
  type FormEvent,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        "/insights/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        },
      );

      const result = (await response.json()) as {
        message?: string;
      };

      if (!response.ok) {
        setError(result.message ?? "Authentication failed.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to connect to the application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-stone-800 px-4">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <label className="block"> 
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              required
              autoComplete="current-password"
              autoFocus
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Enter password"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password}
            className="h-10 w-full rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Checking…" : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}*/
"use client";

import {
  type FormEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  function handleActivate() {
    setIsActive(true);
    setTimeout(() => inputRef.current?.focus(), 300);
  }

  function handleDeactivate() {
    setIsActive(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        "/insights/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        },
      );

      const result = (await response.json()) as {
        message?: string;
      };

      if (!response.ok) {
        setError(result.message ?? "Authentication failed.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to connect to the application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className="relative grid min-h-screen place-items-center overflow-hidden bg-white px-4"

    >
      {/* INSIGHTS title */}
      <div
      onMouseEnter={handleActivate}
      onMouseLeave={handleDeactivate}
      className={`flex items-center justify-center h-48`}
      >

      <h1
        aria-hidden={isActive}
        className={`absolute select-none text-5xl font-black tracking-[0.3em] text-black transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] sm:text-6xl ${
          isActive
            ? "scale-95 opacity-0 blur-md tracking-[1.2em]"
            : "scale-100 opacity-100 blur-0"
        }`}

      >
        INSIGHTS
      </h1>

      {/* Password panel */}
      <section
        className={`w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isActive
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-4 scale-95 opacity-0"
        }`}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              required
              autoComplete="current-password"
              tabIndex={isActive ? 0 : -1}
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-center text-base text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              placeholder="Enter password"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password}
            className="h-10 w-full rounded-xl bg-blue-600 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting ? "Checking…" : "Continue"}
          </button>
        </form>
      </section>
      </div>
    </main>
  );
}