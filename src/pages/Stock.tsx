import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Stock() {
  return (
    <PDVLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Estoque</h1>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Módulo de estoque em desenvolvimento</CardContent></Card>
      </div>
    </PDVLayout>
  );
}