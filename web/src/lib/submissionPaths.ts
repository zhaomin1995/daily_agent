import path from "path";

const repoDir = path.resolve(process.cwd(), "..");

export const COAUTHORS_FILE = path.join(repoDir, "coauthors.yaml");
export const SUBMISSIONS_DIR = path.join(repoDir, "submissions");
