const { Resvg } = require("@resvg/resvg-js");
const fs = require("fs");

const [, , input, output, width] = process.argv;
const svg = fs.readFileSync(input);
const r = new Resvg(svg, {
  fitTo: { mode: "width", value: Number(width || 1200) },
  background: "rgba(0,0,0,0)",
  font: { loadSystemFonts: true },
});
const png = r.render().asPng();
fs.writeFileSync(output, png);
console.log("ok", output, png.length);
