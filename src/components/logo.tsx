import { cn } from '@/lib/utils';

export function ShuttlecockMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Feathers (skirt) */}
      <path
        d="M12 3c-1.6 2.3-2.2 4.8-1.8 7.4l-4.9 5.6a8.7 8.7 0 0 1 1.4 1.8L12 12.3l5.3 5.5a8.7 8.7 0 0 1 1.4-1.8l-4.9-5.6c.4-2.6-.2-5.1-1.8-7.4Z"
        fill="currentColor"
        opacity="0.95"
      />
      {/* Cork */}
      <path
        d="M12 11.5c2.1 0 4 1.6 4 3.5s-1.9 3.5-4 3.5-4-1.6-4-3.5 1.9-3.5 4-3.5Z"
        fill="currentColor"
      />
      {/* Feather divisions */}
      <path d="M12 12.5v6" stroke="var(--primary)" strokeWidth="1" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-500 text-primary-foreground shadow-sm">
        <ShuttlecockMark className="size-5" />
      </span>
      <span className="text-xl font-bold tracking-tight text-foreground">
        Baddy<span className="text-primary">Club</span>
      </span>
    </span>
  );
}
