import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase";

export const getSupportConfig = createServerFn({
  method: "GET",
}).handler(async () => {
  const { data, error } = await supabase
    .rpc("get_support_config")
    .single();

  if (error) {
    console.error("Error getting support config:", error);
    return null;
  }

  return data;
});

export const updateSupportConfig = createServerFn({
  method: "POST",
}).handler(async (ctx: {
  data: {
    whatsapp_number?: string;
    email?: string;
    support_hours?: string;
    timezone?: string;
  };
}) => {
  const { data, error } = await supabase
    .rpc("update_support_config", {
      _whatsapp_number: ctx.data.whatsapp_number,
      _email: ctx.data.email,
      _support_hours: ctx.data.support_hours,
      _timezone: ctx.data.timezone,
    })
    .single();

  if (error) {
    console.error("Error updating support config:", error);
    throw new Error(error.message || "Error al actualizar configuración de soporte");
  }

  return data;
});
