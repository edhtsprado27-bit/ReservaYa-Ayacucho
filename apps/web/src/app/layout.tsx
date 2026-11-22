import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { Suspense } from "react";
import AyudaWhatsApp from "@/components/AyudaWhatsApp";
import "./globals.css";

const barlow = Barlow({ variable: "--fuente-texto", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const barlowCondensed = Barlow_Condensed({ variable: "--fuente-titulo", subsets: ["latin"], weight: ["700", "800"] });

export const metadata: Metadata = {
  title: "ReservaYa Ayacucho",
  description: "Reserva canchas deportivas en la provincia de Huamanga.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        {children}
        {/* Botón "Ayuda por WhatsApp" (RF15): llega después, sin frenar la página */}
        <Suspense fallback={null}>
          <AyudaWhatsApp />
        </Suspense>
      </body>
    </html>
  );
}
