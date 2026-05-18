import path from "path";
import os from "os";

const home = os.homedir();

export const BRIEFING_DIR = path.join(home, "morning-brief");
export const TOKEN_DIR = path.join(home, ".claude");
export const REPO_DIR = path.resolve(process.cwd(), "..");
