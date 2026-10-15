import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { analyzeMigration, type MigrationAnalysis } from "@/lib/migration-analysis.functions";

export function MigrationAnalysisPanel() {
  const run = useServerFn(analyzeMigration);
  const [schemaText, setSchemaText] = useState("");
  const [dataText, setDataText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MigrationAnalysis | null>(null);
  const [error, setError] = useState("");

  const readFile = async (f: File | undefined, set: (s: string) => void) => {
    if (f) set(await f.text());
  };

  const submit = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await run({ data: { schema: schemaText, data: dataText } });
      if (r.ok) setResult(r.result);
      else setError(r.error);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Error";
      setError(m);
      toast.error(m);
    } finally {
      setLoading(false);
    }
  };

  const sevVariant = (s: string) => (s === "alta" ? "destructive" : s === "media" ? "default" : "secondary");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Análisis de migración con IA</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pega o sube el esquema (.sql) y una muestra de los datos exportados (.csv/.json/.sql). La IA identifica tablas, relaciones y riesgos, y genera un plan de verificación.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Esquema</Label>
            <input type="file" accept=".sql,.txt" onChange={(e) => readFile(e.target.files?.[0], setSchemaText)} className="text-sm" />
            <Textarea rows={8} value={schemaText} onChange={(e) => setSchemaText(e.target.value)} placeholder="CREATE TABLE ..." className="font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>Datos exportados (muestra)</Label>
            <input type="file" accept=".csv,.json,.sql,.txt" onChange={(e) => readFile(e.target.files?.[0], setDataText)} className="text-sm" />
            <Textarea rows={8} value={dataText} onChange={(e) => setDataText(e.target.value)} placeholder="id,user_id,amount,..." className="font-mono text-xs" />
          </div>
          <p className="text-xs text-muted-foreground">
            {(schemaText.length + dataText.length).toLocaleString()} / 200,000 caracteres. Quita claves o contraseñas antes de enviar.
          </p>
          <Button onClick={submit} disabled={loading}>
            {loading ? "Analizando… (puede tardar 1–2 min)" : "Analizar"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent><p className="text-sm whitespace-pre-wrap">{result.summary}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Tablas ({result.tables.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {result.tables.map((t) => (
                <div key={t.name} className="rounded-md border border-border p-3 text-sm">
                  <div className="font-mono font-semibold">{t.name}</div>
                  <div className="text-muted-foreground">{t.purpose}</div>
                  <div className="text-xs mt-1">PK: {t.primary_key} · Filas: {t.row_estimate}</div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Relaciones ({result.relationships.length})</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              {result.relationships.map((r, i) => (
                <div key={i}>
                  <span className="font-mono">{r.from_table}.{r.from_column} → {r.to_table}.{r.to_column}</span>
                  {r.note && <span className="text-muted-foreground"> — {r.note}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Posibles problemas ({result.issues.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {result.issues.map((x, i) => (
                <div key={i} className="rounded-md border border-border p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={sevVariant(x.severity)}>{x.severity}</Badge>
                    <span className="font-semibold">{x.area}</span>
                  </div>
                  <p>{x.description}</p>
                  <p className="text-muted-foreground">➜ {x.recommendation}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Plan de verificación</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {result.verification_plan.map((s) => (
                <div key={s.step} className="rounded-md border border-border p-3 text-sm space-y-1">
                  <div className="font-semibold">{s.step}. {s.title}</div>
                  <p>{s.action}</p>
                  {s.check_query && (
                    <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{s.check_query}</pre>
                  )}
                  <p className="text-muted-foreground">Esperado: {s.expected}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
