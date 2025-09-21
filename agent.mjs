#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import * as yaml from "yaml";

function read(p){ return fs.readFileSync(p, "utf8"); }
function write(p,s){ fs.writeFileSync(p, s, "utf8"); }
function exists(p){ return fs.existsSync(p); }

function parseArgs(){
  const a = process.argv.slice(2); const o = {};
  for (let i=0;i<a.length;i++){
    const k = a[i];
    if (k==="--sprint") o.sprint = a[++i];
    else if (k==="--backlog") o.backlog = a[++i];
    else if (k==="--config") o.config = a[++i];
    else if (k==="--dry") o.dry = true;
  }
  if (!o.sprint || !o.config){ console.error("Missing --sprint or --config"); process.exit(2); }
  return o;
}

function extractTasks(md){
  const tasks = [];
  md.split(/\r?\n/).forEach(line=>{
    const m = /^\s*-\s*\[( |x|X)\]\s*(.+)$/.exec(line);
    if (m){ tasks.push({done: m[1].toLowerCase()==="x", text: m[2].trim(), raw: line}); }
  });
  return tasks;
}

function runCmd(cmd, cwd){
  const res = spawnSync(cmd, { shell:true, cwd, stdio:"inherit" });
  return res.status ?? 1;
}

function markDone(lines, raw){
  const idx = lines.indexOf(raw);
  if (idx>=0) lines[idx] = raw.replace("- [ ]","- [x]");
}

function makeSummary(runlog){
  const ok = runlog.filter(r=>r.status==="ok").length;
  const fail = runlog.some(r=>r.status==="fail");
  return `Tasks executed: ${runlog.length}\nSucceeded: ${ok}\nFailed: ${fail?1:0}`;
}

function main(){
  const a = parseArgs();
  const sprintPath = path.resolve(a.sprint);
  const projectDir = path.dirname(sprintPath);
  const config = yaml.parse(read(path.resolve(a.config)));
  const rules = config.rules || [];
  const md = read(sprintPath);
  const lines = md.split(/\r?\n/);
  const tasks = extractTasks(md);

  const runDir = path.join(projectDir, "agent_runs");
  fs.mkdirSync(runDir, {recursive:true});
  const log = [];
  console.log(`â†¯ Sprint: ${sprintPath}`);
  console.log(`â†¯ Total tasks: ${tasks.length}`);

  for (const t of tasks){
    if (t.done) continue;
    const rule = rules.find(r=> t.text.toLowerCase().includes(r.when.toLowerCase()));
    if (!rule){ console.log(`â€¢ SKIP (no rule): ${t.text}`); log.push({task:t.text,status:"skipped"}); continue; }
    console.log(`â€¢ RUN: ${t.text}\n  $ ${rule.run}`);
    if (a.dry){ log.push({task:t.text,status:"dry",cmd:rule.run}); continue; }
    const code = runCmd(rule.run, projectDir);
    log.push({task:t.text,status:(code===0?"ok":"fail"),code,cmd:rule.run,at:new Date().toISOString()});
    if (code===0) markDone(lines, t.raw); else break;
  }

  if (!a.dry) write(sprintPath, lines.join("\n"));
  const stamp = new Date().toISOString().replace(/[:.]/g,"-");
  write(path.join(runDir, `run_${stamp}.jsonl`), JSON.stringify({sprint:path.basename(sprintPath),log})+"\n");
  write(sprintPath, read(sprintPath)+`\n\n---\n## Run Summary (${new Date().toLocaleString()})\n\n${makeSummary(log)}\n`);
  process.exit(log.some(r=>r.status==="fail")?1:0);
}
main();
