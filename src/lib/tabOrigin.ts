/**
 * Where did the user come from? A tiny tracker for the bottom-tab app.
 *
 * The Events tab keeps its own stack. Opening an event from Home switches to
 * that tab and pushes the detail — so a plain "back" pops to whatever the
 * Events stack held before (an event opened earlier), not to Home. The tab
 * layout reports tab focus here, the Events list reports when it is actually
 * seen, and the event detail uses both to send "back" to the right place.
 */
let current: string | null = null;
let previous: string | null = null;
let listSeen = false;

/** Called by the tab layout whenever a tab gains focus. */
export function noteTab(name: string) {
  if (name === current) return;
  previous = current;
  current = name;
  if (name === "events") listSeen = false; // entering Events: the list hasn't been looked at yet
}

/** Called by the Events list when it is on screen. */
export function noteEventsListSeen() {
  listSeen = true;
}

/** The tab the user was on before the Events tab, if they jumped straight into an event from it. */
export function eventOrigin(): string | null {
  if (current !== "events" || listSeen) return null;
  return previous && previous !== "events" ? previous : null;
}

/** Route for a tab name. */
export function tabHref(name: string): string {
  return name === "index" ? "/(user)" : `/(user)/${name}`;
}
