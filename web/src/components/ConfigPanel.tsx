"use client";

import { useEffect, useState } from "react";
import { usePreferences, ACCENTS } from "./PreferencesProvider";

interface AccountStatus {
  name: string;
  tokenFile: string;
  hasToken: boolean;
}

interface Config {
  accounts: AccountStatus[];
  briefingDirExists: boolean;
  briefingCount: number;
}

// Theme picker — independent of the config fetch, so it renders immediately
// (even while account config is still loading or unavailable).
function AppearanceCard() {
  const { accent, fontSize, highContrast, setAccent, setFontSize, setHighContrast } = usePreferences();
  return (
    <section>
      <h2 className="text-base font-semibold mb-4">Appearance</h2>
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 bg-white dark:bg-zinc-900 space-y-5">
        {/* Accent swatches */}
        <div>
          <p className="text-sm font-medium mb-2">Accent</p>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccent(a.id)}
                title={a.label}
                aria-label={a.label}
                aria-pressed={accent === a.id}
                className={`w-8 h-8 rounded-full transition-transform hover:scale-110 ${
                  accent === a.id
                    ? "ring-2 ring-offset-2 ring-accent ring-offset-white dark:ring-offset-zinc-900 scale-110"
                    : ""
                }`}
                style={{ backgroundImage: `linear-gradient(135deg, rgb(${a.from}), rgb(${a.to}))` }}
              />
            ))}
          </div>
        </div>

        {/* Text size */}
        <div>
          <p className="text-sm font-medium mb-2">Text size</p>
          <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            {([
              { id: "sm", label: "Small" },
              { id: "base", label: "Default" },
              { id: "lg", label: "Large" },
            ] as const).map((s) => (
              <button
                key={s.id}
                onClick={() => setFontSize(s.id)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  fontSize === s.id
                    ? "bg-accent text-white"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* High contrast toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">High contrast</p>
            <p className="text-xs text-zinc-500">Flatten colors and gradients for maximum legibility.</p>
          </div>
          <button
            role="switch"
            aria-checked={highContrast}
            aria-label="High contrast"
            onClick={() => setHighContrast(!highContrast)}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
              highContrast ? "bg-accent" : "bg-zinc-300 dark:bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                highContrast ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function ConfigPanel() {
  const [config, setConfig] = useState<Config | null>(null);
  const [tokenInput, setTokenInput] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    const res = await fetch("/api/config");
    setConfig(await res.json());
  }

  async function saveToken(account: string) {
    const token = tokenInput[account];
    if (!token?.trim()) return;

    setSaving(account);
    setMessage(null);

    const res = await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, token }),
    });

    if (res.ok) {
      setMessage(`Token saved for ${account}`);
      setTokenInput((prev) => ({ ...prev, [account]: "" }));
      await fetchConfig();
    } else {
      setMessage("Failed to save token");
    }

    setSaving(null);
  }

  if (!config) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <AppearanceCard />
        <p className="text-sm text-zinc-500">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <AppearanceCard />

      {/* Email account tokens */}
      <section>
        <h2 className="text-base font-semibold mb-4">Email Accounts</h2>
        <div className="space-y-4">
          {config.accounts.map((account) => (
            <div
              key={account.name}
              className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 bg-white dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <h3 className="font-medium">{account.name}</h3>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      account.hasToken
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {account.hasToken ? "Token Set" : "No Token"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                Token file: <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px] break-all">{account.tokenFile}</code>
              </p>
              {/* Token input: stacks vertically on mobile */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  placeholder="Paste access token..."
                  value={tokenInput[account.name.toLowerCase()] || ""}
                  onChange={(e) =>
                    setTokenInput((prev) => ({
                      ...prev,
                      [account.name.toLowerCase()]: e.target.value,
                    }))
                  }
                  className="flex-1 px-3 py-2.5 sm:py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
                <button
                  onClick={() => saveToken(account.name.toLowerCase())}
                  disabled={saving === account.name.toLowerCase()}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
                >
                  {saving === account.name.toLowerCase() ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ))}
        </div>
        {message && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3">{message}</p>
        )}
      </section>

      {/* Storage stats */}
      <section>
        <h2 className="text-base font-semibold mb-4">Storage</h2>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 bg-white dark:bg-zinc-900">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-zinc-500">Briefing directory</dt>
              <dd className="font-medium mt-0.5">
                {config.briefingDirExists ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Exists</span>
                ) : (
                  <span className="text-zinc-400">Not created yet</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Total briefings</dt>
              <dd className="font-medium mt-0.5">{config.briefingCount}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Setup instructions */}
      <section>
        <h2 className="text-base font-semibold mb-4">Setup Guide</h2>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 sm:p-5 bg-white dark:bg-zinc-900 text-sm text-zinc-600 dark:text-zinc-400 space-y-2 leading-relaxed">
          <p>1. Register an app at <strong>portal.azure.com</strong> &rarr; App registrations</p>
          <p>2. Add <strong>Mail.Read</strong> and <strong>Mail.ReadWrite</strong> delegated permissions</p>
          <p>3. Create a client secret and use the device code flow to get an access token</p>
          <p>4. Paste the access token above for each account</p>
        </div>
      </section>
    </div>
  );
}
