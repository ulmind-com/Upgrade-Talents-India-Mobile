/** The fields the backend treats as mandatory before a member can transact. */
const REQUIRED = ["phone_number", "date_of_birth", "address", "parent_phone_number"] as const;

const filled = (v: any) => v != null && String(v).trim() !== "";

/**
 * Whether a signed-in member has finished the mandatory onboarding.
 *
 * The backend sets `is_profile_completed` / `profile_completed` once the wizard
 * is done, but older rows predate the flag — so a complete set of the required
 * fields counts as done too. A name is assumed from sign-up and not re-demanded.
 */
export function profileComplete(user: any): boolean {
  if (!user) return true; // nothing to gate when signed out
  if (user.is_profile_completed === true || user.profile_completed === true) return true;
  // An explicit server signal wins when present.
  if (user.needs_profile === true || user.profile_complete === false) return false;
  return REQUIRED.every((f) => filled(user[f]));
}

/** Which required fields are still blank — drives the wizard's prefill. */
export function missingProfileFields(user: any): string[] {
  if (!user) return [];
  return REQUIRED.filter((f) => !filled(user[f]));
}
