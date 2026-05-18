import LogViewer from "@/components/LogViewer";

export default function LogsPage() {
  return (
    <div className="p-4 sm:p-8 h-full">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Logs</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-6 sm:mb-8">
        Past morning briefings.
      </p>
      <LogViewer />
    </div>
  );
}
