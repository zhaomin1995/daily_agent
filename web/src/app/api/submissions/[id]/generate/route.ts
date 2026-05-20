import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { exec } from "child_process";
import { promisify } from "util";
import { SUBMISSIONS_DIR, COAUTHORS_FILE } from "@/lib/submissionPaths";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";

interface Coauthor {
  id: string;
  name: string;
  email: string;
  orcid: string;
  role: string;
  institution: string;
  department: string;
  contributions: string[];
}

interface ManuscriptAuthor {
  id: string;
  order: number;
  contributions: string[];
}

interface SuggestedReviewer {
  name: string;
  email: string;
  institution: string;
  reason: string;
}

interface Manuscript {
  id: string;
  title: string;
  journal: string;
  running_title?: string;
  funding?: string;
  irb_statement?: string;
  data_availability?: string;
  acknowledgments?: string;
  conflicts_of_interest?: string;
  word_count?: number;
  abstract_word_count?: number;
  keywords?: string[];
  authors: ManuscriptAuthor[];
  suggested_reviewers?: SuggestedReviewer[];
  excluded_reviewers?: string[];
  journal_requirements: { checklist_type: string | null };
  [key: string]: unknown;
}

function loadCoauthors(): Coauthor[] {
  if (!fs.existsSync(COAUTHORS_FILE)) return [];
  const data = yaml.load(fs.readFileSync(COAUTHORS_FILE, "utf-8")) as { coauthors: Coauthor[] };
  return data?.coauthors || [];
}

function loadManuscript(id: string): Manuscript | null {
  const fp = path.join(SUBMISSIONS_DIR, `${id}.yaml`);
  if (!fs.existsSync(fp)) return null;
  return yaml.load(fs.readFileSync(fp, "utf-8")) as Manuscript;
}

interface CoverLetterParams {
  editor_name?: string;
  editor_title?: string;
  article_type?: string;
  study_summary?: string;
  conflicts?: string;
  phone?: string;
  date?: string;
}

function generateCoverLetter(ms: Manuscript, coauthors: Coauthor[], params: CoverLetterParams = {}): string {
  const sorted = [...(ms.authors || [])].sort((a, b) => a.order - b.order);
  const corresponding = sorted
    .map((a) => coauthors.find((c) => c.id === a.id))
    .find((c) => c?.role === "corresponding");

  const corrName = corresponding?.name || "[Corresponding Author]";
  const corrCreds = (corresponding as unknown as Record<string,string>)?.credentials || "";
  const corrEmail = corresponding?.email || "[email]";
  const corrDept = corresponding?.department || "";
  const corrInstitution = corresponding?.institution || "";

  const date = params.date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const editorName = params.editor_name || "[Editor Name]";
  const editorTitle = params.editor_title || "Editor-in-Chief";
  const articleType = params.article_type || (ms as unknown as Record<string,string>).submission_type === "original" ? "an Original Investigation" : "a manuscript";
  const journal = ms.journal || "[Journal Name]";
  const title = ms.title || "[Manuscript Title]";
  const summary = params.study_summary || "[Please summarize the key findings and significance of this work.]";
  const conflicts = params.conflicts || "There are no conflicts of interest in this study.";
  const phone = params.phone || "";

  // Extract editor last name for salutation
  const editorLastName = editorName.replace(/^Dr\.?\s+/i, "").split(" ").pop() || editorName;

  const signatureLines = [
    `${corrName}${corrCreds ? `, ${corrCreds}` : ""} (corresponding author)`,
    corrDept,
    corrInstitution,
    `Email: ${corrEmail}`,
    phone ? `Phone: ${phone}` : "",
  ].filter(Boolean);

  return `${date}
${editorName}
${editorTitle}

Dear Dr. ${editorLastName},

Please kindly find enclosed a manuscript entitled: "${title}", which we are submitting for exclusive consideration of publication as ${articleType} in the ${journal}.

${summary}

This manuscript has not been published or accepted for publication elsewhere and is not currently under consideration for publication elsewhere. All the authors have seen and approved the mention of their names in the manuscript. All the authors have read the manuscript and have approved its submission to the ${journal}. ${conflicts}

We look forward to your review.

Yours sincerely,
${signatureLines.join("\n")}`;
}

