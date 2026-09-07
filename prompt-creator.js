const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PROMPT_CREATOR_PORT || 4174);
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434/api/chat';
const MODEL = process.env.PROMPT_CREATOR_MODEL || 'qwen3:8b';

const sessions = new Map();

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function html(res, body) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 100000) reject(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function normalizeMode(mode) {
  return mode === 'show-me-how' ? 'show-me-how' : 'just-do-it';
}

function systemPrompt(mode) {
  const modeRules = mode === 'show-me-how'
    ? `SHOW ME HOW MODE:
- Work with the user one useful question at a time.
- Ask only when the answer can materially improve the final prompt.
- Never ask for facts the AI could reasonably research, infer safely, or look up later.
- Do not ask multiple questions in one turn.
- Stop asking as soon as enough is known.`
    : `JUST DO IT MODE:
- Do as much of the work as possible without interrupting the user.
- Infer harmless details when reasonable and record them as assumptions.
- Identify facts that should be researched later instead of asking the user to know them.
- Ask a question only when the user's personal preference, constraint, or missing fact is truly required and proceeding without it would likely produce the wrong result.
- Prefer producing the finished prompt immediately.`;

  return `You are Prompt Creator, a support service for people who know what they want but may not know how to ask AI for it.

CORE PRINCIPLE:
The user supplies the intent. You discover the requirements. You identify what should be researched instead of burdening the user. You create a strong, executable prompt.

${modeRules}

OUTPUT RULES:
Return ONLY valid JSON, with no markdown fences, using this schema:
{
  "action": "question" | "prompt",
  "question": "one plain-language question or empty string",
  "prompt": "finished prompt or empty string",
  "assumptions": ["short assumption"],
  "research": ["fact the answering AI should research or verify"],
  "reason": "short internal-quality explanation suitable for a test log"
}

A finished prompt should preserve the user's goal, include relevant constraints, specify desired output, call out assumptions, and tell the answering AI what current facts it should research or verify. Do not invent precise facts that should instead be researched.`;
}

async function callOllama(messages, mode) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      format: 'json',
      messages: [{ role: 'system', content: systemPrompt(mode) }, ...messages]
    })
  });
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const data = await response.json();
  const raw = data?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('Model did not return valid JSON'); }
  if (!['question', 'prompt'].includes(parsed.action)) throw new Error('Model returned invalid action');
  return {
    action: parsed.action,
    question: typeof parsed.question === 'string' ? parsed.question.trim() : '',
    prompt: typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '',
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map(String) : [],
    research: Array.isArray(parsed.research) ? parsed.research.map(String) : [],
    reason: typeof parsed.reason === 'string' ? parsed.reason.trim() : ''
  };
}

function makeSession(mode, request) {
  const id = crypto.randomUUID();
  const session = {
    id,
    mode: normalizeMode(mode),
    request: String(request || '').trim(),
    messages: [],
    turns: 0,
    createdAt: Date.now()
  };
  sessions.set(id, session);
  return session;
}

