'use client';

import { usePathname, useRouter } from 'next/navigation';

const links = [
  { href: '/collections', label: 'Collections' },
  { href: '/train', label: 'Train' },
  { href: '/settings', label: 'Settings' },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  function navigate(href: string) {
    router.refresh(); // clear router cache so destination page re-fetches
    router.push(href);
  }

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center h-14 gap-6">
        <button onClick={() => navigate('/collections')} className="font-semibold text-lg text-white tracking-tight mr-2">
          Vocab Trainer
        </button>
        <div className="flex items-center gap-1">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(link.href + '/');
            return (
              <button
                key={link.href}
                onClick={() => navigate(link.href)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
