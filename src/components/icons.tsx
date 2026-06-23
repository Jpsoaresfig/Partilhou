/**
 * Ícones minimalistas (linha fina, currentColor). Estilo Feather/Lucide.
 * Um único componente <Icon name=... /> mantém tudo consistente e leve.
 */
import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "home"
  | "users"
  | "dollar"
  | "store"
  | "wallet"
  | "bell"
  | "user"
  | "shield"
  | "logout"
  | "login"
  | "sun"
  | "moon"
  | "chat"
  | "plus"
  | "search"
  | "close"
  | "pin"
  | "flag";

const PATHS: Record<IconName, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /><path d="M9.5 21v-6h5v6" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1" /><path d="M16.5 14.5A5.5 5.5 0 0 1 20.5 20" /></>,
  dollar: <><line x1="12" y1="3" x2="12" y2="21" /><path d="M16 6.5H10a2.7 2.7 0 0 0 0 5.4h4a2.7 2.7 0 0 1 0 5.4H7.5" /></>,
  store: <><path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" /><path d="M3 10h18l-1.4-5.2A2 2 0 0 0 17.7 3H6.3a2 2 0 0 0-1.9 1.8z" /><path d="M9.5 20v-5h5v5" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14" r="1.1" /></>,
  bell: <><path d="M18 8.5a6 6 0 0 0-12 0c0 6.5-2.5 8.5-2.5 8.5h17S18 15 18 8.5z" /><path d="M10.3 20.5a2 2 0 0 0 3.4 0" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  shield: <><path d="M12 21s7-3.5 7-8.7V5.5L12 3 5 5.5v6.8C5 17.5 12 21 12 21z" /></>,
  logout: <><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="M15.5 16.5 20 12l-4.5-4.5" /><line x1="20" y1="12" x2="9" y2="12" /></>,
  login: <><path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" /><path d="M9.5 16.5 14 12 9.5 7.5" /><line x1="14" y1="12" x2="4" y2="12" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></>,
  chat: <><path d="M21 11.5a8.4 8.4 0 0 1-11.5 7.8L3.5 21l1.7-6A8.4 8.4 0 1 1 21 11.5z" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  search: <><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></>,
  close: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
  pin: <><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  flag: <><path d="M5 21V4" /><path d="M5 4h11l-1.5 3.5L16 11H5" /></>,
};

export default function Icon({
  name,
  size = 22,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
