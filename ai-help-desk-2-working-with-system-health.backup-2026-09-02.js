const http = require("http");
const { exec } = require("child_process");
const crypto = require("crypto");

const HOST = "127.0.0.1";
const PORT = 4173;
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";
const MODEL = "qwen3:4b";
const MAX_QUESTIONS = 3;

const sessions = new Map();

const { promisify } = require("util");
const execAsync = promisify(exec);

async function runPowerShellJson(script) {
  if (process.platform !== "win32") return null;

  const encoded = Buffer.from(script, "utf16le").toString("base64");

  try {
    const { stdout } = await execAsync(
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
      {
        timeout: 15000,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 4
      }
    );

    const text = stdout.trim();
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("System Health collection failed:", error.message);
    return null;
  }
}

function gb(bytes) {
  return Math.round((Number(bytes || 0) / 1073741824) * 10) / 10;
}

async function collectSystemHealth() {
  if (process.platform !== "win32") {
    return {
      supported: false,
      overall: "unknown",
      alerts: [],
      notes: ["System Health currently supports Windows."]
    };
  }

  const ps = `
$ErrorActionPreference = 'SilentlyContinue'

$os = Get-CimInstance Win32_OperatingSystem
$cs = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$bios = Get-CimInstance Win32_BIOS
$disks = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" |
  Select-Object DeviceID,VolumeName,Size,FreeSpace)

$printers = @(Get-CimInstance Win32_Printer |
  Select-Object Name,Default,WorkOffline,PrinterStatus)

$deviceProblems = @(
  Get-PnpDevice |
  Where-Object { $_.Status -ne 'OK' } |
  Select-Object -First 20 Class,FriendlyName,Status,Problem
)

$defender = Get-MpComputerStatus

$pendingReboot =
  (Test-Path 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\WindowsUpdate\\Auto Update\\RebootRequired') -or
  (Test-Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\PendingFileRenameOperations')

$defaultMail = (Get-ItemProperty 'HKCU:\\Software\\Clients\\Mail').'(default)'
$outlookProfile = (Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Office\\16.0\\Outlook').DefaultProfile

$wifiText = @(netsh wlan show interfaces)
$ssid = $null
$signal = $null
$wifiState = $null
foreach ($line in $wifiText) {
  if ($line -match '^\\s*State\\s*:\\s*(.+)$') {
    $wifiState = $Matches[1].Trim()
  }
  elseif ($line -match '^\\s*SSID\\s*:\\s*(.+)$' -and $line -notmatch 'BSSID') {
    $ssid = $Matches[1].Trim()
  }
  elseif ($line -match '^\\s*Signal\\s*:\\s*(.+)$') {
    $signal = $Matches[1].Trim()
  }
}

$audio = $null
try {
  $sound = Get-CimInstance Win32_SoundDevice | Where-Object { $_.Status -eq 'OK' } | Select-Object -First 1
  $audio = [pscustomobject]@{
    device = $sound.Name
    status = $sound.Status
    muted = $null
    volume = $null
  }
} catch {}

$updates = @()
try {
  $session = New-Object -ComObject Microsoft.Update.Session
  $searcher = $session.CreateUpdateSearcher()
  $result = $searcher.Search("IsInstalled=0 and Type='Software'")
  foreach ($u in $result.Updates) { $updates += $u.Title }
} catch {}

[pscustomobject]@{
  computer = [pscustomobject]@{
    manufacturer = $cs.Manufacturer
    model = $cs.Model
    ramBytes = $cs.TotalPhysicalMemory
    cpu = $cpu.Name
    bios = $bios.SMBIOSBIOSVersion
  }
  windows = [pscustomobject]@{
    caption = $os.Caption
    version = $os.Version
    build = $os.BuildNumber
    lastBoot = $os.LastBootUpTime
    pendingReboot = $pendingReboot
    pendingUpdates = $updates
  }
  disks = $disks
  wifi = [pscustomobject]@{
    state = $wifiState
    ssid = $ssid
    signal = $signal
  }
  audio = $audio
  printers = $printers
  deviceProblems = $deviceProblems
  security = [pscustomobject]@{
    antivirusEnabled = $defender.AntivirusEnabled
    realtimeProtection = $defender.RealTimeProtectionEnabled
    signaturesAgeDays = $defender.AntivirusSignatureAge
  }
  email = [pscustomobject]@{
    defaultClient = $defaultMail
    outlookDefaultProfile = $outlookProfile
  }
} | ConvertTo-Json -Depth 6 -Compress
`;

  const data = await runPowerShellJson(ps);

  if (!data) {
    return {
      supported: true,
      overall: "unknown",
      alerts: [],
      notes: ["Windows did not return system-health information."]
    };
  }

  const alerts = [];
  const notes = [];

  data.computer = data.computer || {};
  data.computer.ramGB = gb(data.computer.ramBytes);

  data.disks = Array.isArray(data.disks) ? data.disks : (data.disks ? [data.disks] : []);
  for (const disk of data.disks) {
    disk.sizeGB = gb(disk.Size);
    disk.freeGB = gb(disk.FreeSpace);
    disk.freePercent = Number(disk.Size)
      ? Math.round((Number(disk.FreeSpace) / Number(disk.Size)) * 100)
      : null;

    if (
      disk.freePercent !== null &&
      (disk.freePercent < 10 || disk.freeGB < 15)
    ) {
      alerts.push(`${disk.DeviceID} is low on disk space (${disk.freeGB} GB free).`);
    }
  }

  data.printers = Array.isArray(data.printers)
    ? data.printers
    : (data.printers ? [data.printers] : []);

  data.deviceProblems = Array.isArray(data.deviceProblems)
    ? data.deviceProblems
    : (data.deviceProblems ? [data.deviceProblems] : []);

  if (!data.wifi || String(data.wifi.state || "").toLowerCase() !== "connected") {
    notes.push("Wi-Fi is not currently connected.");
  }

  if (data.windows && data.windows.pendingReboot) {
    alerts.push("Windows has a restart waiting to be completed.");
  }

  if (
    data.windows &&
    Array.isArray(data.windows.pendingUpdates) &&
    data.windows.pendingUpdates.length
  ) {
    notes.push(`${data.windows.pendingUpdates.length} Windows software update(s) are available.`);
  }

  if (
    data.security &&
    (data.security.antivirusEnabled === false ||
     data.security.realtimeProtection === false)
  ) {
    alerts.push("Windows Security protection may be turned off.");
  }

  if (
    data.security &&
    Number(data.security.signaturesAgeDays) > 7
  ) {
    notes.push(`Windows Security definitions are ${data.security.signaturesAgeDays} days old.`);
  }

  if (data.deviceProblems.length) {
    notes.push(`${data.deviceProblems.length} device(s) report a Windows status problem.`);
  }

  /*
    Windows does not expose the current speaker mute state through the simple
    built-in management interfaces on every machine. The dashboard reports the
    audio device now; mute/volume are deliberately shown as "Not available"
    rather than guessed. We can add a signed helper later for exact mute state.
  */

  return {
    supported: true,
    overall: alerts.length ? "attention" : "good",
    alerts,
    notes,
    ...data
  };
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(html),
    "Cache-Control": "no-store"
  });
  res.end(html);
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function normalizeQuestion(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?.!]+$/, "");
}

