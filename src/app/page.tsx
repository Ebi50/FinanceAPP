import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PlusCircle } from "lucide-react";
import { UserNav } from "@/components/user-nav";
import { DashboardTab } from "@/components/dashboard-tab";
import { TransactionsTab } from "@/components/transactions-tab";
import { CategoriesTab } from "@/components/categories-tab";
import { ReportsTab } from "@/components/reports-tab";
import { AddTransactionSheet } from "@/components/add-transaction-sheet";

export default function Dashboard() {
  return (
    <div className="flex-col md:flex">
      <div className="border-b">
        <div className="flex h-16 items-center px-4 md:px-8">
          <h1 className="text-2xl font-headline font-bold tracking-tight">ExpenceTrack</h1>
          <div className="ml-auto flex items-center space-x-4">
            <UserNav />
          </div>
        </div>
      </div>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-headline font-bold tracking-tight">Übersicht</h2>
          <div className="flex items-center space-x-2">
            <AddTransactionSheet>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Transaktion hinzufügen
              </Button>
            </AddTransactionSheet>
          </div>
        </div>
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="transactions">Transaktionen</TabsTrigger>
            <TabsTrigger value="categories">Kategorien</TabsTrigger>
            <TabsTrigger value="reports">Berichte</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <DashboardTab />
          </TabsContent>
          <TabsContent value="transactions" className="space-y-4">
            <TransactionsTab />
          </TabsContent>
          <TabsContent value="categories" className="space-y-4">
            <CategoriesTab />
          </TabsContent>
          <TabsContent value="reports" className="space-y-4">
            <ReportsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
