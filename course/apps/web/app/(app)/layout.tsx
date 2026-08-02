import { AuthGuard } from "@/components/auth-guard";
import { RenewalBanner } from "@/components/shared/renewal-banner";
import { ProactiveIntervention } from "@/components/support/ProactiveIntervention";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ProactiveIntervention />
      <RenewalBanner />
      {children}
    </AuthGuard>
  );
}
