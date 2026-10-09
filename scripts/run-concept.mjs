import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
const [operation, variant] = process.argv.slice(2);
const ports = { director: 3101, guided: 3102, gallery: 3103 };
if (!ports[variant] || !["dev", "build", "start"].includes(operation))
  throw new Error(
    "Usage: run-concept.mjs dev|build|start director|guided|gallery",
  );
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dependencyLink=path.join(root,'apps',variant,'node_modules');
if(!fs.existsSync(dependencyLink)){
 if(fs.existsSync(path.join(root,'frontend','node_modules'))){
  try{fs.unlinkSync(dependencyLink);}catch{}
  fs.symlinkSync(path.join(root,'frontend','node_modules'),dependencyLink,process.platform==='win32'?'junction':'dir');
 }else throw new Error('请先在 frontend/ 执行 npm ci');
}
// The source archive keeps one copy of evidence; mirror it for the comparison viewer.
if(variant==='director'){
 for(const name of ['comparison.html','screenshots','research','docs']){
  const source=path.join(root,name),destination=path.join(root,'frontend','public',name);
  if(fs.existsSync(source)&&!fs.existsSync(destination))fs.cpSync(source,destination,{recursive:true});
 }
}
const args = [operation];
if (operation !== "build")
  args.push("--hostname", "127.0.0.1", "--port", String(ports[variant]));
const child = spawn(
  process.execPath,
  [path.join(root, "frontend/node_modules/next/dist/bin/next"), ...args],
  {
    cwd: path.join(root, "apps", variant),
    env: { ...process.env, NEXT_PUBLIC_MUJIAN_CONCEPT: variant },
    stdio: "inherit",
  },
);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code) => process.exit(code ?? 0));
