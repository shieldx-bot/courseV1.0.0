import { AuthGuard } from "@/components/auth-guard";
import { RenewalBanner } from "@/components/shared/renewal-banner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RenewalBanner />
      {children}
    </AuthGuard>
  );
}
