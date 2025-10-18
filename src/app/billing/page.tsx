'use client';

import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function BillingPage() {
  return (
    <div className="flex-col md:flex">
      <PageHeader />
      <main className="flex min-h-[calc(100vh_-_theme(spacing.16))] flex-1 flex-col gap-4 bg-muted/40 p-4 md:gap-8 md:p-10">
        <div className="mx-auto grid w-full max-w-6xl gap-2">
          <h1 className="text-3xl font-semibold">Abrechnung</h1>
        </div>
        <div className="mx-auto grid w-full max-w-6xl items-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Abrechnungsübersicht</CardTitle>
              <CardDescription>
                Hier finden Sie eine Übersicht Ihrer aktuellen Abrechnungsdetails und Ihres Plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">Aktueller Plan</h3>
                  <p className="text-muted-foreground">Free Plan</p>
                </div>
                <div>
                  <h3 className="font-semibold">Nächstes Rechnungsdatum</h3>
                  <p className="text-muted-foreground">N/A</p>
                </div>
                <div>
                  <h3 className="font-semibold">Zahlungsmethode</h3>
                  <p className="text-muted-foreground">Keine Zahlungsmethode hinterlegt.</p>
                </div>
                <Button>Plan upgraden</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