function generateAuthorBlock(ms: Manuscript, coauthors: Coauthor[]): string {
  const orderedAuthors = [...ms.authors].sort((a, b) => a.order - b.order);
  const affiliations: string[] = [];
  const authorAffMap: Map<string, number[]> = new Map();

  for (const a of orderedAuthors) {
    const coauthor = coauthors.find((c) => c.id === a.id);
    if (!coauthor) continue;

    const affiliation = [coauthor.institution, coauthor.department].filter(Boolean).join(", ");
    let idx = affiliations.indexOf(affiliation);
    if (idx === -1) {
      affiliations.push(affiliation);
      idx = affiliations.length - 1;
    }
    authorAffMap.set(a.id, [...(authorAffMap.get(a.id) || []), idx]);
  }

  const superscripts = "¹²³⁴⁵⁶⁷⁸⁹";
  const authorLine = orderedAuthors
    .map((a) => {
      const coauthor = coauthors.find((c) => c.id === a.id);
      if (!coauthor) return a.id;
      const indices = authorAffMap.get(a.id) || [];
      const sups = indices.map((i) => superscripts[i] || `${i + 1}`).join("");
      return `${coauthor.name}${sups}`;
    })
    .join(", ");

  const affLines = affiliations.map((aff, i) => `${superscripts[i] || i + 1} ${aff}`).join("\n");

  const corresponding = orderedAuthors
    .map((a) => coauthors.find((c) => c.id === a.id))
    .find((c) => c?.role === "corresponding");

  let result = `${authorLine}\n\n${affLines}`;
  if (corresponding) {
    result += `\n\nCorresponding author: ${corresponding.name}, ${corresponding.email}`;
  }
  return result;
}

function generateContributorStatement(ms: Manuscript, coauthors: Coauthor[]): string {
  const orderedAuthors = [...ms.authors].sort((a, b) => a.order - b.order);
  const lines = orderedAuthors
    .map((a) => {
      const coauthor = coauthors.find((c) => c.id === a.id);
      if (!coauthor) return null;
      if (!a.contributions || a.contributions.length === 0) return null;
      return `**${coauthor.name}**: ${a.contributions.join(", ")}.`;
    })
    .filter(Boolean);

  return lines.join(" ");
}

const STROBE_ITEMS = [
  "Title and abstract: Indicate the study's design with a commonly used term; provide an informative and balanced summary",
  "Background/rationale: Explain the scientific background and rationale for the investigation",
  "Objectives: State specific objectives, including any prespecified hypotheses",
  "Study design: Present key elements of study design early in the paper",
  "Setting: Describe the setting, locations, and relevant dates",
  "Participants: Give the eligibility criteria, sources and methods of selection, and follow-up methods",
  "Variables: Clearly define all outcomes, exposures, predictors, potential confounders, and effect modifiers",
  "Data sources/measurement: For each variable, give sources of data and details of methods of assessment",
  "Bias: Describe any efforts to address potential sources of bias",
  "Study size: Explain how the study size was arrived at",
  "Quantitative variables: Explain how quantitative variables were handled; describe groupings and rationale",
  "Statistical methods: Describe all statistical methods, including those used to control for confounding",
  "Statistical methods: Describe any methods for subgroup analyses and interactions",
  "Statistical methods: Explain how missing data were addressed",
  "Statistical methods: Describe any sensitivity analyses",
  "Participants: Report numbers at each stage of study (e.g., potentially eligible, examined, confirmed eligible, included, completed follow-up, analysed)",
  "Descriptive data: Give characteristics of study participants and information on exposures and potential confounders",
  "Outcome data: Report numbers of outcome events or summary measures",
  "Main results: Give unadjusted estimates and, if applicable, confounder-adjusted estimates and their precision",
  "Other analyses: Report other analyses done — e.g., analyses of subgroups, interactions, and sensitivity analyses",
  "Key results: Summarise key results with reference to study objectives",
  "Limitations: Discuss limitations, including sources of potential bias and imprecision",
  "Interpretation: Give a cautious overall interpretation considering objectives, limitations, multiplicity, and other relevant evidence",
  "Generalisability: Discuss the generalisability (external validity) of the study results",
  "Funding: Give the source of funding and the role of the funders; state access to data",
];

