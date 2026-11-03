import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MigrationAnalysis = {
  summary: string;
  tables: { name: string; purpose: string; row_estimate: string; primary_key: string }[];
  relationships: { from_table: string; from_column: string; to_table: string; to_column: string; note: string }[];
  issues: { severity: "alta" | "media" | "baja"; area: string; description: string; recommendation: string }[];
  verification_plan: { step: number; title: string; action: string; check_query: string; expected: string }[];
};

const MAX_CHARS = 200_000;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "tables", "relationships", "issues", "verification_plan"],
  properties: {
    summary: { type: "string" },
    tables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "purpose", "row_estimate", "primary_key"],
        properties: {
          name: { type: "string" },
          purpose: { type: "string" },
          row_estimate: { type: "string" },
          primary_key: { type: "string" },
        },
      },
    },
    relationships: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from_table", "from_column", "to_table", "to_column", "note"],
        properties: {
          from_table: { type: "string" },
          from_column: { type: "string" },
          to_table: { type: "string" },
          to_column: { type: "string" },
          note: { type: "string" },
        },
      },
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "area", "description", "recommendation"],
        properties: {
          severity: { type: "string", enum: ["alta", "media", "baja"] },
          area: { type: "string" },
          description: { type: "string" },
          recommendation: { type: "string" },
        },
      },
    },
    verification_plan: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["step", "title", "action", "check_query", "expected"],
        properties: {
          step: { type: "integer" },
          title: { type: "string" },
          action: { type: "string" },
          check_query: { type: "string" },
          expected: { type: "string" },
        },
      },
    },
  },
};

const INSTRUCTIONS = `Eres un experto en migraciones de PostgreSQL/Supabase. El administrador te da el esquema SQL y una muestra de los datos exportados de su base de datos.
Identifica todas las tablas (propósito, clave primaria, estimación de filas si hay datos), las relaciones (claves foráneas explícitas o implícitas por columnas *_id),
y los posibles problemas de migración: referencias a auth.users, funciones SECURITY DEFINER, políticas RLS, triggers, extensiones, enums, secuencias, buckets de storage,
secretos/credenciales que no se exportan, datos huérfanos, tipos incompatibles, orden de carga por dependencias.
Genera un plan de verificación accionable y ordenado; cada paso con una consulta SQL de comprobación concreta y el resultado esperado. Responde en español.
Nunca repitas valores sensibles (claves, tokens, contraseñas) que aparezcan en los datos.`;

export const analyzeMigration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { schema: string; data: string }) => {
    const s = String(input?.schema ?? "");
    const d = String(input?.data ?? "");
    if (!s.trim() && !d.trim()) throw new Error("Pega el esquema o los datos exportados.");
    if (s.length + d.length > MAX_CHARS)
      throw new Error(`El contenido es demasiado grande (máx. ${MAX_CHARS.toLocaleString()} caracteres). Recorta los datos a una muestra.`);
    return { schema: s, data: d };
  })
  .handler(async ({ data, context }): Promise<{ ok: true; result: MigrationAnalysis } | { ok: false; error: string }> => {
    const { verifyIsAdmin } = await import("./admin.server");
    if (!(await verifyIsAdmin(context))) return { ok: false, error: "Solo administradores." };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "Falta la configuración de IA." };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "medium" },
        instructions: INSTRUCTIONS,
        input: [
          {
            role: "user",
            content: `=== ESQUEMA ===\n${data.schema || "(no proporcionado)"}\n\n=== DATOS EXPORTADOS ===\n${data.data || "(no proporcionados)"}`,
          },
        ],
        text: { format: { type: "json_schema", name: "migration_analysis", strict: true, schema } },
      }),
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      console.error("AI gateway error", res.status, body);
      let msg = "";
      try { msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? ""; } catch { /* ignore */ }
      if (res.status === 429) return { ok: false, error: "Demasiadas solicitudes. Intenta en unos minutos." };
      if (res.status === 402) return { ok: false, error: msg || "Créditos de IA insuficientes." };
      return { ok: false, error: msg || `Error del servicio de IA (${res.status}).` };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    let failure = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload);
            if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
            else if (ev.type === "response.refusal.delta") failure = "El modelo rechazó la solicitud.";
            else if (ev.type === "response.failed" || ev.type === "error")
              failure = ev.response?.error?.message ?? ev.message ?? "La IA falló.";
          } catch { /* partial */ }
        }
      }
    }
    if (failure) return { ok: false, error: failure };
    try {
      return { ok: true, result: JSON.parse(text) as MigrationAnalysis };
    } catch {
      return { ok: false, error: "La respuesta de la IA llegó incompleta. Prueba con menos datos." };
    }
  });
