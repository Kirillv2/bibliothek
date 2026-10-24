import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Navigation } from "./navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bibliothek",
  description: "Bibliotheks- und Inventarverwaltung",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de">
      <body>
        <header className="kopf">
          <div className="kopf-innen">
            <Link href="/" className="marke">
              Bibliothek
            </Link>
            <Suspense
              fallback={
                <nav aria-label="Hauptmenü">
                  <Link href="/">Katalog</Link>
                </nav>
              }
            >
              <Navigation />
            </Suspense>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
