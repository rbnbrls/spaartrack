import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const archive = join(root, "design/spaartrack-dashboard.figcraft");
const work = mkdtempSync(join(tmpdir(), "spaartrack-figcraft-"));
execFileSync("unzip", ["-q", archive, "document.json", "thumbnail.png", "-d", work]);

const documentPath = join(work, "document.json");
const document = JSON.parse(readFileSync(documentPath, "utf8"));
const nodes = document.nodes;
const frame = nodes[2];
const ids = [73, 74, 75, 76, 77, 78, 79, 80, 81, 82];
if (nodes[73]) throw new Error("Figcraft US-1402 nodes already exist");

const rectangle = nodes[51];
const text = nodes[52];
const makeText = (id, name, characters, x, y, width, height, fontSize = 14) => ({
  ...text,
  id,
  name,
  characters,
  parent: 2,
  transform: [1, 0, 0, 1, x, y],
  width,
  height,
  style: { ...text.style, font_size: fontSize }
});

nodes[73] = {
  ...rectangle,
  id: 73,
  name: "Bond pricing metrics card",
  parent: 2,
  transform: [1, 0, 0, 1, 900, 520],
  width: 500,
  height: 320,
  fills: [{ type: "solid", color: { r: 0.07058824, g: 0.11764706, b: 0.17254902, a: 1 }, opacity: 1, visible: true, blend: "normal" }]
};
nodes[74] = makeText(74, "Bond pricing eyebrow", "US-1402 · BOND PRICING", 924, 548, 220, 16, 11);
nodes[75] = makeText(75, "Bond pricing title", "Bondprijs & yield metrics", 924, 575, 330, 26, 20);
nodes[76] = makeText(76, "Bond pricing subtitle", "Versioned, read-only metrics uit bondprofiel-cashflows", 924, 612, 420, 18, 12);
nodes[77] = makeText(77, "Bond pricing yield", "YTM                         3,00%", 924, 660, 420, 20, 14);
nodes[78] = makeText(78, "Bond pricing clean price", "Clean price                € 1.043,04", 924, 690, 420, 20, 14);
nodes[79] = makeText(79, "Bond pricing accrued", "Accrued interest            € 11,95", 924, 720, 420, 20, 14);
nodes[80] = makeText(80, "Bond pricing duration", "Duration / convexity      4,22 / 22,78", 924, 750, 420, 20, 14);
nodes[81] = makeText(81, "Bond pricing dv01", "DV01                         € 0,4449 per bp", 924, 780, 420, 20, 14);
nodes[82] = makeText(82, "Bond pricing evidence", "bond-pricing-v1 · ACT/365 · read-only", 924, 812, 420, 16, 10);
frame.children = [...frame.children, ...ids];
writeFileSync(documentPath, JSON.stringify(document));

const next = `${archive}.next`;
execFileSync("zip", ["-q", "-j", next, join(work, "document.json"), join(work, "thumbnail.png")]);
renameSync(next, archive);
