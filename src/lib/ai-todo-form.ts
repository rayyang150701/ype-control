import { AI_TODO_PHASES, isValidDate, openItems, type AiTodoProposal } from '@/lib/ai-todo';
import type { ProjectActionItem } from '@/types';

/** 框架填寫：使用者在題目後面直接輸入，由程式帶入欄位，不經過 AI */
const LABELS = ['專案', '事項', '負責', '等候', '期限', '階段', '備註'] as const;
type Label = (typeof LABELS)[number];

// 題目後要有冒號、空白或直接換行，避免把「期限已過…」這種內文當成題目
const LABEL_RE = /^\s*(專案|事項|負責|等候|期限|階段|備註)(?:單位|名稱|對象)?(?:\s*[:：]|\s+|$)/;

export const formTemplate = (project = '') => LABELS.map((l) => `${l}：${l === '專案' ? project : ''}`).join('\n');
export const isBlankForm = (text: string) => text.split('\n').every((l) => !l.replace(LABEL_RE, '').trim());
export const isForm = (text: string) => LABEL_RE.test(text);

export interface AiTodoFormContext {
  projects: { id: string; name: string; caseNumber: string }[];
  items: ProjectActionItem[];
  owners: string[];
  people: string[];
  companyOf: Record<string, string>;
  speaker: string;
}

// 全形半形、標點、空白、隱藏字元、常見異體字都視為相同
const norm = (s: string) => s.normalize('NFKC').replace(/[^\p{L}\p{N}]/gu, '').replace(/臺/g, '台').replace(/[厰廠]/g, '廠').toLowerCase();

/** 依「完全相同 → 包含 → 依序出現的字」逐級比對，回傳第一個有結果的等級 */
function match<T>(query: string, list: T[], keys: (t: T) => string[]): T[] {
  const q = norm(query);
  if (!q) return [];
  const inOrder = (k: string) => {
    let i = 0;
    for (const c of Array.from(k)) if (c === q[i]) i++;
    return q.length >= 2 && i === q.length;
  };
  const levels: ((k: string) => boolean)[] = [(k) => k === q, (k) => k.includes(q), inOrder];
  for (const test of levels) {
    const hit = list.filter((t) => keys(t).map((k) => norm(k || '')).some((k) => k && test(k)));
    if (hit.length) return hit;
  }
  return [];
}

const pairs = (s: string) => new Set(Array.from(s).slice(1).map((c, i) => Array.from(s)[i] + c));

/** 名稱有錯字、順序不同或多打字時，以相鄰兩字的重疊比例找最像的（至少四成） */
function similar<T>(query: string, list: T[], key: (t: T) => string): { best?: T; hits: T[] } {
  const q = pairs(norm(query));
  if (!q.size) return { hits: [] };
  const scored = list
    .map((t) => {
      const k = pairs(norm(key(t)));
      let same = 0;
      q.forEach((x) => { if (k.has(x)) same++; });
      return { t, score: k.size ? same / Math.min(q.size, k.size) : 0 };
    })
    .filter((x) => x.score >= 0.4)
    .sort((a, b) => b.score - a.score);
  const clear = scored.length > 0 && (scored.length === 1 || scored[0].score - scored[1].score >= 0.15);
  return { best: clear ? scored[0].t : undefined, hits: scored.slice(0, 5).map((x) => x.t) };
}

const CN = '零一二三四五六七八九';
/** 一～九十九的中文數字轉阿拉伯數字 */
function toDigits(s: string): string {
  return s.replace(/兩/g, '二').replace(/[一二三四五六七八九十]+/g, (m) => {
    if (!m.includes('十')) return Array.from(m).map((c) => CN.indexOf(c)).join('');
    const [a, b] = m.split('十');
    return String((a ? CN.indexOf(a) : 1) * 10 + (b ? CN.indexOf(b) : 0));
  });
}

/** 看不懂就回空字串，不猜 */
export function parseFormDate(input: string, base: string): string {
  const s = toDigits(input.replace(/[\s，,。]/g, '').replace(/^(預計|預定)/, '').replace(/(以前|之前|前)?(完成)?$/, ''));
  const at = new Date(`${base}T00:00:00Z`);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const plus = (n: number) => iso(new Date(at.getTime() + n * 864e5));
  const ymd = (y: number, m: number, d: number) => {
    const v = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return isValidDate(v) ? v : '';
  };
  const near: Record<string, number> = { 今天: 0, 今日: 0, 明天: 1, 明日: 1, 後天: 2, 大後天: 3 };
  if (s in near) return plus(near[s]);

  let m = s.match(/^(?:民國)?(\d{3,4})[-/.年](\d{1,2})[-/.月](\d{1,2})[日號]?$/);
  if (m) return ymd(m[1].length === 3 ? Number(m[1]) + 1911 : Number(m[1]), Number(m[2]), Number(m[3]));
  m = s.match(/^(今年|明年)?(\d{1,2})[-/.月](\d{1,2})[日號]?$/);
  if (m) {
    const y = at.getUTCFullYear();
    if (m[1]) return ymd(m[1] === '明年' ? y + 1 : y, Number(m[2]), Number(m[3]));
    const v = ymd(y, Number(m[2]), Number(m[3]));
    return v && v >= base ? v : ymd(y + 1, Number(m[2]), Number(m[3]));
  }
  m = s.match(/^(\d{1,3})(天|日|個?週|個?周|個?星期|個?禮拜)(?:後|內)$/);
  if (m) return plus(Number(m[1]) * (/天|日/.test(m[2]) ? 1 : 7));
  m = s.match(/^(下{0,2}|這|本)個?(?:週|周|星期|禮拜)([1-7日天])$/);
  if (m) {
    const target = /[日天]/.test(m[2]) ? 7 : Number(m[2]);
    const diff = target - (at.getUTCDay() || 7);
    if (m[1] === '') return plus(diff < 0 ? diff + 7 : diff);
    return plus(diff + (m[1].startsWith('下') ? m[1].length * 7 : 0));
  }
  m = s.match(/^(月|這個月|本月|下個?月)底$/);
  if (m) return iso(new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + (m[1].startsWith('下') ? 2 : 1), 0)));
  m = s.match(/^(\d{1,2})月底$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) {
    const end = (y: number) => iso(new Date(Date.UTC(y, Number(m![1]), 0)));
    const v = end(at.getUTCFullYear());
    return v >= base ? v : end(at.getUTCFullYear() + 1);
  }
  return '';
}

