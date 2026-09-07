import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { LanguageProvider } from "@/lib/language-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegalAI | Document intelligence",
  description: "AI-powered legal document analysis and decision support.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark-navy" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('legalai-theme');
                  if (t === 'light' || t === 'dark' || t === 'dark-navy') {
                    document.documentElement.setAttribute('data-theme', t);
                    document.documentElement.style.colorScheme = t === 'light' ? 'light' : 'dark';
                  } else {
                    document.documentElement.setAttribute('data-theme', 'dark-navy');
                    document.documentElement.style.colorScheme = 'dark';
                  }
                  var l = localStorage.getItem('legalai-language');
                  if (l === 'hi' || l === 'हिंदी (Hindi)') {
                    document.documentElement.lang = 'hi';
                  } else {
                    document.documentElement.lang = 'en';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>{children}</AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
