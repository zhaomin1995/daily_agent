"use client";

import { useEffect, useState } from "react";

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
    return <p className="text-sm text-zinc-500">Loading configuration...</p>;
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold mb-4">Email Accounts</h2>
        <div className="space-y-4">
          {config.accounts.map((account) => (
            <div
              key={account.name}
              className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
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
                Token file: <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{account.tokenFile}</code>
              </p>
              <div className="flex gap-2">
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
                  className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
                <button
                  onClick={() => saveToken(account.name.toLowerCase())}
                  disabled={saving === account.name.toLowerCase()}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 transition-colors"
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

      <section>
        <h2 className="text-base font-semibold mb-4">Storage</h2>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900">
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

      <section>
        <h2 className="text-base font-semibold mb-4">Setup Guide</h2>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900 text-sm text-zinc-600 dark:text-zinc-400 space-y-2 leading-relaxed">
          <p>1. Register an app at <strong>portal.azure.com</strong> &rarr; App registrations</p>
          <p>2. Add <strong>Mail.Read</strong> and <strong>Mail.ReadWrite</strong> delegated permissions</p>
          <p>3. Create a client secret and use the device code flow to get an access token</p>
          <p>4. Paste the access token above for each account</p>
        </div>
      </section>
    </div>
  );
}
