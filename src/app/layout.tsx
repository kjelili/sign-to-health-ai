import type { Metadata } from "next";
import { Instrument_Sans, DM_Sans } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sign-to-Health AI | Medical Interpreter for Deaf & Non-Verbal Patients",
  description: "Real-time medical interpreter that translates sign language, gestures, and facial expressions into structured clinical understanding — giving non-verbal patients a voice in healthcare.",
  keywords: ["medical interpreter", "sign language", "healthcare accessibility", "Deaf", "non-verbal"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${instrumentSans.variable} ${dmSans.variable} antialiased bg-[var(--bg-primary)] text-[var(--text-primary)]`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
