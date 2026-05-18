import LogViewer from "@/components/LogViewer";

export default function LogsPage() {
  return (
    <div className="p-8 h-full">
      <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-8">
        Past morning briefings.
      </p>
      <LogViewer />
    </div>
  );
}
