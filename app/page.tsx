'use client';

import { FormEvent, useMemo, useState } from 'react';

type Message = { role: 'helper' | 'user'; text: string; ai?: boolean };

const topics = [
  { icon: '◉', title: 'Internet', prompt: 'My internet is not working' },
  { icon: '▣', title: 'Printer', prompt: 'My printer will not print' },
  { icon: '✉', title: 'Email', prompt: 'My email is not working' },
  { icon: '▤', title: 'Google Tasks', prompt: 'My Google Tasks are missing' },
];

const welcome = 'Tell me what is not working. I’ll ask one simple question at a time.';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([{ role: 'helper', text: welcome }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const hasStarted = messages.length > 1;
  const status = useMemo(() => busy ? 'Thinking…' : 'Ready to help', [busy]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    const conversation = [...messages, { role: 'user' as const, text: clean }];
    setMessages(conversation);
    setInput('');
    setBusy(true);
    try {
      const response = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation }),
      });
      const data = await response.json() as { reply?: string; error?: string; aiUsed?: boolean };
      if (!response.ok || !data.reply) throw new Error(data.error || 'Something went wrong.');
      setMessages((current) => [...current, { role: 'helper', text: data.reply!, ai: data.aiUsed }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'helper', text: error instanceof Error ? error.message : 'Please try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(input); }
  function reset() { setMessages([{ role: 'helper', text: welcome }]); setInput(''); }

  return (
    <main>
      <header className="topbar">
        <a className="logo" href="#top" aria-label="AI Help Desk home"><span>AI</span> Help Desk</a>
        <div className="availability"><i /> Available now</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Friendly technology help</p>
          <h1>Let’s get it<br /><em>working again.</em></h1>
          <p className="intro">No jargon. No giant checklist. Just one useful question at a time.</p>
          {!hasStarted && <div className="topics" aria-label="Common problems">
            {topics.map((topic) => <button key={topic.title} onClick={() => void send(topic.prompt)} type="button"><span>{topic.icon}</span><strong>{topic.title}</strong><small>Get help →</small></button>)}
          </div>}
        </div>

        <section className="desk" aria-label="AI Help Desk conversation">
          <header className="desk-header">
            <div className="agent-mark">AI</div>
            <div><strong>Help Desk</strong><span><i /> {status}</span></div>
            <button type="button" onClick={reset}>Start over</button>
          </header>
          <div className="conversation" aria-live="polite">
            {messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="bubble">{message.text}</div></div>)}
            {busy && <div className="message helper"><div className="bubble dots"><b /><b /><b /></div></div>}
          </div>
          <form onSubmit={submit} className="composer">
            <label className="sr-only" htmlFor="problem">Describe your problem</label>
            <textarea id="problem" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(input); } }} rows={2} placeholder="What isn’t working?" maxLength={1000} />
            <button type="submit" disabled={!input.trim() || busy} aria-label="Send">↑</button>
          </form>
          <p className="note">Guided troubleshooting · Routine questions run without paid AI usage</p>
        </section>
      </section>

      <footer><strong>AI Help Desk</strong><span>Everyday technology help, one step at a time.</span></footer>
    </main>
  );
}
