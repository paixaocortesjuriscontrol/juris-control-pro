import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useIsMobile } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={`transition-all duration-300 ${isMobile ? 'ml-0' : 'md:ml-64'}`}>
        <Header title={title} subtitle={subtitle} />
        <main className="p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
