import fs from "fs";
import yaml from "js-yaml";
import { COAUTHORS_FILE } from "@/lib/submissionPaths";

export const dynamic = "force-dynamic";

interface Affiliation {
  institution: string;
  department?: string;
  city?: string;
}

interface Coauthor {
  id: string;
  name: string;
  credentials?: string;
  email: string;
  email_alt?: string;
  orcid?: string;
  role?: string;
  institution?: string;
  department?: string;
  city?: string;
  affiliations?: Affiliation[];
  contributions?: string[];
}

function readCoauthors(): Coauthor[] {
  if (!fs.existsSync(COAUTHORS_FILE)) return [];
  const data = yaml.load(fs.readFileSync(COAUTHORS_FILE, "utf-8")) as { coauthors: Coauthor[] };
  return data?.coauthors || [];
}

function writeCoauthors(coauthors: Coauthor[]) {
  fs.writeFileSync(COAUTHORS_FILE, yaml.dump({ coauthors }));
}

export async function GET() {
  return Response.json(readCoauthors());
}

// Replace full list
export async function PUT(request: Request) {
  const coauthors = await request.json();
  writeCoauthors(coauthors);
  return Response.json({ ok: true });
}

// Add a new coauthor
export async function POST(request: Request) {
  const body = await request.json() as Coauthor;
  if (!body.name?.trim()) return Response.json({ error: "name required" }, { status: 400 });
  const coauthors = readCoauthors();
  const id = body.id?.trim() || body.name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").slice(0, 20);
  if (coauthors.find((c) => c.id === id)) {
    return Response.json({ error: "id already exists" }, { status: 409 });
  }
  const entry: Coauthor = { contributions: [], ...body, id };
  writeCoauthors([...coauthors, entry]);
  return Response.json(entry);
}

// Update a single coauthor by id
export async function PATCH(request: Request) {
  const body = await request.json() as Partial<Coauthor> & { id: string };
  if (!body.id) return Response.json({ error: "id required" }, { status: 400 });
  const coauthors = readCoauthors();
  const idx = coauthors.findIndex((c) => c.id === body.id);
  if (idx === -1) return Response.json({ error: "not found" }, { status: 404 });
  coauthors[idx] = { ...coauthors[idx], ...body };
  writeCoauthors(coauthors);
  return Response.json(coauthors[idx]);
}

// Delete a coauthor by id
export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const coauthors = readCoauthors();
  writeCoauthors(coauthors.filter((c) => c.id !== id));
  return Response.json({ ok: true });
}
