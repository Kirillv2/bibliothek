"use client";
// Menüpunkt mit Markierung der aktuellen Seite (aria-current), damit man sieht, wo man ist (NFR01).
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pfad = usePathname();
  const aktiv = href === "/" ? pfad === "/" || pfad.startsWith("/titel/") : pfad === href || pfad.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={aktiv ? "page" : undefined}>
      {children}
    </Link>
  );
}
