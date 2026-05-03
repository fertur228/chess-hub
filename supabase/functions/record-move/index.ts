import { createClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
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

    const { room_id, from, to, promotion } = await req.json();

    if (!room_id || !from || !to) {
      return new Response(JSON.stringify({ error: "Missing room_id, from, or to" }), {
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

    if (!room.fen) {
      return new Response(JSON.stringify({ error: "Room has no FEN" }), {
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

    // 3. Chess validation
    let chess;
    try {
      chess = new Chess(room.fen);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid board state FEN" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const turnColor = chess.turn(); // 'w' or 'b'
    if ((turnColor === "w" && !isWhite) || (turnColor === "b" && !isBlack)) {
      return new Response(JSON.stringify({ error: "Not your turn" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let moveInfo;
    try {
      moveInfo = chess.move({ from, to, promotion });
      if (!moveInfo) {
        return new Response(JSON.stringify({ error: "Illegal move" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: "Illegal move" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Check end conditions
    let newStatus = "playing";
    let newResult = null;
    let newEndReason = null;

    if (chess.isCheckmate()) {
      newStatus = "finished";
      newEndReason = "checkmate";
      newResult = turnColor === "w" ? "white" : "black";
    } else if (chess.isStalemate()) {
      newStatus = "finished";
      newEndReason = "stalemate";
      newResult = "draw";
    } else if (chess.isDraw()) {
      newStatus = "finished";
      newEndReason = "draw";
      newResult = "draw";
    }

    const nextFen = chess.fen();
    const nextPgn = chess.pgn();

    // 5. Update room with admin client
    const { error: updateError } = await adminClient
      .from("rooms")
      .update({
        fen: nextFen,
        pgn: nextPgn,
        status: newStatus,
        result: newResult,
        end_reason: newEndReason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", room_id)
      .eq("fen", room.fen); // Optimistic concurrency check loosely

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update room" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let game_id = null;
    if (newStatus === "finished") {
      const { data: finalizeData, error: finalizeError } = await adminClient.rpc("finalize_online_room", { p_room_id: room_id });
      if (finalizeError) {
        console.error("[record-move] finalize_online_room failed after finishing room", {
          room_id,
          result: newResult,
          end_reason: newEndReason,
          finalizeError,
        });
        return new Response(
          JSON.stringify({
            error: "GAME_FINALIZATION_FAILED",
            message: "Move was accepted but game finalization failed. Please retry or contact support.",
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (finalizeData && finalizeData.game_id) {
        game_id = finalizeData.game_id;
      }
    }

    return new Response(
      JSON.stringify({
        room_id,
        fen: nextFen,
        pgn: nextPgn,
        status: newStatus,
        result: newResult,
        end_reason: newEndReason,
        game_id,
        move: {
          from: moveInfo.from,
          to: moveInfo.to,
          san: moveInfo.san,
        },
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
