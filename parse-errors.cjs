const fs = require('fs');
const text = fs.readFileSync('build_output.txt', 'utf16le');
const matches = [...text.matchAll(/Error: "([^"]+)" is not exported/g)];
const unique = [...new Set(matches.map(m => m[1]))];
console.log(unique);
