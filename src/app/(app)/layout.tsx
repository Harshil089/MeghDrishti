import Sidebar from "@/components/Sidebar";
import PageTransition from "@/components/PageTransition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <PageTransition>{children}</PageTransition>
    </div>
  );
}
