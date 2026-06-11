import "./globals.css";
import { AppProviders } from "@/components/AppProviders";

export const metadata = {
  title: "Campus Notifications",
  description: "Campus notification inbox for placements, events, and results"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