export function parseForm(text: string, base: string, ctx: AiTodoFormContext): AiTodoProposal[] {
  const blocks: Partial<Record<Label, string>>[] = [];
  let last: Label | null = null;
  for (const line of text.split('\n')) {
    const m = line.match(LABEL_RE);
    if (m) {
      const label = m[1] as Label;
      // 題目重複出現＝下一筆
      if (!blocks.length || label in blocks[blocks.length - 1]) blocks.push({});
      blocks[blocks.length - 1][label] = line.slice(m[0].length).trim();
      last = label;
    } else if (line.trim()) {
      if (!last) throw new Error(`「${line.trim().slice(0, 20)}」前面沒有題目，請放在題目後面，或改用「貼對話／口述」`);
      const b = blocks[blocks.length - 1];
      b[last] = `${b[last] || ''} ${line.trim()}`.trim();
    }
  }

  return blocks.filter((b) => Object.values(b).some(Boolean)).map((b, i): AiTodoProposal => {
    const notes: string[] = [];
    const pick = <T,>(label: string, value: string | undefined, hits: T[], name: (t: T) => string): T | undefined => {
      if (!value || hits.length === 1) return hits[0];
      notes.push(hits.length ? `${label}「${value}」有多個可能：${hits.slice(0, 5).map(name).join('、')}` : `${label}「${value}」對不到，請重選`);
      return undefined;
    };
    let byProject = match(b.專案 || '', ctx.projects, (p) => [p.name, p.caseNumber]);
    if (b.專案 && !byProject.length) {
      const near = similar(b.專案, ctx.projects, (p) => p.name);
      byProject = near.best ? [near.best] : near.hits;
      if (near.best) notes.push(`專案「${b.專案}」是以相似名稱帶入「${near.best.name}」，請確認後再勾選`);
    }
    const project = pick('專案', b.專案, byProject, (p) => p.name);
    let owner = pick('負責', b.負責, match(b.負責 || '', ctx.owners, (o) => [o]), (o) => o) || '';
    const phase = pick('階段', b.階段, match(b.階段 || '', AI_TODO_PHASES, (p) => [p, p.replace(/^[\d.]+\s*/, '')]), (p) => p) || '';

    const who = b.等候 === '我' && ctx.speaker ? ctx.speaker : b.等候 || '';
    const persons = match(who, ctx.people, (p) => [p]);
    if (persons.length > 1) notes.push(`等候「${who}」有多個可能：${persons.slice(0, 5).join('、')}`);
    const waitingOn = persons.length === 1 ? persons[0] : who;

    const dueDate = parseFormDate(b.期限 || '', base);
    if (b.期限 && !dueDate) notes.push(`期限「${b.期限}」看不懂，請改成 12/4 或重選`);

    const company = ctx.companyOf[waitingOn] || '';
    const ownerInferred = !b.負責 && ctx.owners.includes(company);
    if (ownerInferred) owner = company;

    const title = (b.事項 || '').slice(0, 200);
    const t = norm(title);
    const related = t
      ? openItems(ctx.items).find((x) => {
          const k = norm(x.title);
          return x.projectId === project?.id && k && (k.includes(t) || t.includes(k));
        })
      : undefined;

    return {
      id: `form-${i}`, kind: 'create', itemId: null, itemUpdatedAt: null, relatedItemId: related?.id || null,
      suggestedTitle: title, explicit: false, ownerInferred,
      projectId: project?.id || null, candidateProjectIds: project ? [] : byProject.map((p) => p.id),
      title, phase, status: 'pending', owner, waitingOn: waitingOn.slice(0, 100), dueDate, dueDateReason: '', completedDate: '',
      note: (b.備註 || '').slice(0, 2000),
      evidence: LABELS.filter((l) => b[l]).map((l) => `${l}：${b[l]}`).join('　'),
      evidenceVerified: true, question: notes.join('；'),
    };
  });
}
