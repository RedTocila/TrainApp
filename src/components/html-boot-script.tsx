"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

/** Runs before paint (dark theme + accent/locale) without a React-tree <script>. */
const BOOT_SCRIPT = `(function(){try{var r=document.documentElement;r.classList.add('dark');r.classList.remove('light');localStorage.setItem('theme','dark');var p={red:{primary:'#dc2626',accent:'#ef4444',rgb:'220, 38, 38'},purple:{primary:'#9333ea',accent:'#a855f7',rgb:'147, 51, 234'},pink:{primary:'#db2777',accent:'#f472b6',rgb:'219, 39, 119'},teal:{primary:'#0d9488',accent:'#2dd4bf',rgb:'13, 148, 136'},blue:{primary:'#2563eb',accent:'#60a5fa',rgb:'37, 99, 235'},neon:{primary:'#16a34a',accent:'#4ade80',rgb:'34, 197, 94'},black:{primary:'#e4e4e7',accent:'#fafafa',rgb:'228, 228, 231',primaryForeground:'#18181b'},yellow:{primary:'#eab308',accent:'#facc15',rgb:'234, 179, 8'}};var a=localStorage.getItem('accent-color');if(a==='amber'){a='purple';localStorage.setItem('accent-color','purple');}var c=p[a]||p.red;r.dataset.accent=a||'red';r.style.setProperty('--primary',c.primary);r.style.setProperty('--accent',c.accent);r.style.setProperty('--ring',c.primary);r.style.setProperty('--primary-rgb',c.rgb);if(c.primaryForeground)r.style.setProperty('--primary-foreground',c.primaryForeground);else r.style.removeProperty('--primary-foreground');var loc=localStorage.getItem('rutina_locale');if(loc==='en'||loc==='al'){r.lang=loc==='en'?'en':'sq';document.cookie='rutina_locale='+loc+';path=/;max-age=31536000;samesite=lax';}}catch(e){}})();`;

export function HtmlBootScript() {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return (
      <script
        dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }}
      />
    );
  });

  return null;
}