function sessionFor(id) {
  if (!sessions.has(id)) {
    sessions.set(id, {
      problem: "",
      questionCount: 0,
      facts: {},
      askedKeys: new Set(),
      askedQuestions: new Set(),
      pendingKey: null,
      pendingQuestion: null,
      history: []
    });
  }
  return sessions.get(id);
}

function factsAsText(s) {
  const entries = Object.entries(s.facts);
  if (!entries.length) return "None yet.";
  return entries.map(([k,v]) => `- ${k}: ${v}`).join("\n");
}

function historyAsText(s) {
  if (!s.history.length) return "None yet.";
  return s.history.slice(-12).join("\n");
}

async function callOllama(prompt) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      think: false,
      messages: [
        {
          role: "system",
          content:
`You are the reasoning component of AI Help Desk.

Your job is to help a nontechnical person solve ordinary technology problems using ASK → SOLVE → ESCALATE.

Hard rules:
- Ask exactly ONE simple, observable question at a time.
- Do not repeat a question or ask for evidence that is already known.
- Prefer observation before disruption.
- Do not recommend restarting, resetting, reinstalling, updating drivers, changing administrator settings, opening hardware, or other disruptive actions unless the evidence specifically supports it.
- Do not claim a cause unless the evidence distinguishes it from reasonable alternatives.
- When the evidence supports a low-risk solution, return SOLVE.
- When the cause cannot be reliably determined, or safe remote troubleshooting would become speculative, repetitive, risky, administrator-level, hardware-level, or disruptive, return ESCALATE.
- Use plain English. Avoid jargon.
- For scams or suspicious messages, never tell the user to click a link, call a number in the message, install software, share a code, or send money.
- Do not invent facts.

Return only JSON matching the required schema.`
        },
        { role: "user", content: prompt }
      ],
      format: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["QUESTION", "SOLVE", "ESCALATE"] },
          evidence_key: { type: "string" },
          question: { type: "string" },
          answer: { type: "string" },
          summary: { type: "string" }
        },
        required: ["action", "evidence_key", "question", "answer", "summary"]
      },
      options: {
        temperature: 0,
        num_predict: 220
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!data.message || !data.message.content) {
    throw new Error("The local AI returned no response.");
  }

  let parsed;
  try {
    parsed = JSON.parse(data.message.content);
  } catch {
    throw new Error("The local AI returned invalid structured output.");
  }
  return parsed;
}

