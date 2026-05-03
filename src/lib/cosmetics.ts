import type { CSSProperties } from "react";

export type WalletSnapshot = {
  balance: number;
  inventoryItemIds: string[];
  activeBoardSkinSlug: string | null;
  activeAvatarFrameSlug: string | null;
};

export function parseWalletRpc(data: unknown): WalletSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const balance = typeof o.balance === "number" ? o.balance : null;
  if (balance == null) return null;
  let inventoryItemIds: string[] = [];
  const inv = o.inventory_item_ids;
  if (Array.isArray(inv)) {
    inventoryItemIds = inv.filter((x): x is string => typeof x === "string");
  }
  return {
    balance,
    inventoryItemIds,
    activeBoardSkinSlug: typeof o.active_board_skin_slug === "string" ? o.active_board_skin_slug : null,
    activeAvatarFrameSlug: typeof o.active_avatar_frame_slug === "string" ? o.active_avatar_frame_slug : null,
  };
}

const DEFAULT_LIGHT = "oklch(0.94 0.02 90)";
const DEFAULT_DARK = "oklch(0.55 0.06 150)";

type SkinDef = { light: string; dark: string; boardStyle?: CSSProperties };

const BOARD_SKINS: Record<string, SkinDef> = {
  classic_walnut: {
    light: "oklch(0.88 0.045 72)",
    dark: "oklch(0.4 0.055 58)",
    boardStyle: { boxShadow: "0 6px 28px -6px oklch(0.35 0.05 55 / 0.38)" },
  },
  neon_arena: {
    light: "oklch(0.78 0.14 290)",
    dark: "oklch(0.34 0.2 290)",
    boardStyle: {
      boxShadow:
        "0 0 0 2px oklch(0.62 0.22 300 / 0.55), 0 10px 36px -4px oklch(0.45 0.18 300 / 0.5)",
    },
  },
  royal_marble: {
    light: "oklch(0.91 0.02 245)",
    dark: "oklch(0.46 0.035 250)",
    boardStyle: {
      boxShadow:
        "inset 0 0 0 1px oklch(0.95 0.015 250 / 0.6), 0 8px 30px -8px oklch(0.28 0.04 260 / 0.45)",
    },
  },
};

export type BoardSkinStyles = {
  lightSquareStyle: CSSProperties;
  darkSquareStyle: CSSProperties;
  boardStyle: CSSProperties;
};

export function boardSkinStyles(slug: string | null | undefined): BoardSkinStyles {
  const baseBoard: CSSProperties = {
    borderRadius: "8px",
    boxShadow: "0 4px 24px -8px oklch(0 0 0 / 0.2)",
    overflow: "hidden",
  };
  const skin = slug && BOARD_SKINS[slug] ? BOARD_SKINS[slug] : null;
  if (!skin) {
    return {
      lightSquareStyle: { backgroundColor: DEFAULT_LIGHT },
      darkSquareStyle: { backgroundColor: DEFAULT_DARK },
      boardStyle: baseBoard,
    };
  }
  const boardStyle = { ...baseBoard, ...skin.boardStyle };
  if (baseBoard.boxShadow && skin.boardStyle?.boxShadow) {
    boardStyle.boxShadow = `${skin.boardStyle.boxShadow}, ${baseBoard.boxShadow}`;
  }
  return {
    lightSquareStyle: { backgroundColor: skin.light },
    darkSquareStyle: { backgroundColor: skin.dark },
    boardStyle,
  };
}

/** Tailwind classes for a ring around a circular avatar / initials tile. */
export function avatarFrameRingClass(slug: string | null | undefined): string {
  switch (slug) {
    case "bronze_ring":
      return "ring-[3px] ring-amber-700/85 ring-offset-2 ring-offset-background";
    case "crystal_frame":
      return "ring-[3px] ring-cyan-400/85 shadow-[0_0_14px_rgba(34,211,238,0.45)] ring-offset-2 ring-offset-background";
    case "crown_frame":
      return "ring-[3px] ring-yellow-500/85 shadow-[0_0_12px_rgba(234,179,8,0.4)] ring-offset-2 ring-offset-background";
    default:
      return "";
  }
}

export const MOCK_COIN_PACKS = [
  { slug: "coins_500_mock_099" as const, coins: 500, usdLabel: "$0.99" },
  { slug: "coins_1200_mock_199" as const, coins: 1200, usdLabel: "$1.99" },
  { slug: "coins_3000_mock_499" as const, coins: 3000, usdLabel: "$4.99" },
] as const;

export function mapCosmeticPurchaseError(message: string): string {
  if (message.includes("ALREADY_OWNED")) return "You already own this item.";
  if (message.includes("INSUFFICIENT_FUNDS")) return "Not enough coins.";
  if (message.includes("ITEM_NOT_FOUND")) return "That item is not available.";
  if (message.includes("NOT_OWNED")) return "Buy this item in the store before equipping.";
  if (message.includes("INVALID_ITEM_KIND")) return "This item cannot be equipped.";
  return message;
}

export function mapMockPurchaseError(message: string): string {
  if (message.includes("INVALID_PACK_SLUG")) return "Unknown coin pack.";
  if (message.includes("WALLET_MISSING")) return "Wallet not ready — refresh the page.";
  return message;
}
