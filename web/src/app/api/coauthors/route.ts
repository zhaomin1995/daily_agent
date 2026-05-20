import fs from "fs";
import yaml from "js-yaml";
import { COAUTHORS_FILE } from "@/lib/submissionPaths";

export const dynamic = "force-dynamic";

const DEFAULT_COAUTHORS = {
  coauthors: [
    {
      id: "ly",
      name: "Lanting Yang",
      email: "lantingyang2017@gmail.com",
      orcid: "",
      role: "corresponding",
      institution: "University of California San Diego",
      department: "",
      contributions: [],
    },
    {
      id: "example_coauthor",
      name: "Jane Smith",
      email: "jsmith@university.edu",
      orcid: "0000-0000-0000-0000",
      role: "coauthor",
      institution: "Example University",
      department: "Department of Medicine",
      contributions: [],
    },
  ],
};

function readCoauthors() {
  if (!fs.existsSync(COAUTHORS_FILE)) {
    fs.writeFileSync(COAUTHORS_FILE, yaml.dump(DEFAULT_COAUTHORS));
    return DEFAULT_COAUTHORS.coauthors;
  }
  const content = fs.readFileSync(COAUTHORS_FILE, "utf-8");
  const data = yaml.load(content) as { coauthors: unknown[] };
  return data?.coauthors || [];
}

export async function GET() {
  return Response.json(readCoauthors());
}

export async function PUT(request: Request) {
  const coauthors = await request.json();
  fs.writeFileSync(COAUTHORS_FILE, yaml.dump({ coauthors }));
  return Response.json({ ok: true });
}
