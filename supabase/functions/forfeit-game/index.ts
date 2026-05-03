import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { room_id, reason } = await req.json();
    const normalizedReason = reason === "resign" ? "resignation" : reason;

    if (!room_id || (normalizedReason !== "resignation" && normalizedReason !== "abandon")) {
      return new Response(JSON.stringify({ error: "Missing or invalid room_id or reason. Reason must be 'resignation' or 'abandon'." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error: missing Supabase keys" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Authenticate user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Load room securely using admin client
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const { data: room, error: roomError } = await adminClient
      .from("rooms")
      .select("*")
      .eq("id", room_id)
      .single();

    if (roomError || !room) {
      return new Response(JSON.stringify({ error: "Room not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (room.status !== "playing") {
      return new Response(JSON.stringify({ error: "Room is not playing" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isWhite = room.white_user_id === user.id;
    const isBlack = room.black_user_id === user.id;

    if (!isWhite && !isBlack) {
      return new Response(JSON.stringify({ error: "Not a participant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Determine winner based on who forfeited
    const result = isWhite ? "black" : "white";

    // 4. Update room with admin client
    const { data: updatedRoom, error: updateError } = await adminClient
      .from("rooms")
      .update({
        status: "finished",
        result,
        end_reason: normalizedReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", room_id)
      .eq("status", "playing")
      .select("id")
      .maybeSingle(); // simple optimistic check so we don't accidentally forfeit an already finished room

    if (updateError || !updatedRoom) {
      console.error("[forfeit-game] Failed to finish room before finalization", {
        room_id,
        updateError,
        updatedRoom,
      });
      return new Response(JSON.stringify({ error: "Failed to forfeit room" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let game_id = null;
    const { data: finalizeData, error: finalizeError } = await adminClient.rpc("finalize_online_room", { p_room_id: room_id });
    if (finalizeError) {
      console.error("[forfeit-game] finalize_online_room failed after room forfeit", {
        room_id,
        result,
        end_reason: normalizedReason,
        finalizeError,
      });
      return new Response(JSON.stringify({ error: "Room was forfeited but finalization failed", details: finalizeError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (finalizeData && finalizeData.game_id) {
      game_id = finalizeData.game_id;
    }

    return new Response(
      JSON.stringify({
        room_id,
        status: "finished",
        result,
        end_reason: normalizedReason,
        game_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
