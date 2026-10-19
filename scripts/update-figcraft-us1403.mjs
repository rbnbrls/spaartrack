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
if (nodes[83]) throw new Error("Figcraft US-1403 nodes already exist");
const baseRectangle = nodes[73];
const baseText = nodes[74];
const makeText = (id, name, characters, x, y, width, height, fontSize = 14) => ({
  ...baseText,
  id,
  name,
  characters,
  parent: 2,
  transform: [1, 0, 0, 1, x, y],
  width,
  height,
  style: { ...baseText.style, font_size: fontSize }
});
const ids = [83, 84, 85, 86, 87, 88, 89, 90];
nodes[83] = { ...baseRectangle, id: 83, name: "Yield curve scenario card", transform: [1, 0, 0, 1, 900, 150], width: 500, height: 300 };
nodes[84] = makeText(84, "Yield curve eyebrow", "US-1403 · YIELD CURVE SCENARIOS", 924, 178, 300, 16, 11);
nodes[85] = makeText(85, "Yield curve title", "Yield curve & rate scenarios", 924, 205, 360, 26, 20);
nodes[86] = makeText(86, "Yield curve subtitle", "Parallel shifts blijven reproduceerbaar en read-only", 924, 242, 420, 18, 12);
nodes[87] = makeText(87, "Yield curve base", "30d 2,10%  ·  365d 2,40%  ·  1095d 2,90%", 924, 286, 440, 20, 14);
nodes[88] = makeText(88, "Yield curve shifted", "+100 bp  →  30d 3,10%  ·  365d 3,40%  ·  1095d 3,90%", 924, 320, 450, 20, 14);
nodes[89] = makeText(89, "Yield curve assumptions", "PARALLEL · OBSERVATIONS_ONLY · EUR", 924, 354, 420, 18, 11);
nodes[90] = makeText(90, "Yield curve version", "synthetic-curve-v1 · bond-curve-scenario-v1", 924, 386, 440, 16, 10);
document.nodes[2].children = [...document.nodes[2].children, ...ids];
writeFileSync(documentPath, JSON.stringify(document));
const next = `${archive}.next`;
execFileSync("zip", ["-q", "-j", next, join(work, "document.json"), join(work, "thumbnail.png")]);
renameSync(next, archive);
