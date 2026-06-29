import { MainLayout } from "@/components/layout/MainLayout";
import PoolProxyDjenCard from "@/components/configuracoes/PoolProxyDjenCard";

export default function PoolProxyDjen() {
  return (
    <MainLayout
      title="Pool de Proxies DJEN"
      subtitle="Gerencie as VPS proxies usadas pelo motor DJEN Termos Paralela"
    >
      <PoolProxyDjenCard />
    </MainLayout>
  );
}