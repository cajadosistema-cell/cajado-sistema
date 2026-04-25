import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-full bg-surface border-hairline border-border-subtle flex items-center justify-center mx-auto mb-5 text-fg-tertiary">
          <WifiOff className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 max-w-xs mx-auto mb-3">
          <div className="flex-1 h-px bg-border-ornament opacity-30" />
          <div className="w-1 h-1 bg-border-ornament rotate-45" />
          <div className="flex-1 h-px bg-border-ornament opacity-30" />
        </div>
        <h1 className="font-editorial text-xl text-fg italic mb-2">Sem conexão</h1>
        <p className="text-sm text-fg-secondary leading-relaxed">
          Verifique sua internet e tente novamente. As páginas que você já visitou continuam acessíveis.
        </p>
      </div>
    </main>
  );
}