const CONSORT_ITEMS = [
  "Title: Identified as a randomised trial in the title",
  "Abstract: Structured summary of trial design, methods, results, and conclusions",
  "Background: Scientific background and explanation of rationale",
  "Objectives: Specific objectives or hypotheses",
  "Trial design: Description of trial design including allocation ratio",
  "Participants: Eligibility criteria for participants",
  "Interventions: The interventions for each group with sufficient details to allow replication",
  "Outcomes: Completely defined pre-specified primary and secondary outcome measures",
  "Sample size: How sample size was determined",
  "Randomisation — sequence generation: Method used to generate the random allocation sequence",
  "Randomisation — allocation concealment: Mechanism used to implement the random allocation sequence",
  "Randomisation — implementation: Who generated the sequence, who enrolled, who assigned",
  "Blinding: If done, who was blinded and how",
  "Statistical methods: Statistical methods used to compare groups for primary and secondary outcomes",
  "Participant flow: For each group, numbers randomly assigned, receiving intended treatment, and analysed for the primary outcome (diagram)",
  "Recruitment: Dates defining the periods of recruitment and follow-up",
  "Baseline data: A table showing baseline demographic and clinical characteristics for each group",
  "Numbers analysed: For each group, number of participants included in each analysis and whether the analysis was by original assigned groups",
  "Outcomes and estimation: For each outcome, results for each group, estimated effect size, and its precision",
  "Ancillary analyses: Results of any other analyses performed, including subgroup analyses and adjusted analyses",
  "Harms: All important harms or unintended effects in each group",
  "Limitations: Trial limitations, addressing sources of potential bias, imprecision, and multiplicity",
  "Generalisability: Generalisability (external validity, applicability) of the trial findings",
  "Interpretation: Interpretation consistent with results, balancing benefits and harms, considering other relevant evidence",
  "Registration: Registration number and name of trial registry",
];

const PRISMA_ITEMS = [
  "Title: Identify the report as a systematic review, meta-analysis, or both",
  "Abstract: Provide a structured summary",
  "Rationale: Describe the rationale for the review in the context of existing knowledge",
  "Objectives: Provide an explicit statement of questions being addressed with reference to PICOS",
  "Protocol and registration: Indicate whether a review protocol exists, registration information",
  "Eligibility criteria: Specify study characteristics and report characteristics used as criteria for eligibility",
  "Information sources: Describe all information sources and date last searched",
  "Search: Present full electronic search strategy for at least one database",
  "Study selection: State the process for selecting studies",
  "Data collection process: Describe method of data extraction from reports",
  "Data items: List and define all variables for which data were sought",
  "Risk of bias in individual studies: Describe methods used for assessing risk of bias in individual studies",
  "Summary measures: State the principal summary measures (e.g., risk ratio, difference in means)",
  "Synthesis of results: Describe the methods of handling data and combining results of studies",
  "Risk of bias across studies: Specify any assessment of risk of bias that may affect the cumulative evidence",
  "Additional analyses: Describe methods of additional analyses (e.g., sensitivity, subgroup, meta-regression)",
  "Study selection: Give numbers of studies screened, assessed for eligibility, and included, with reasons for exclusions at each stage (diagram)",
  "Study characteristics: For each study, present characteristics for which data were extracted and provide citations",
  "Risk of bias within studies: Present data on risk of bias of each study and, if available, any outcome-level assessment",
  "Results of individual studies: For all outcomes, present for each study simple summary data and effect estimates and confidence intervals",
  "Synthesis of results: Present results of each meta-analysis done, including confidence intervals and measures of consistency",
  "Risk of bias across studies: Present results of any assessment of risk of bias across studies",
  "Additional analysis: Give results of additional analyses (e.g., sensitivity, subgroup analyses, meta-regression)",
  "Summary of evidence: Summarize the main findings including the strength of evidence for each main outcome",
  "Limitations: Discuss limitations at study and outcome level, and at review level",
  "Conclusions: Provide a general interpretation of the results in context of other evidence, and implications for future research",
  "Funding: Describe sources of funding for the systematic review and other support; role of funders",
];

