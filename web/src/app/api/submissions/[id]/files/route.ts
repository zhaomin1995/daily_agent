import fs from "fs";
import path from "path";
import { SUBMISSIONS_DIR } from "@/lib/submissionPaths";

export const dynamic = "force-dynamic";

function filesDir(id: string) {
  return path.join(SUBMISSIONS_DIR, "files", id);
}

export interface FileEntry {
  name: string;
  size: number;
  modified: string;
  category: string;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dir = filesDir(id);
  if (!fs.existsSync(dir)) return Response.json({ files: [] });

  const files: FileEntry[] = fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      const metaPath = path.join(dir, `.${name}.meta.json`);
      const meta = fs.existsSync(metaPath)
        ? (JSON.parse(fs.readFileSync(metaPath, "utf-8")) as { category?: string })
        : {};
      return { name, size: stat.size, modified: stat.mtime.toISOString(), category: meta.category || "other" };
    });

  return Response.json({ files });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dir = filesDir(id);
  fs.mkdirSync(dir, { recursive: true });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string) || "other";

  if (!file) return Response.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, "_");
  fs.writeFileSync(path.join(dir, filename), buffer);
  fs.writeFileSync(
    path.join(dir, `.${filename}.meta.json`),
    JSON.stringify({ category, uploadedAt: new Date().toISOString() })
  );

  return Response.json({ ok: true, name: filename, size: buffer.length, category });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { filename } = (await request.json()) as { filename: string };
  const dir = filesDir(id);
  const filePath = path.join(dir, filename);

  if (!fs.existsSync(filePath)) return Response.json({ error: "Not found" }, { status: 404 });

  fs.unlinkSync(filePath);
  const metaPath = path.join(dir, `.${filename}.meta.json`);
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

  return Response.json({ ok: true });
}