async function getNextStep(s) {
  if (s.questionCount >= MAX_QUESTIONS) {
    return {
      action: "ESCALATE",
      summary:
        "I do not have enough reliable evidence to determine the cause without guessing. " +
        "A support person should take over. Useful evidence gathered:\n" + factsAsText(s)
    };
  }

  const forbiddenKeys = [...s.askedKeys].join(", ") || "none";
  const forbiddenQuestions = [...s.askedQuestions].join(" | ") || "none";

  const prompt =
`Original problem:
${s.problem}

Known evidence:
${factsAsText(s)}

Conversation:
${historyAsText(s)}

Evidence keys already requested (DO NOT USE AGAIN):
${forbiddenKeys}

Questions already asked (DO NOT REPEAT OR REPHRASE):
${forbiddenQuestions}

Decide the single best next step.

If more evidence is needed:
- action = "QUESTION"
- evidence_key = a short stable snake_case name for the ONE unknown fact
- question = one natural question ending in ?
- answer = ""
- summary = ""

If the evidence supports a safe, specific solution:
- action = "SOLVE"
- evidence_key = ""
- question = ""
- answer = one concise solution or action, in plain English
- summary = one sentence explaining why the evidence supports it

If we cannot safely determine the cause:
- action = "ESCALATE"
- evidence_key = ""
- question = ""
- answer = ""
- summary = a concise handoff including the useful evidence gathered.`;

  // Give the model two chances to avoid a repeat. The controller, not the model,
  // owns the repeat protection.
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await callOllama(prompt + (attempt ? "\nYour previous choice duplicated known evidence. Choose a DIFFERENT unknown." : ""));
    const action = String(result.action || "").toUpperCase();

    if (action === "QUESTION") {
      const key = String(result.evidence_key || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      const q = String(result.question || "").trim();
      const nq = normalizeQuestion(q);

      if (!key || !q.endsWith("?")) continue;
      if (s.askedKeys.has(key)) continue;
      if (s.askedQuestions.has(nq)) continue;

      s.questionCount++;
      s.pendingKey = key;
      s.pendingQuestion = q;
      s.askedKeys.add(key);
      s.askedQuestions.add(nq);
      s.history.push(`Help Desk: ${q}`);
      return { action: "QUESTION", question: q, key, questionCount: s.questionCount };
    }

    if (action === "SOLVE") {
      const answer = String(result.answer || "").trim();
      if (!answer) continue;
      s.history.push(`Help Desk solution: ${answer}`);
      return {
        action: "SOLVE",
        answer,
        summary: String(result.summary || "").trim()
      };
    }

    if (action === "ESCALATE") {
      const summary = String(result.summary || "").trim() ||
        `I cannot reliably determine the cause from the available evidence.\n${factsAsText(s)}`;
      s.history.push(`Help Desk escalated: ${summary}`);
      return { action: "ESCALATE", summary };
    }
  }

  return {
    action: "ESCALATE",
    summary:
      "The local AI could not produce a new, reliable diagnostic step without repeating itself. " +
      "Useful evidence gathered:\n" + factsAsText(s)
  };
}

async function startSession(problem) {
  const id = crypto.randomUUID();
  const s = sessionFor(id);
  s.problem = problem.trim();
  s.history.push(`User problem: ${s.problem}`);
  const step = await getNextStep(s);
  return { sessionId: id, step, facts: s.facts };
}

