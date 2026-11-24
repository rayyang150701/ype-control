import { NextRequest, NextResponse } from 'next/server';
import { getClients, getUsers } from '@/lib/actions';
import { getAiTodoScope } from '@/lib/ai-todo-data';
import { AI_TODO_MAX_CHARS, buildAiTodoPrompt, isValidDate, normalizeAiTodo, taipeiToday } from '@/lib/ai-todo';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 50_000;

async function callModel(system: string, text: string): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  if (openaiKey) {
    const envModel = process.env.OPENAI_MODEL?.trim();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        // 與 /api/ai/chat 相同的模型解析規則
        model: !envModel || envModel === 'gpt-5.6-luna' ? 'gpt-6-luna' : envModel,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: text }],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI 回應 ${res.status}`);
    return (await res.json())?.choices?.[0]?.message?.content || '';
  }
  if (geminiKey) {
    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) throw new Error(`Gemini 回應 ${res.status}`);
    return (await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  throw new Error('尚未設定 OPENAI_API_KEY 或 GEMINI_API_KEY');
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return NextResponse.json({ error: '請先貼上或口述內容' }, { status: 400 });
  if (text.length > AI_TODO_MAX_CHARS) {
    return NextResponse.json({ error: `內容超過 ${AI_TODO_MAX_CHARS} 字，請分段貼上` }, { status: 400 });
  }
  const messageDate = isValidDate(body.messageDate) ? body.messageDate : taipeiToday();

  try {
    const [{ projects, items }, clients, users] = await Promise.all([
      getAiTodoScope(), getClients(), getUsers(),
    ]);
    if (!projects.length) throw new Error('讀不到專案資料，請稍後再試');
    const unique = (list: (string | undefined)[]) =>
      Array.from(new Set(list.map((s) => s?.trim()).filter(Boolean))) as string[];
    const ctx = {
      projects,
      items,
      owners: unique([...clients.map((c) => c.name), ...items.map((i) => i.owner)]),
      people: unique(users.map((u) => u.displayName)),
      companyOf: Object.fromEntries(users.filter((u) => u.displayName && u.clientName).map((u) => [u.displayName.trim(), u.clientName!.trim()])),
      speaker: typeof body.speaker === 'string' ? body.speaker.trim().slice(0, 50) : '',
    };

    const reply = await callModel(buildAiTodoPrompt(ctx, messageDate), text);
    let json: unknown;
    try {
      json = JSON.parse(reply.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      throw new Error('AI 回傳格式不正確，請再試一次');
    }
    return NextResponse.json({ proposals: normalizeAiTodo(json, ctx, text) });
  } catch (err: any) {
    console.error('[parse-todo]', err?.message);
    const message = err?.name === 'TimeoutError' ? 'AI 處理逾時，請縮短內容再試' : err?.message || '整理失敗';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
