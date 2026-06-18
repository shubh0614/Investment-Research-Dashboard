"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserClient) browserClient = makeQueryClient();
  return browserClient;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const qc = getQueryClient();
  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}

/** Reads system preference once and applies the .light class on <html>. */
export function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function(){
  try {
    var stored = localStorage.getItem("klypup-theme");
    var prefer = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    var theme  = stored || prefer;
    if (theme === "light") {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
  } catch(e){}
})();
`,
      }}
    />
  );
}

/** Hook — returns current theme and a toggle function. */
export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("klypup-theme");
    const prefer = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme((stored as "dark" | "light") || prefer);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("klypup-theme", next);
    document.documentElement.classList.toggle("dark",  next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
  }

  return { theme, toggle };
}
