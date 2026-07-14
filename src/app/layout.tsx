import type { Metadata } from "next";
import { Anuphan } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastContainer } from "@/components/ui/Toast";

const anuphan = Anuphan({
  subsets: ['latin', 'thai'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-anuphan',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "POS Web — ระบบจัดการร้านอาหาร",
  description: "ระบบจัดการร้านอาหาร คำนวณต้นทุน กำไร วัตถุดิบ สูตรอาหาร และออเดอร์",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={anuphan.className} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem>
          <StoreProvider>
            {children}
            <ToastContainer />
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
