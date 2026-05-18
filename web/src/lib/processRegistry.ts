// In-memory registry of running tool processes, keyed by tool ID.
// Used to cancel a running tool from the client via the DELETE endpoint.

import type { ChildProcess } from "child_process";

const running = new Map<string, ChildProcess>();

export function register(toolId: string, proc: ChildProcess) {
  running.set(toolId, proc);
}

export function unregister(toolId: string) {
  running.delete(toolId);
}

export function kill(toolId: string): boolean {
  const proc = running.get(toolId);
  if (proc) {
    proc.kill("SIGTERM");
    running.delete(toolId);
    return true;
  }
  return false;
}

export function isRunning(toolId: string): boolean {
  return running.has(toolId);
}
