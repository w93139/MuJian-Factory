"use client";

import { createContext, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";

export const HomeNavigationContext = createContext(0);

export default function LiveShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const query = useSearchParams();
  const landing = path === "/" && !query.get("session");
  const [homeNavigation, setHomeNavigation] = useState(0);
  return (
    <AppShell cinematic landing={landing} onHomeNavigate={() => setHomeNavigation(value => value + 1)}>
      <HomeNavigationContext.Provider value={homeNavigation}>
        {children}
      </HomeNavigationContext.Provider>
    </AppShell>
  );
}
