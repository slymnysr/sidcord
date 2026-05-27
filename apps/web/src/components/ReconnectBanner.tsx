import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function ReconnectBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  if (online) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-accent-500 text-white px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg">
      <WifiOff size={14} />
      Bağlantı kesildi — yeniden bağlanılıyor...
    </div>
  );
}
