import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

/** True when any of the shapes the API uses for a verified member is set. */
export function isVerified(row: any): boolean {
  return Boolean(row?.is_verified || row?.verified_badge || row?.verified_tick || row?.is_profile_verified);
}

/**
 * The official blue verified tick — same geometry as the website's badge
 * (circle #1877F2, white check). Shown beside verified contestants everywhere.
 */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Circle cx={256} cy={256} r={256} fill="#1877F2" />
      <Path d="M152 254L225 327L360 176" stroke="#FFFFFF" strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Convenience: renders the badge only when the row qualifies. */
export function VerifiedTick({ row, size = 16 }: { row: any; size?: number }) {
  if (!isVerified(row)) return null;
  return <VerifiedBadge size={size} />;
}
