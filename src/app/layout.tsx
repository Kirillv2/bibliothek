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
        <a className="sprung" href="#inhalt">
          Zum Inhalt springen
        </a>
        <header className="kopf">
          <div className="kopf-innen">
            <Link href="/" className="marke">
              <svg className="marke-zeichen" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5z" />
                <path d="M13 3h5.5A1.5 1.5 0 0 1 20 4.5v14a1.5 1.5 0 0 1-1.5 1.5H13z" opacity="0.6" />
              </svg>
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
        <main id="inhalt">{children}</main>
      </body>
    </html>
  );
}
