const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LOGO = path.join(ROOT, "logo");
const PNG = path.join(ROOT, "png");
fs.mkdirSync(PNG, { recursive: true });

const jobs = [
  ["shirun-hat-logo-primary.svg", "shirun-hat-logo-primary@3000.png", 3000],
  ["shirun-hat-logo-primary.svg", "shirun-hat-logo-primary@1500.png", 1500],
  ["shirun-hat-logo-horizontal.svg", "shirun-hat-logo-horizontal@2400.png", 2400],
  ["shirun-hat-logo-horizontal.svg", "shirun-hat-logo-horizontal@1200.png", 1200],
  ["shirun-hat-logo-stacked.svg", "shirun-hat-logo-stacked@1800.png", 1800],
  ["shirun-hat-mark.svg", "shirun-hat-mark@1024.png", 1024],
  ["shirun-hat-mark.svg", "shirun-hat-mark@512.png", 512],
  ["shirun-hat-mark.svg", "shirun-hat-mark@256.png", 256],
  ["shirun-hat-mark.svg", "shirun-hat-mark@128.png", 128],
  ["favicon.svg", "favicon-32.png", 32],
  ["favicon.svg", "favicon-180.png", 180],
  ["favicon.svg", "favicon-512.png", 512],
  ["shirun-hat-logo-primary-mono.svg", "shirun-hat-logo-primary-mono@2000.png", 2000],
  ["shirun-hat-logo-primary-reversed.svg", "shirun-hat-logo-primary-reversed@2000.png", 2000],
  ["shirun-hat-logo-horizontal-reversed.svg", "shirun-hat-logo-horizontal-reversed@2400.png", 2400],
];

for (const [src, out, width] of jobs) {
  const svg = fs.readFileSync(path.join(LOGO, src));
  const r = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "rgba(0,0,0,0)",
  });
  const png = r.render().asPng();
  fs.writeFileSync(path.join(PNG, out), png);
  console.log(out, png.length);
}