async function advance(session, userText) {
  if (session.turns >= 12) {
    session.messages.push({ role: 'user', content: 'Stop asking questions. Create the best finished prompt now using what you know, and clearly mark assumptions or research needs.' });
  } else if (userText) {
    session.messages.push({ role: 'user', content: userText });
  }
  session.turns += 1;
  const result = await callOllama(session.messages, session.mode);

  if (result.action === 'question') {
    if (!result.question) throw new Error('Question action contained no question');
    session.messages.push({ role: 'assistant', content: result.question });
  } else {
    if (!result.prompt) throw new Error('Prompt action contained no prompt');
    session.messages.push({ role: 'assistant', content: result.prompt });
  }
  return result;
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Prompt Creator</title>
<style>
:root{font-family:Arial,Helvetica,sans-serif;color:#202124;background:#f6f7f8}*{box-sizing:border-box}body{margin:0}.wrap{max-width:850px;margin:0 auto;padding:24px}.card{background:white;border:1px solid #ddd;border-radius:14px;padding:22px;box-shadow:0 2px 8px rgba(0,0,0,.05)}h1{margin:0 0 8px}.sub{margin:0 0 20px;color:#555}.top{display:flex;justify-content:space-between;align-items:center;gap:12px}.toggle{display:flex;border:1px solid #aaa;border-radius:10px;overflow:hidden}.toggle button{border:0;padding:10px 14px;background:white;cursor:pointer}.toggle button.active{background:#202124;color:white}.about{border:0;background:transparent;text-decoration:underline;cursor:pointer}.messages{margin:20px 0;min-height:150px}.msg{padding:12px 14px;border-radius:10px;margin:10px 0;white-space:pre-wrap}.user{background:#eef3ff}.ai{background:#f0f0f0}.prompt{background:#eef8ee;border:1px solid #b7d8b7}.row{display:flex;gap:8px}textarea{width:100%;min-height:90px;padding:12px;font:inherit;border:1px solid #aaa;border-radius:10px;resize:vertical}button.primary{padding:0 18px;border:0;border-radius:10px;background:#202124;color:white;cursor:pointer}.small{font-size:13px;color:#666;margin-top:8px}.meta{margin-top:12px;padding:12px;background:#fafafa;border-radius:8px;font-size:14px}dialog{max-width:650px;border:0;border-radius:14px;padding:0;box-shadow:0 10px 35px rgba(0,0,0,.25)}dialog .inside{padding:24px}dialog h2{margin-top:0}.modebox{padding:12px;border:1px solid #ddd;border-radius:10px;margin:12px 0}dialog button{padding:9px 14px}.hidden{display:none}
</style>
</head>
<body>
<div class="wrap"><div class="card">
<div class="top"><div><h1>Prompt Creator</h1><p class="sub">Tell me what you want AI to help you accomplish.</p></div><button class="about" id="aboutBtn">About</button></div>
<div class="toggle" aria-label="Mode"><button id="just" class="active">Just Do It</button><button id="show">Show Me How</button></div>
<div class="small" id="modeHelp">I’ll do as much as possible myself and interrupt only when I truly need your input.</div>
<div class="messages" id="messages"></div>
<div class="row"><textarea id="input" placeholder="What would you like AI to help you accomplish?"></textarea><button class="primary" id="send">Send</button></div>
<div class="small" id="status"></div>
</div></div>
<dialog id="about"><div class="inside"><h2>How Prompt Creator Works</h2>
<p>You don’t need to know how to write a great AI prompt. Tell Prompt Creator what you’re trying to accomplish. It figures out what the AI needs to know.</p>
<div class="modebox"><strong>Just Do It</strong><p>Prompt Creator does as much of the work as possible for you. It can identify what should be researched, make reasonable assumptions, and build the request without stopping to ask unnecessary questions. It asks you something only when it truly needs your input.</p></div>
<div class="modebox"><strong>Show Me How</strong><p>Prompt Creator works with you. It asks one useful question at a time and helps you shape the request as you go. You don’t need to know which questions are important—the AI figures that out.</p></div>
<p><strong>You supply the intent. The AI discovers the requirements, identifies what should be researched, and helps produce the result.</strong></p>
<button id="closeAbout">Close</button></div></dialog>
<script>
let mode='just-do-it', sessionId=null, waiting=false;
const input=document.getElementById('input'), messages=document.getElementById('messages'), status=document.getElementById('status');
function add(text, cls){const d=document.createElement('div');d.className='msg '+cls;d.textContent=text;messages.appendChild(d);messages.scrollTop=messages.scrollHeight}
function setMode(next){if(sessionId && !confirm('Changing modes will start a new request. Continue?')) return;mode=next;sessionId=null;messages.innerHTML='';document.getElementById('just').classList.toggle('active',mode==='just-do-it');document.getElementById('show').classList.toggle('active',mode==='show-me-how');document.getElementById('modeHelp').textContent=mode==='just-do-it'?'I’ll do as much as possible myself and interrupt only when I truly need your input.':'I’ll ask one useful question at a time and help you shape the request.'}
document.getElementById('just').onclick=()=>setMode('just-do-it');document.getElementById('show').onclick=()=>setMode('show-me-how');
async function send(){if(waiting)return;const text=input.value.trim();if(!text)return;waiting=true;status.textContent='Thinking…';input.value='';add(text,'user');try{const url=sessionId?'/api/answer':'/api/start';const body=sessionId?{id:sessionId,answer:text}:{mode,request:text};const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');sessionId=data.id;if(data.action==='question'){add(data.question,'ai');}else{add(data.prompt,'prompt');let extra=[];if(data.assumptions?.length)extra.push('Assumptions:\n• '+data.assumptions.join('\n• '));if(data.research?.length)extra.push('Research/verify:\n• '+data.research.join('\n• '));if(extra.length)add(extra.join('\n\n'),'meta');sessionId=null;}status.textContent='';}catch(e){status.textContent='Error: '+e.message;}finally{waiting=false;}}
document.getElementById('send').onclick=send;input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
const dlg=document.getElementById('about');document.getElementById('aboutBtn').onclick=()=>dlg.showModal();document.getElementById('closeAbout').onclick=()=>dlg.close();
</script>
</body></html>`;

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') return html(res, PAGE);
    if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true, model: MODEL, port: PORT });

    if (req.method === 'POST' && req.url === '/api/start') {
      const body = await readBody(req);
      const request = String(body.request || '').trim();
      if (!request) return json(res, 400, { error: 'Tell me what you want AI to help you accomplish.' });
      const session = makeSession(body.mode, request);
      session.messages.push({ role: 'user', content: `My request: ${request}` });
      const result = await advance(session, '');
      return json(res, 200, { id: session.id, mode: session.mode, ...result });
    }

    if (req.method === 'POST' && req.url === '/api/answer') {
      const body = await readBody(req);
      const session = sessions.get(String(body.id || ''));
      if (!session) return json(res, 404, { error: 'That request has expired. Please start again.' });
      const answer = String(body.answer || '').trim();
      if (!answer) return json(res, 400, { error: 'Please answer the question or start again.' });
      const result = await advance(session, answer);
      if (result.action === 'prompt') sessions.delete(session.id);
      return json(res, 200, { id: session.id, mode: session.mode, ...result });
    }

    json(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    json(res, 500, { error: err.message || 'Unexpected error' });
  }
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Prompt Creator running at http://127.0.0.1:${PORT}`);
    console.log(`Model: ${MODEL}`);
  });
}

module.exports = { normalizeMode, systemPrompt, makeSession };