function generateChecklist(type: string | null) {
  let items: string[];
  switch (type?.toUpperCase()) {
    case "CONSORT":
      items = CONSORT_ITEMS;
      break;
    case "PRISMA":
      items = PRISMA_ITEMS;
      break;
    case "STROBE":
    default:
      items = STROBE_ITEMS;
      break;
  }
  return items.map((item) => ({ item, checked: false, note: "" }));
}

function generateTitlePage(ms: Manuscript, coauthors: Coauthor[]): string {
  const orderedAuthors = [...(ms.authors || [])].sort((a, b) => a.order - b.order);
  const superscripts = "¹²³⁴⁵⁶⁷⁸⁹";

  const affiliations: string[] = [];
  const authorAffMap = new Map<string, number[]>();
  for (const a of orderedAuthors) {
    const co = coauthors.find((c) => c.id === a.id);
    if (!co) continue;
    const aff = [co.department, co.institution].filter(Boolean).join(", ");
    let idx = affiliations.indexOf(aff);
    if (idx === -1) { affiliations.push(aff); idx = affiliations.length - 1; }
    authorAffMap.set(a.id, [...(authorAffMap.get(a.id) || []), idx]);
  }

  const authorLine = orderedAuthors.map((a) => {
    const co = coauthors.find((c) => c.id === a.id);
    if (!co) return "";
    const sups = (authorAffMap.get(a.id) || []).map((i) => superscripts[i] || `${i + 1}`).join("");
    const creds = (co as unknown as Record<string, string>).credentials;
    return `${co.name}${creds ? `, ${creds}` : ""}${sups}`;
  }).filter(Boolean).join(", ");

  const affLines = affiliations.map((aff, i) => `${superscripts[i] || i + 1} ${aff}`).join("\n");

  const corresponding = orderedAuthors
    .map((a) => coauthors.find((c) => c.id === a.id))
    .find((c) => c?.role === "corresponding");

  const parts: string[] = ["TITLE PAGE\n"];

  parts.push(`Full Title:\n${ms.title || "[Title not set]"}\n`);
  if (ms.running_title) parts.push(`Running Title:\n${ms.running_title}\n`);
  parts.push(`Authors:\n${authorLine}\n`);
  parts.push(`Affiliations:\n${affLines}\n`);

  if (corresponding) {
    const creds = (corresponding as unknown as Record<string, string>).credentials;
    const corrBlock = [
      `${corresponding.name}${creds ? `, ${creds}` : ""}`,
      corresponding.department,
      corresponding.institution,
      `Email: ${corresponding.email}`,
    ].filter(Boolean).join("\n");
    parts.push(`Corresponding Author:\n${corrBlock}\n`);
  }

  const counts = [
    ms.word_count != null ? `Word Count: ${ms.word_count.toLocaleString()} words` : null,
    ms.abstract_word_count != null ? `Abstract Word Count: ${ms.abstract_word_count.toLocaleString()} words` : null,
  ].filter(Boolean);
  if (counts.length) parts.push(counts.join("\n") + "\n");

  if (ms.keywords?.length) parts.push(`Keywords:\n${ms.keywords.join(", ")}\n`);
  if (ms.funding) parts.push(`Funding:\n${ms.funding}\n`);
  if (ms.conflicts_of_interest) parts.push(`Conflicts of Interest:\n${ms.conflicts_of_interest}\n`);
  if (ms.irb_statement) parts.push(`Ethics Statement:\n${ms.irb_statement}\n`);
  if (ms.data_availability) parts.push(`Data Availability:\n${ms.data_availability}\n`);
  if (ms.acknowledgments) parts.push(`Acknowledgments:\n${ms.acknowledgments}\n`);

  return parts.join("\n");
}

