const fs = require('fs');
let s = fs.readFileSync('products.js', 'utf8');
s = s.replace(/cat: 'sun-visor', catLabel: 'Sun Visors'/g, "cat: 'visors', catLabel: 'Sun Visors'");
s = s.replace("sortEl.value = state.sort;\n      apply();", "sortEl.value = state.sort;\n      if (sortEl.__luxsync) sortEl.__luxsync();\n      apply();");
fs.writeFileSync('products.js', s);
console.log('replaced:', (s.match(/cat: 'visors'/g) || []).length, 'visors,', (s.match(/cat: 'caps'/g) || []).length, 'caps, luxsync:', s.includes('__luxsync'));
