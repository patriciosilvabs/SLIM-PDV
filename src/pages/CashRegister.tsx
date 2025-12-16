import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function CashRegister() {
  return (
    <PDVLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Caixa</h1>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Módulo de caixa em desenvolvimento</CardContent></Card>
      </div>
    </PDVLayout>
  );
}