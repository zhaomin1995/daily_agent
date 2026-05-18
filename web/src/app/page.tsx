"use client";

import { useEffect, useState } from "react";
import ToolCard from "@/components/ToolCard";

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  status: "ready" | "needs-setup";
}

export default function Dashboard() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tools")
      .then((r) => r.json())
      .then((data) => {
        setTools(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-6 sm:mb-8">
        All automation tools in one place.
      </p>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading tools...</p>
      ) : (
        <div className="space-y-4">
          {tools.map((tool) => (
            <ToolCard key={tool.id} {...tool} />
          ))}
        </div>
      )}
    </div>
  );
}
