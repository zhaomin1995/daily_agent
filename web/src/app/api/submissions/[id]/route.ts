import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { SUBMISSIONS_DIR } from "@/lib/submissionPaths";

export const dynamic = "force-dynamic";

function filePath(id: string) {
  return path.join(SUBMISSIONS_DIR, `${id}.yaml`);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fp = filePath(id);
  if (!fs.existsSync(fp)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const content = fs.readFileSync(fp, "utf-8");
  return Response.json(yaml.load(content));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fp = filePath(id);
  if (!fs.existsSync(fp)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const existing = yaml.load(fs.readFileSync(fp, "utf-8")) as Record<string, unknown>;
  const updates = await request.json();
  const merged = { ...existing, ...updates, id };
  fs.writeFileSync(fp, yaml.dump(merged));
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fp = filePath(id);
  if (!fs.existsSync(fp)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  fs.unlinkSync(fp);
  return Response.json({ ok: true });
}
