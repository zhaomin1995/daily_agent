"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface EmailDetail {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  receivedAt: string;
  account: string;
  priority: string;
  isPromotional: boolean;
  isWithinOrg: boolean;
  bodySummary: string;
  draftReply: string | null;
}

export default function EmailDetailPage() {
  const params = useParams();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/email/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Email not found");
        return r.json();
      })
      .then(setEmail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
          <div className="h-4 w-64 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
          <div className="h-40 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="p-4 sm:p-8 max-w-3xl text-center py-20">
        <p className="text-zinc-500 text-sm">{error || "Email not found"}</p>
        <Link href="/" className="text-sm text-accent font-medium hover:underline mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    "action-needed": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    fyi: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 mb-4 inline-flex items-center gap-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        Back
      </Link>

      {/* Email header */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900 mt-2">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColors[email.priority] || "bg-zinc-100 text-zinc-600"}`}>
            {email.priority.replace("-", " ")}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {email.account}
          </span>
          {email.isWithinOrg && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Within org
            </span>
          )}
          {email.isPromotional && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500">
              Promotional
            </span>
          )}
        </div>

        <h1 className="text-lg font-semibold">{email.subject}</h1>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 mt-2 text-sm text-zinc-500">
          <span>From: <strong className="text-zinc-700 dark:text-zinc-300">{email.fromName || email.from}</strong></span>
          <span className="text-xs">{email.from}</span>
        </div>

        <p className="text-xs text-zinc-400 mt-1">
          {new Date(email.receivedAt).toLocaleString()}
        </p>
      </div>

      {/* Email body */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900 mt-4">
        <h2 className="text-sm font-semibold mb-3">Body</h2>
        <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
          {email.bodySummary || "No body content available."}
        </div>
      </div>

      {/* Priority reasoning */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900 mt-4">
        <h2 className="text-sm font-semibold mb-3">Triage Reasoning</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-400 text-xs">Priority</dt>
            <dd className="font-medium capitalize">{email.priority.replace("-", " ")}</dd>
          </div>
          <div>
            <dt className="text-zinc-400 text-xs">Classification</dt>
            <dd className="font-medium">{email.isWithinOrg ? "Within org" : "External"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400 text-xs">Promotional</dt>
            <dd className="font-medium">{email.isPromotional ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400 text-xs">Account</dt>
            <dd className="font-medium">{email.account}</dd>
          </div>
        </dl>
      </div>

      {/* Draft reply */}
      {email.draftReply && (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 bg-white dark:bg-zinc-900 mt-4">
          <h2 className="text-sm font-semibold mb-3">Draft Reply</h2>
          <div className="bg-zinc-50 dark:bg-zinc-950 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {email.draftReply}
          </div>
        </div>
      )}
    </div>
  );
}
