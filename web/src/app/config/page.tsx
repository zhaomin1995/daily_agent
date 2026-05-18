import ConfigPanel from "@/components/ConfigPanel";

export default function ConfigPage() {
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
      <p className="text-sm text-zinc-500 mt-1 mb-8">
        Manage email accounts and tokens.
      </p>
      <ConfigPanel />
    </div>
  );
}