function generateSuggestedReviewers(ms: Manuscript): string {
  const suggested = ms.suggested_reviewers || [];
  const excluded = ms.excluded_reviewers || [];
  if (!suggested.length && !excluded.length) return "No suggested or excluded reviewers have been added yet.";

  const lines: string[] = [];
  if (suggested.length) {
    lines.push("SUGGESTED REVIEWERS\n");
    suggested.forEach((r, i) => {
      lines.push(`${i + 1}. ${r.name}`);
      if (r.email) lines.push(`   Email: ${r.email}`);
      if (r.institution) lines.push(`   Institution: ${r.institution}`);
      if (r.reason) lines.push(`   Expertise: ${r.reason}`);
      lines.push("");
    });
  }
  if (excluded.length) {
    lines.push("\nEXCLUDED REVIEWERS\n");
    excluded.forEach((name, i) => lines.push(`${i + 1}. ${name}`));
  }
  return lines.join("\n");
}

async function generateReviewerResponse(ms: Manuscript, reviewerComments: string): Promise<string> {
  const prompt = `You are helping an academic researcher write a response to peer reviewer comments for a journal submission.

Manuscript title: "${ms.title || "the manuscript"}"
Journal: ${ms.journal || "the journal"}

REVIEWER COMMENTS RECEIVED:
${reviewerComments}

Generate a complete, professional response letter. Structure it as follows:

1. A short opening paragraph thanking the editors and reviewers, noting that the manuscript has been revised.

2. For each reviewer (Reviewer 1, Reviewer 2, etc.) and each of their comments, create an entry:

REVIEWER [N], COMMENT [N]:
> [Quote the reviewer comment verbatim]

Response:
[AUTHOR TO COMPLETE — write your response here]

Manuscript Change:
[AUTHOR TO COMPLETE — describe what was changed and where in the manuscript]

---

Use "EDITOR COMMENTS" as a section header for any editor-level comments.
Preserve all reviewer wording exactly when quoting.
Leave the Response and Manuscript Change lines as prompts for the author to fill in.`;

  const escaped = prompt.replace(/'/g, "'\\''");
  const { stdout } = await execAsync(`claude -p '${escaped}'`, { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  return stdout.trim();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ms = loadManuscript(id);
  if (!ms) {
    return Response.json({ error: "Manuscript not found" }, { status: 404 });
  }

  const body = await request.json();
  const { type, ...bodyParams } = body;
  const coauthors = loadCoauthors();

  switch (type) {
    case "cover-letter":
      return Response.json({ content: generateCoverLetter(ms, coauthors, bodyParams as CoverLetterParams) });
    case "author-block":
      return Response.json({ content: generateAuthorBlock(ms, coauthors) });
    case "contributor-statement":
      return Response.json({ content: generateContributorStatement(ms, coauthors) });
    case "checklist":
      return Response.json({ items: generateChecklist(ms.journal_requirements?.checklist_type) });
    case "title-page":
      return Response.json({ content: generateTitlePage(ms, coauthors) });
    case "suggested-reviewers":
      return Response.json({ content: generateSuggestedReviewers(ms) });
    case "reviewer-response": {
      const { reviewer_comments } = bodyParams as { reviewer_comments?: string };
      if (!reviewer_comments?.trim()) return Response.json({ error: "reviewer_comments required" }, { status: 400 });
      const content = await generateReviewerResponse(ms, reviewer_comments);
      return Response.json({ content });
    }
    default:
      return Response.json({ error: "Invalid type" }, { status: 400 });
  }
}
