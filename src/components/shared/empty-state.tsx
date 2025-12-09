import { FileQuestion } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card p-12 text-center mt-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
        <FileQuestion className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="font-headline mt-6 text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
