const fs=require('node:fs');
const source=fs.readFileSync('trip-features.js','utf8');
if(source.includes('</script>'))throw Error('Inline script closing tag');
let html=fs.readFileSync('index.html','utf8');
const tag='<script id="trip-script">\n'+source+'</script>';
if(html.includes('<script src="./trip-features.js"></script>'))html=html.replace('<script src="./trip-features.js"></script>',()=>tag);
else html=html.replace(/<script id="trip-script">[\s\S]*?<\/script>/,()=>tag);
fs.writeFileSync('index.html',html);
