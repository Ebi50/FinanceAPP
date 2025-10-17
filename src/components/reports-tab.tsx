import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Download, FileUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ReportsTab() {
  const { toast } = useToast();

  const handleNotImplemented = () => {
    toast({
      title: "Funktion noch nicht verfügbar",
      description: "Wir arbeiten daran, diese Funktion bald bereitzustellen.",
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Berichte erstellen</CardTitle>
          <CardDescription>
            Laden Sie Ihre monatlichen oder jährlichen Ausgabenberichte herunter.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="secondary" onClick={handleNotImplemented}>
            <Download className="mr-2 h-4 w-4" />
            Monatlicher Bericht (PDF)
          </Button>
          <Button variant="secondary" onClick={handleNotImplemented}>
            <Download className="mr-2 h-4 w-4" />
            Jahresbericht (PDF)
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Daten importieren</CardTitle>
          <CardDescription>
            Laden Sie Ihre Ausgabendaten aus einer Excel-Datei hoch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={handleNotImplemented}>
            <FileUp className="mr-2 h-4 w-4" />
            Aus Excel importieren
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
