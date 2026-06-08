import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType,
} from "docx";

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
}

function getAffiliationStrings(a: Coauthor): string[] {
  if (a.affiliations && a.affiliations.length > 0) {
    return a.affiliations
      .filter((af) => af.institution || af.department || af.city)
      .map((af) => [af.department, af.institution, af.city].filter(Boolean).join(", "));
  }
  const single = [a.department, a.institution, a.city].filter(Boolean).join(", ");
  return single ? [single] : [];
}

export async function POST(request: Request) {
  const { authors, type } = await request.json() as {
    authors: Coauthor[];
    type: "block" | "contacts" | "full";
  };

  const doc = type === "contacts"
    ? buildContactSheet(authors)
    : type === "block"
    ? buildAuthorBlock(authors)
    : buildFullProfile(authors);

  const buffer = await Packer.toBuffer(doc);

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="coauthors-${type}-${new Date().toISOString().split("T")[0]}.docx"`,
    },
  });
}

// Author Block: "Name1, Creds1¹²; Name2, Creds2³" followed by numbered affiliations
function buildAuthorBlock(authors: Coauthor[]): Document {
  const affMap = new Map<string, number>();
  authors.forEach((a) => {
    getAffiliationStrings(a).forEach((aff) => {
      if (!affMap.has(aff)) affMap.set(aff, affMap.size + 1);
    });
  });

  // Build name line with superscript numbers
  const nameRuns: TextRun[] = [];
  authors.forEach((a, i) => {
    if (i > 0) nameRuns.push(new TextRun({ text: "; " }));
    const nameWithCreds = a.credentials ? `${a.name}, ${a.credentials}` : a.name;
    nameRuns.push(new TextRun({ text: nameWithCreds }));
    const supNums = getAffiliationStrings(a)
      .map((aff) => affMap.get(aff))
      .filter(Boolean) as number[];
    if (supNums.length) {
      nameRuns.push(new TextRun({ text: supNums.join(","), superScript: true, size: 16 }));
    }
  });

  const affLines = [...affMap.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([aff, n]) => new Paragraph({
      children: [
        new TextRun({ text: String(n), superScript: true, size: 16 }),
        new TextRun({ text: ` ${aff}`, size: 20 }),
      ],
      spacing: { after: 80 },
    }));

  const corrAuthor = authors.find((a) => a.role === "corresponding");
  const corrParagraphs = corrAuthor ? [
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({ text: "Corresponding author: ", bold: true, size: 20 }),
        new TextRun({
          text: `${corrAuthor.name}${corrAuthor.credentials ? `, ${corrAuthor.credentials}` : ""}`,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Email: ", bold: true, size: 20 }),
        new TextRun({ text: corrAuthor.email, size: 20 }),
      ],
    }),
  ] : [];

  return new Document({
    sections: [{
      children: [
        new Paragraph({
          children: nameRuns,
          spacing: { after: 240 },
        }),
        ...affLines,
        ...corrParagraphs,
      ],
    }],
  });
}

// Contact Sheet: numbered list, full details per author
function buildContactSheet(authors: Coauthor[]): Document {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: "Author Contact Information",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
    }),
  ];

  authors.forEach((a, i) => {
    const affs = getAffiliationStrings(a);
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${i + 1}. ${a.name}${a.credentials ? ` ${a.credentials}` : ""}`,
            bold: true, size: 22,
          }),
          ...(a.role === "corresponding"
            ? [new TextRun({ text: "  (Corresponding Author)", italics: true, size: 20, color: "1D4ED8" })]
            : []),
        ],
        spacing: { before: 240, after: 60 },
      }),
      ...affs.map((aff) => new Paragraph({ children: [new TextRun({ text: aff, size: 20 })], spacing: { after: 40 } })),
      new Paragraph({ children: [new TextRun({ text: `Email: ${a.email}`, size: 20 })], spacing: { after: 40 } }),
      ...(a.email_alt ? [new Paragraph({ children: [new TextRun({ text: `Alt Email: ${a.email_alt}`, size: 20 })], spacing: { after: 40 } })] : []),
      ...(a.orcid ? [new Paragraph({ children: [new TextRun({ text: `ORCID: https://orcid.org/${a.orcid}`, size: 20 })], spacing: { after: 40 } })] : []),
    );
  });

  return new Document({ sections: [{ children: paragraphs }] });
}

// Full Profile: table with all fields
function buildFullProfile(authors: Coauthor[]): Document {
  const rows = [
    new TableRow({
      children: ["Name", "Credentials", "Affiliation(s)", "Email", "ORCID", "Role"].map((h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })],
          shading: { fill: "F4F4F5" },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "D4D4D8" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "D4D4D8" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "D4D4D8" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "D4D4D8" },
          },
        })
      ),
    }),
    ...authors.map((a) =>
      new TableRow({
        children: [
          a.name,
          a.credentials || "",
          getAffiliationStrings(a).join("\n"),
          a.email + (a.email_alt ? `\n${a.email_alt}` : ""),
          a.orcid ? `https://orcid.org/${a.orcid}` : "",
          a.role === "corresponding" ? "Corresponding" : "Co-author",
        ].map((val) =>
          new TableCell({
            children: val.split("\n").map((line) =>
              new Paragraph({ children: [new TextRun({ text: line, size: 18 })], spacing: { after: 40 } })
            ),
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "D4D4D8" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "D4D4D8" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "D4D4D8" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "D4D4D8" },
            },
          })
        ),
      })
    ),
  ];

  return new Document({
    sections: [{
      children: [
        new Paragraph({
          text: "Co-author Profiles",
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 240 },
          alignment: AlignmentType.LEFT,
        }),
        new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      ],
    }],
  });
}
