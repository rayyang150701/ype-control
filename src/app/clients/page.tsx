import { getClients } from '@/lib/actions';
import { ClientsClient } from '@/components/clients/client';

export const revalidate = 0;

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <ClientsClient initialClients={clients} />
    </div>
  );
}
