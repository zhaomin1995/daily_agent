import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { SUBMISSIONS_DIR } from "@/lib/submissionPaths";

export const dynamic = "force-dynamic";

function ensureDir() {
  if (!fs.existsSync(SUBMISSIONS_DIR)) {
    fs.mkdirSync(SUBMISSIONS_DIR, { recursive: true });
  }
}

export async function GET() {
  ensureDir();
  const files = fs.readdirSync(SUBMISSIONS_DIR).filter((f) => f.endsWith(".yaml"));
  const submissions = files.map((f) => {
    const content = fs.readFileSync(path.join(SUBMISSIONS_DIR, f), "utf-8");
    return yaml.load(content);
  });
  return Response.json(submissions);
}

export async function POST(request: Request) {
  ensureDir();
  const body = await request.json();
  const kind = body.submission_kind === "abstract" ? "abstract" : "manuscript";
  const id = body.id || `${kind}-${Date.now()}`;
  const filePath = path.join(SUBMISSIONS_DIR, `${id}.yaml`);

  const defaultManuscript = {
    id,
    submission_kind: "manuscript",
    project_label: body.project_label || "",
    title: body.title || "Untitled Manuscript",
    journal: body.journal || "",
    journal_abbrev: "",
    submission_type: "original",
    status: "draft",
    submitted_date: null,
    decision_date: null,
    next_action: "Prepare submission package",
    next_action_due: null,
    manuscript_file: "",
    cover_letter_file: "",
    authors: body.authors || [],
    keywords: [],
    word_count: null,
    abstract_word_count: null,
    journal_requirements: {
      max_words: null,
      max_abstract_words: null,
      max_figures: null,
      max_tables: null,
      max_references: null,
      reference_style: "",
      required_sections: [],
      checklist_type: null,
    },
    suggested_reviewers: [],
    excluded_reviewers: [],
    notes: "",
  };

  const defaultAbstract = {
    id,
    submission_kind: "abstract",
    project_label: body.project_label || "",
    title: body.title || "Untitled Abstract",
    conference: "",
    conference_abbrev: "",
    presentation_type: "poster",
    status: "draft",
    deadline: null,
    submitted_date: null,
    decision_date: null,
    word_count: null,
    word_limit: null,
    authors: body.authors || [],
    notes: "",
  };

  const defaults = kind === "abstract" ? defaultAbstract : defaultManuscript;
  fs.writeFileSync(filePath, yaml.dump({ ...defaults, ...body, id, submission_kind: kind }));
  return Response.json({ ok: true, id });
}
