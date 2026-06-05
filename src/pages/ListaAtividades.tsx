import { MainLayout } from "@/components/layout/MainLayout";
import ListaAtividadesView from "@/components/lista/ListaAtividadesView";

export default function ListaAtividades() {
  return (
    <MainLayout title="Lista de atividades">
      <ListaAtividadesView />
    </MainLayout>
  );
}