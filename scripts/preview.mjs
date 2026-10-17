import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname, sep } from "node:path";
const folder = resolve("dist/preview");
await mkdir(folder, { recursive: true });
await cp("extension", folder, { recursive: true });
await writeFile(
  `${folder}/preview.js`,
  `
const samples=[
 {text:'Pay attention to the small things. They are where a life is made.',title:'A note to my future self',collection:'Commonplace',note:'A reminder to slow down.'},
 {text:'A good question can be a better companion than a quick answer.',title:'Thoughts from a long walk',collection:'Ideas',note:''},
 {text:'Leave a little room in the day for something you did not plan.',title:'The everyday notebook',collection:'Commonplace',note:''}
].map((q,i)=>({...q,id:crypto.randomUUID(),url:'',createdAt:new Date(Date.now()-i*86400000).toISOString(),month:'2026-10',favorite:i===1,status:'pending',accountId:null}));
let state=JSON.parse(localStorage.getItem('quotemark-preview-v011')||'null')||{quotes:samples,settings:{collection:'Commonplace'},account:null,configured:false};
const listeners=[];
window.chrome={runtime:{sendMessage:async m=>{let data;try{switch(m.type){case 'state':return {ok:true,data:structuredClone(state)};case 'save':{const {makeQuote}=await import('./lib/model.js');data=makeQuote(m.quote);state.quotes.unshift(data);break;}case 'favorite':Object.assign(state.quotes.find(q=>q.id===m.id),{favorite:m.value});break;case 'collection':state.settings.collection=m.collection||'Commonplace';break;case 'remove':state.quotes=state.quotes.filter(q=>q.id!==m.id);break;case 'capture':data={text:'',title:'',url:''};break;default:throw new Error('This is a UI preview. Google sign-in is available in a configured Chrome extension.');}localStorage.setItem('quotemark-preview-v011',JSON.stringify(state));for(const fn of listeners)fn({quotes:{}},'local');return {ok:true,data};}catch(e){return {ok:false,error:e.message};}}},storage:{onChanged:{addListener:fn=>listeners.push(fn)}}};
const ribbon=document.createElement('div');ribbon.textContent='Preview · Sample quotes · Drive not connected';ribbon.style.cssText='font:11px/1.5 system-ui;text-align:center;padding:7px;background:#fafafa;color:#777;border-bottom:1px solid #eee';document.body.prepend(ribbon);
`,
);
for (const name of ["library.html", "popup.html"]) {
  const path = `${folder}/${name}`;
  const html = await readFile(path, "utf8");
  await writeFile(
    path,
    html.replace(
      '<script type="module" src="app.js">',
      '<script src="preview.js"></script><script type="module" src="app.js">',
    ),
  );
}
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
};
const server = createServer(async (req, res) => {
  const path = resolve(
    folder,
    `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname === "/" ? "/library.html" : new URL(req.url, "http://localhost").pathname)}`,
  );
  if (!path.startsWith(folder + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const bytes = await readFile(path);
    res.writeHead(200, {
      "Content-Type": types[extname(path)] || "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(4173, "127.0.0.1", () =>
  console.log("UI preview: http://127.0.0.1:4173/library.html"),
);
