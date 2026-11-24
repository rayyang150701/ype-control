import { getClients, getUsers } from '@/lib/actions';
import { getAiTodoScope } from '@/lib/ai-todo-data';
import { AiTodoClient } from '@/components/ai-todo/ai-todo-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export default async function AiTodoPage() {
  const [{ projects, items }, users, clients] = await Promise.all([
    getAiTodoScope(), getUsers(), getClients(),
  ]);
  return (
    <AiTodoClient
      projects={projects.map(({ id, name, caseNumber }) => ({ id, name, caseNumber }))}
      items={items}
      people={users.map((u) => u.displayName).filter(Boolean)}
      companyOf={Object.fromEntries(users.filter((u) => u.displayName && u.clientName).map((u) => [u.displayName.trim(), u.clientName!.trim()]))}
      clientNames={clients.map((c) => c.name).filter(Boolean)}
    />
  );
}