async function answerSession(id, answer) {
  const s = sessions.get(id);
  if (!s) throw new Error("Session expired. Start again.");
  const value = String(answer || "").trim();
  if (!value) throw new Error("Please answer the question first.");

  if (s.pendingKey) {
    s.facts[s.pendingKey] = value;
  }
  s.history.push(`User: ${value}`);
  s.pendingKey = null;
  s.pendingQuestion = null;

  const step = await getNextStep(s);
  return { sessionId: id, step, facts: s.facts };
}

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Help Desk 2.0</title>
<style>
:root{
  --bg:#f3f6fb;--panel:#fff;--ink:#172033;--muted:#687386;--line:#e5eaf1;
  --accent:#4f46e5;--accent2:#7c3aed;--soft:#eef2ff;--good:#15803d;
  --warn:#a16207;--shadow:0 18px 55px rgba(23,32,51,.10)
}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;background:radial-gradient(circle at 8% 0%,#eef2ff 0,transparent 34%),var(--bg);color:var(--ink)}
button,input{font:inherit}
.shell{min-height:100vh;display:grid;grid-template-columns:250px 1fr}
.side{padding:28px 20px;border-right:1px solid var(--line);background:rgba(255,255,255,.80);backdrop-filter:blur(16px)}
.brand{display:flex;align-items:center;gap:12px;font-weight:800;font-size:19px}
.logo{width:39px;height:39px;border-radius:12px;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;color:#fff;font-weight:900;box-shadow:0 8px 20px rgba(79,70,229,.25)}
.status{margin:28px 0 20px;padding:14px;border:1px solid #d9f0df;background:#f0fdf4;border-radius:14px;font-size:13px;color:#166534}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;margin-right:8px}
.nav{display:grid;gap:8px}.nav div{padding:12px 14px;border-radius:12px;color:#697386;font-size:14px}.nav .active{background:var(--soft);color:#3730a3;font-weight:700}
.navBtn{border:0;background:transparent;text-align:left;padding:12px 14px;border-radius:12px;color:#697386;font-size:14px;cursor:pointer}
.navBtn.active{background:var(--soft);color:#3730a3;font-weight:700}
.dashboard{display:none}
.dashboard.show{display:block}
.dashboardHeader{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}
.dashboardHeader h2{margin:0;font-size:28px;letter-spacing:-.5px}
.dashboardHeader p{margin:7px 0 0;color:var(--muted);line-height:1.5}
.healthBanner{border:1px solid var(--line);border-radius:18px;padding:18px;background:#fff;margin-bottom:16px}
.healthBanner.good{background:#f0fdf4;border-color:#ccebd4}
.healthBanner.attention{background:#fff7ed;border-color:#fed7aa}
.healthBanner.unknown{background:#f8fafc}
.healthTitle{font-size:17px;font-weight:800;margin-bottom:5px}
.healthText{font-size:13px;color:#667085;line-height:1.5}
.healthGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.healthCard{background:#fff;border:1px solid var(--line);border-radius:16px;padding:17px;min-width:0}
.healthCard h3{margin:0 0 12px;font-size:14px}
.metric{display:flex;justify-content:space-between;gap:14px;padding:7px 0;border-top:1px solid #f1f3f6;font-size:12px}
.metric:first-of-type{border-top:0}
.metric span:first-child{color:#667085}
.metric span:last-child{text-align:right;font-weight:650;overflow-wrap:anywhere}
.alertList{display:grid;gap:8px;margin-top:12px}
.alertItem{font-size:13px;padding:10px 12px;border-radius:11px;background:#fff7ed;border:1px solid #fed7aa}
.noteItem{font-size:13px;padding:10px 12px;border-radius:11px;background:#f8fafc;border:1px solid var(--line)}
.refreshBtn{border:1px solid var(--line);background:#fff;color:#344054;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer}
.sectionHidden{display:none!important}
.loadingHealth{padding:28px;text-align:center;color:#667085}
@media(max-width:1000px){.healthGrid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:650px){.healthGrid{grid-template-columns:1fr}.dashboardHeader{flex-direction:column}}

.small{position:absolute;bottom:26px;color:#98a2b3;font-size:12px}
.main{padding:34px;display:flex;justify-content:center}
.content{width:min(1050px,100%)}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}
.eyebrow{font-size:13px;color:#667085}.top h1{margin:3px 0 0;font-size:28px;letter-spacing:-.5px}
.pill{font-size:12px;background:#fff;border:1px solid var(--line);padding:9px 12px;border-radius:999px;color:#475467}
.hero{background:linear-gradient(135deg,#fff 20%,#f7f5ff 100%);border:1px solid var(--line);border-radius:24px;padding:34px;box-shadow:var(--shadow)}
.hero h2{font-size:34px;line-height:1.08;letter-spacing:-1px;margin:0 0 13px}
.hero p{color:var(--muted);font-size:16px;line-height:1.6;margin:0 0 24px}
.ask{display:flex;gap:10px;background:#fff;border:1px solid #dfe4ec;border-radius:16px;padding:8px 8px 8px 16px;box-shadow:0 6px 20px rgba(23,32,51,.06)}
.ask input{flex:1;border:0;outline:0;font-size:15px;color:var(--ink);min-width:0}
.primary{border:0;border-radius:12px;padding:13px 19px;background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;font-weight:750;cursor:pointer}
.primary:disabled{opacity:.55;cursor:wait}
.examples{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.chip{font-size:12px;color:#475467;background:#f8fafc;border:1px solid var(--line);border-radius:999px;padding:7px 10px;cursor:pointer}
.chat{display:none;margin-top:20px;background:#fff;border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:0 10px 32px rgba(23,32,51,.06)}
.chat.show{display:block}
.transcript{display:grid;gap:12px;max-height:420px;overflow:auto;padding-right:4px}
.msg{max-width:78%;padding:13px 15px;border-radius:15px;line-height:1.45;font-size:14px;white-space:pre-wrap}
.user{justify-self:end;background:#eef2ff;color:#312e81;border-radius:15px 15px 5px 15px}
.ai{justify-self:start;background:#f8fafc;border:1px solid var(--line);border-radius:15px 15px 15px 5px}
.ai.solve{background:#f0fdf4;border-color:#ccebd4}.ai.escalate{background:#fff7ed;border-color:#fed7aa}
.answerRow{display:flex;gap:10px;margin-top:16px}
.answerRow input{flex:1;border:1px solid #dfe4ec;border-radius:13px;padding:13px 14px;outline:none}
.answerRow input:focus{border-color:#a5b4fc;box-shadow:0 0 0 3px #eef2ff}
.evidence{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}
.evidence h3{font-size:12px;color:#667085;margin:0 0 9px;text-transform:uppercase;letter-spacing:.08em}
.factGrid{display:flex;gap:8px;flex-wrap:wrap}.fact{background:#f8fafc;border:1px solid var(--line);padding:7px 10px;border-radius:999px;font-size:12px;color:#475467}
.cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:18px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:17px;min-height:122px;box-shadow:0 6px 20px rgba(23,32,51,.04);cursor:pointer;transition:.15s}
.card:hover{transform:translateY(-2px);box-shadow:0 10px 25px rgba(23,32,51,.08)}
.icon{font-size:23px}.card b{display:block;margin:12px 0 5px;font-size:14px}.card span{font-size:12px;line-height:1.35;color:var(--muted)}
.footer{display:flex;justify-content:space-between;align-items:center;margin-top:18px;color:#98a2b3;font-size:12px}.footer strong{color:#475467}
.error{display:none;margin-top:14px;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;padding:12px 14px;border-radius:12px;font-size:13px}.error.show{display:block}
@media(max-width:850px){.shell{grid-template-columns:1fr}.side{display:none}.main{padding:18px}.hero{padding:24px}.cards{grid-template-columns:repeat(2,1fr)}.hero h2{font-size:29px}.msg{max-width:92%}}
</style>
</head>
<body>
<div class="shell">
<aside class="side">
  <div class="brand"><div class="logo">A</div><div>AI Help Desk</div></div>
  <div class="status"><span class="dot"></span>Local AI ready</div>
  <div class="nav">
    <button class="navBtn active" id="helpNav">⌂ &nbsp; Get help</button>
    <button class="navBtn" id="systemNav">▦ &nbsp; System Health</button>
    <div>◷ &nbsp; Recent issues</div>
    <div>▣ &nbsp; My devices</div>
    <div>♡ &nbsp; Safety & scams</div>
  </div>
  <div class="small">2.0 • ASK → SOLVE → ESCALATE</div>
</aside>

<main class="main">
<div class="content">
  <div class="top">
    <div><div class="eyebrow">Friendly technology support</div><h1>What can I help you fix?</h1></div>
    <div class="pill">Private • Local AI • One step at a time</div>
  </div>


  <section id="systemDashboard" class="dashboard">
    <div class="dashboardHeader">
      <div>
        <div class="eyebrow">At-a-glance status</div>
        <h2>System Health</h2>
        <p>Basic information that can explain common problems before troubleshooting begins.</p>
      </div>
      <button class="refreshBtn" id="refreshHealth">Refresh</button>
    </div>

    <div id="healthBanner" class="healthBanner unknown">
      <div class="healthTitle">Checking this computer…</div>
      <div class="healthText">Reading Windows, storage, Wi-Fi, printers, security and device status.</div>
    </div>

    <div id="healthLoading" class="loadingHealth">Collecting system information…</div>
    <div id="healthGrid" class="healthGrid"></div>
    <div id="healthAlerts" class="alertList"></div>
  </section>

  <section class="hero" id="helpHero">
    <h2>Tell me what’s happening.<br>I’ll help narrow it down.</h2>
    <p>You don’t need the technical words. Describe what you see, what you expected, or what happened when you clicked.</p>
    <div class="ask">
      <input id="problem" placeholder="Example: I can’t get into my email…">
      <button class="primary" id="start">Start</button>
    </div>
    <div class="examples">
      <button class="chip">My printer won't print</button>
      <button class="chip">I can't sign in to my email</button>
      <button class="chip">Is this text message a scam?</button>
      <button class="chip">My Wi-Fi keeps disconnecting</button>
    </div>
    <div id="error" class="error"></div>
  </section>

  <section id="chat" class="chat">
    <div id="transcript" class="transcript"></div>
    <div id="answerRow" class="answerRow">
      <input id="answer" placeholder="Type your answer…">
      <button class="primary" id="send">Send</button>
    </div>
    <div class="evidence">
      <h3>Evidence gathered</h3>
      <div id="facts" class="factGrid"><span class="fact">Nothing yet</span></div>
    </div>
  </section>

  <div class="cards" id="helpCards">
    <div class="card" data-prompt="I can't get into one of my accounts."><div class="icon">🔐</div><b>Account access</b><span>Password, verification codes, 2FA and locked accounts.</span></div>
    <div class="card" data-prompt="My internet or Wi-Fi is not working correctly."><div class="icon">📶</div><b>Internet & Wi‑Fi</b><span>Slow, disconnected or unreliable connections.</span></div>
    <div class="card" data-prompt="I received a suspicious message and want to know if it is a scam."><div class="icon">🛡️</div><b>Scam check</b><span>Suspicious emails, texts, pop-ups and calls.</span></div>
    <div class="card" data-prompt="I need help understanding what is on my screen."><div class="icon">📷</div><b>Show me</b><span>Describe what is on screen. Screenshot vision comes next.</span></div>
    <div class="card" data-prompt="I need help setting something up."><div class="icon">⚙️</div><b>Set something up</b><span>Guided setup without jargon or guesswork.</span></div>
  </div>

  <div class="footer" id="helpFooter">
    <div><strong>ASK</strong> one useful question → <strong>SOLVE</strong> when evidence is enough → <strong>ESCALATE</strong> when it isn't</div>
    <div>No wild goose chases.</div>
  </div>
</div>
</main>
</div>

<script>
const problem = document.getElementById("problem");
const start = document.getElementById("start");
const chat = document.getElementById("chat");
const transcript = document.getElementById("transcript");
const answerRow = document.getElementById("answerRow");
const answer = document.getElementById("answer");
const send = document.getElementById("send");
const facts = document.getElementById("facts");
const errorBox = document.getElementById("error");
let sessionId = null;

const helpNav = document.getElementById("helpNav");
const systemNav = document.getElementById("systemNav");
const systemDashboard = document.getElementById("systemDashboard");
const helpHero = document.getElementById("helpHero");
const helpCards = document.getElementById("helpCards");
const helpFooter = document.getElementById("helpFooter");
const refreshHealth = document.getElementById("refreshHealth");
const healthBanner = document.getElementById("healthBanner");
const healthLoading = document.getElementById("healthLoading");
const healthGrid = document.getElementById("healthGrid");
const healthAlerts = document.getElementById("healthAlerts");

function safe(v, fallback="Not available"){
  return (v === null || v === undefined || v === "") ? fallback : String(v);
}
function boolText(v){
  if(v === true) return "Yes";
  if(v === false) return "No";
  return "Not available";
}
function card(title, rows){
  const el=document.createElement("div");
  el.className="healthCard";
  const h=document.createElement("h3");
  h.textContent=title;
  el.appendChild(h);
  for(const [label,value] of rows){
    const r=document.createElement("div");
    r.className="metric";
    const a=document.createElement("span");
    const b=document.createElement("span");
    a.textContent=label;
    b.textContent=safe(value);
    r.append(a,b);
    el.appendChild(r);
  }
  return el;
}
function showHelp(){
  systemDashboard.classList.remove("show");
  helpHero.classList.remove("sectionHidden");
  chat.classList.remove("sectionHidden");
  helpCards.classList.remove("sectionHidden");
  helpFooter.classList.remove("sectionHidden");
  helpNav.classList.add("active");
  systemNav.classList.remove("active");
}
async function showSystem(){
  helpHero.classList.add("sectionHidden");
  chat.classList.add("sectionHidden");
  helpCards.classList.add("sectionHidden");
  helpFooter.classList.add("sectionHidden");
  systemDashboard.classList.add("show");
  systemNav.classList.add("active");
  helpNav.classList.remove("active");
  await loadSystemHealth();
}
async function loadSystemHealth(){
  healthLoading.style.display="block";
  healthGrid.innerHTML="";
  healthAlerts.innerHTML="";
  healthBanner.className="healthBanner unknown";
  healthBanner.querySelector(".healthTitle").textContent="Checking this computer…";
  healthBanner.querySelector(".healthText").textContent="Reading Windows, storage, Wi-Fi, printers, security and device status.";

  try{
    const r=await fetch("/api/system-health");
    const d=await r.json();
    healthLoading.style.display="none";

    const overall=d.overall || "unknown";
    healthBanner.className="healthBanner "+overall;

    if(overall==="good"){
      healthBanner.querySelector(".healthTitle").textContent="Overall health looks good";
      healthBanner.querySelector(".healthText").textContent="No basic system-health warning was detected.";
    }else if(overall==="attention"){
      healthBanner.querySelector(".healthTitle").textContent="A few things need attention";
      healthBanner.querySelector(".healthText").textContent="These may help explain a problem before deeper troubleshooting.";
    }else{
      healthBanner.querySelector(".healthTitle").textContent="Some health information is unavailable";
      healthBanner.querySelector(".healthText").textContent=safe(d.error || (d.notes && d.notes[0]),"The system could not be fully inspected.");
    }

    const c=d.computer||{};
    const w=d.windows||{};
    const wi=d.wifi||{};
    const a=d.audio||{};
    const s=d.security||{};
    const e=d.email||{};

    healthGrid.appendChild(card("Computer",[
      ["Manufacturer",c.manufacturer],
      ["Model",c.model],
      ["Processor",c.cpu],
      ["Memory",c.ramGB ? c.ramGB+" GB" : null],
      ["BIOS",c.bios]
    ]));

    healthGrid.appendChild(card("Windows",[
      ["Edition",w.caption],
      ["Version",w.version],
      ["Build",w.build],
      ["Restart waiting",boolText(w.pendingReboot)],
      ["Updates available",Array.isArray(w.pendingUpdates)?w.pendingUpdates.length:null]
    ]));

    const diskRows=[];
    for(const disk of (d.disks||[])){
      diskRows.push([
        safe(disk.DeviceID)+" free",
        disk.freeGB!=null ? disk.freeGB+" GB ("+disk.freePercent+"%)" : null
      ]);
    }
    healthGrid.appendChild(card("Storage",diskRows.length?diskRows:[["Disk space","Not available"]]));

    healthGrid.appendChild(card("Wi-Fi",[
      ["Status",wi.state],
      ["Network",wi.ssid],
      ["Signal",wi.signal]
    ]));

    healthGrid.appendChild(card("Sound",[
      ["Device",a.device],
      ["Device status",a.status],
      ["Muted","Not available yet"],
      ["Volume","Not available yet"]
    ]));

    const printerRows=[];
    for(const p of (d.printers||[])){
      printerRows.push([
        p.Default ? "Default printer" : "Printer",
        p.Name + (p.WorkOffline ? " • Offline" : "")
      ]);
    }
    healthGrid.appendChild(card("Printers",printerRows.length?printerRows:[["Connected printers","None found"]]));

    healthGrid.appendChild(card("Security",[
      ["Antivirus enabled",boolText(s.antivirusEnabled)],
      ["Real-time protection",boolText(s.realtimeProtection)],
      ["Definition age",s.signaturesAgeDays!=null?s.signaturesAgeDays+" day(s)":null]
    ]));

    healthGrid.appendChild(card("Email",[
      ["Default mail app",e.defaultClient],
      ["Outlook profile",e.outlookDefaultProfile],
      ["Passwords","Never displayed"]
    ]));

    healthGrid.appendChild(card("Peripherals & devices",[
      ["Devices reporting problems",Array.isArray(d.deviceProblems)?d.deviceProblems.length:null],
      ["Health source","Windows device status"]
    ]));

    for(const text of (d.alerts||[])){
      const el=document.createElement("div");
      el.className="alertItem";
      el.textContent="Attention: "+text;
      healthAlerts.appendChild(el);
    }
    for(const text of (d.notes||[])){
      const el=document.createElement("div");
      el.className="noteItem";
      el.textContent=text;
      healthAlerts.appendChild(el);
    }
  }catch(err){
    healthLoading.style.display="none";
    healthBanner.className="healthBanner unknown";
    healthBanner.querySelector(".healthTitle").textContent="System Health could not run";
    healthBanner.querySelector(".healthText").textContent=err.message;
  }
}
helpNav.addEventListener("click",showHelp);
systemNav.addEventListener("click",showSystem);
refreshHealth.addEventListener("click",loadSystemHealth);

function error(msg){
  errorBox.textContent = msg;
  errorBox.classList.toggle("show", !!msg);
}
function addMessage(text, who, kind=""){
  const d=document.createElement("div");
  d.className="msg "+who+(kind ? " "+kind : "");
  d.textContent=text;
  transcript.appendChild(d);
  transcript.scrollTop=transcript.scrollHeight;
}
function renderFacts(obj){
  facts.innerHTML="";
  const entries=Object.entries(obj||{});
  if(!entries.length){
    facts.innerHTML='<span class="fact">Nothing yet</span>';
    return;
  }
  for(const [k,v] of entries){
    const span=document.createElement("span");
    span.className="fact";
    span.textContent=k.replaceAll("_"," ")+" = "+v;
    facts.appendChild(span);
  }
}
function renderStep(step){
  if(step.action==="QUESTION"){
    addMessage(step.question,"ai");
    answerRow.style.display="flex";
    answer.disabled=false; send.disabled=false;
    answer.value=""; answer.focus();
  } else if(step.action==="SOLVE"){
    let text="Try this:\\n"+step.answer;
    if(step.summary) text+="\\n\\nWhy: "+step.summary;
    addMessage(text,"ai","solve");
    answerRow.style.display="none";
  } else {
    addMessage("I’m going to stop here rather than guess.\\n\\n"+step.summary,"ai","escalate");
    answerRow.style.display="none";
  }
}
async function post(url, body){
  const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
async function begin(text){
  text=(text||problem.value).trim();
  if(!text){error("Tell me what is happening first.");problem.focus();return;}
  error("");
  start.disabled=true;
  transcript.innerHTML="";
  addMessage(text,"user");
  chat.classList.add("show");
  answerRow.style.display="none";
  try{
    const data=await post("/api/start",{problem:text});
    sessionId=data.sessionId;
    renderFacts(data.facts);
    renderStep(data.step);
  }catch(e){error(e.message);}
  finally{start.disabled=false;}
}
async function reply(){
  const text=answer.value.trim();
  if(!text||!sessionId) return;
  error("");
  addMessage(text,"user");
  answer.disabled=true;send.disabled=true;
  try{
    const data=await post("/api/answer",{sessionId,answer:text});
    renderFacts(data.facts);
    renderStep(data.step);
  }catch(e){error(e.message);answer.disabled=false;send.disabled=false;}
}
start.onclick=()=>begin();
send.onclick=reply;
problem.addEventListener("keydown",e=>{if(e.key==="Enter")begin();});
answer.addEventListener("keydown",e=>{if(e.key==="Enter")reply();});
document.querySelectorAll(".chip").forEach(c=>c.onclick=()=>{problem.value=c.textContent;begin(c.textContent);});
document.querySelectorAll(".card").forEach(c=>c.onclick=()=>{problem.value=c.dataset.prompt;problem.focus();});
</script>
</body>
</html>`;

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      return sendHtml(res, HTML);
    }
    if (req.method === "GET" && req.url === "/api/system-health") {
      const result = await collectSystemHealth();
      return sendJson(res, 200, result);
    }
    if (req.method === "GET" && req.url === "/api/health") {
      try {
        const r = await fetch("http://127.0.0.1:11434/api/tags");
        if (!r.ok) throw new Error();
        return sendJson(res, 200, { ok: true, model: MODEL });
      } catch {
        return sendJson(res, 503, { ok: false, error: "Ollama is not reachable." });
      }
    }
    if (req.method === "POST" && req.url === "/api/start") {
      const body = await readJson(req);
      const problem = String(body.problem || "").trim();
      if (!problem) return sendJson(res, 400, { error: "Tell me what is happening first." });
      const result = await startSession(problem);
      return sendJson(res, 200, result);
    }
    if (req.method === "POST" && req.url === "/api/answer") {
      const body = await readJson(req);
      const result = await answerSession(String(body.sessionId || ""), body.answer);
      return sendJson(res, 200, result);
    }
    sendJson(res, 404, { error: "Not found" });
  } catch (e) {
    console.error(e);
    sendJson(res, 500, { error: e.message || "Unexpected error" });
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log("");
  console.log("AI Help Desk 2.0 is running.");
  console.log(`Open: ${url}`);
  console.log("");
  console.log("Leave this window open while using AI Help Desk.");
  console.log("Press Ctrl+C to stop it.");
  console.log("");

  if (process.platform === "win32") {
    exec(`start "" "${url}"`);
  } else if (process.platform === "darwin") {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
});
