import { env } from 'cloudflare:workers';

type Message = { role: 'helper' | 'user'; text: string };

const INSTRUCTIONS = `You are AI Help Desk, a calm and practical technology troubleshooter for ordinary people.

Ask exactly one troubleshooting question in every response. Return only that question: no introduction, explanation, list, heading, or second question. End with one question mark.

Choose the single best next question from the full conversation. Use every fact already established and never repeat a question the user has answered. Prefer the easiest, safest observation that most clearly separates likely causes. Use familiar words and keep the question under 35 words.

Do not assume a device, operating system, app, account, or symptom that the user has not identified. Do not tell the user to uninstall, reset, erase, pay, expose credentials, or make an irreversible change while safer observations remain.

For fire, electrical danger, gas, medical emergencies, suspected fraud, or account compromise, ask one short question directing the user toward the appropriate emergency service, utility, or official support channel.`;

function validMessage(item: unknown): item is Message {
  return Boolean(item && typeof item === 'object' && 'role' in item && 'text' in item &&
    (item.role === 'helper' || item.role === 'user') && typeof item.text === 'string');
}

export async function POST(request: Request) {
  try {
    const key = (env as { OPENAI_API_KEY?: string }).OPENAI_API_KEY;
    if (!key) return Response.json({ error: 'The OpenAI connection has not been configured.' }, { status: 503 });

    const body = await request.json() as { messages?: unknown };
    if (!Array.isArray(body.messages)) return Response.json({ error: 'Please describe the problem.' }, { status: 400 });
    const messages = body.messages.filter(validMessage);
    const latest = messages.at(-1);
    if (!latest || latest.role !== 'user' || !latest.text.trim()) return Response.json({ error: 'Please describe the problem.' }, { status: 400 });

    const input = messages.map((message) => ({
      role: message.role === 'helper' ? 'assistant' : 'user',
      content: message.text.slice(0, 4000),
    }));

    const result = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        instructions: INSTRUCTIONS,
        input,
        max_output_tokens: 120,
        store: false,
        text: { verbosity: 'low' },
      }),
    });

    const data = await result.json() as {
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      error?: { message?: string };
    };

    if (!result.ok) {
      const message = data.error?.message || 'OpenAI could not generate a response.';
      if (result.status === 401) return Response.json({ error: 'The OpenAI API key is not valid.' }, { status: 503 });
      if (message.toLowerCase().includes('no credits remaining')) return Response.json({ error: 'The OpenAI account needs API credits before AI Help Desk can answer.' }, { status: 503 });
      throw new Error(message);
    }

    const raw = data.output?.flatMap((item) => item.content || []).filter((item) => item.type === 'output_text').map((item) => item.text || '').join(' ').trim() || '';
    const firstQuestion = raw.includes('?') ? `${raw.split('?')[0].trim()}?` : `${raw.replace(/[.!]+$/, '').trim()}?`;
    if (firstQuestion === '?') throw new Error('OpenAI returned an empty response.');
    return Response.json({ reply: firstQuestion });
  } catch (error) {
    console.error('AI Help Desk error', error);
    return Response.json({ error: 'AI Help Desk could not respond. Please try again.' }, { status: 500 });
  }
}
