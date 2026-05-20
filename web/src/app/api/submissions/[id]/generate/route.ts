import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { SUBMISSIONS_DIR, COAUTHORS_FILE } from "@/lib/submissionPaths";

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

interface Manuscript {
  id: string;
  title: string;
  journal: string;
  authors: ManuscriptAuthor[];
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

function generateCoverLetter(ms: Manuscript, coauthors: Coauthor[]): string {
  const corresponding = ms.authors
    .map((a) => coauthors.find((c) => c.id === a.id))
    .find((c) => c?.role === "corresponding");

  const name = corresponding?.name || "[Corresponding Author]";
  const email = corresponding?.email || "[email]";

  return `Dear Editors,

We are pleased to submit our manuscript "${ms.title}" for consideration in ${ms.journal || "[Journal Name]"}.

[Please describe the novelty and significance of this work here.]

All authors have read and approved the final manuscript. The authors declare no conflicts of interest.

Sincerely,
${name}
${email}`;
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ms = loadManuscript(id);
  if (!ms) {
    return Response.json({ error: "Manuscript not found" }, { status: 404 });
  }

  const { type } = await request.json();
  const coauthors = loadCoauthors();

  switch (type) {
    case "cover-letter":
      return Response.json({ content: generateCoverLetter(ms, coauthors) });
    case "author-block":
      return Response.json({ content: generateAuthorBlock(ms, coauthors) });
    case "contributor-statement":
      return Response.json({ content: generateContributorStatement(ms, coauthors) });
    case "checklist":
      return Response.json({ items: generateChecklist(ms.journal_requirements?.checklist_type) });
    default:
      return Response.json({ error: "Invalid type" }, { status: 400 });
  }
}
