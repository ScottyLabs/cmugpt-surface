/**
 * CMU Maps addresses every building by a short code (MUD, STE, GHC) and
 * accepts nothing else. Handed a name instead, it reports "Invalid building
 * code", throws away the route, and sends the map back to the campus overview,
 *
 * The agent writes its map links the way a person names a building: "mudge",
 * "Stever House". This file turns those into the codes the map answers to. The
 * list below is the map's own, from its `/buildings` endpoint; it is kept here
 * rather than fetched because a request would have to finish before the frame
 * could start loading, and building codes effectively never change.
 */

/** Every building CMU Maps knows, as `[code, name]`. */
const BUILDINGS: readonly (readonly [string, string])[] = [
  ["2SC", "205 S. Craig"],
  ["3SC", "300 S. Craig (Police)"],
  ["4SC", "407 S. Craig"],
  ["AH", "Alumni House"],
  ["AN", "Ansys Hall"],
  ["BH", "Baker Hall"],
  ["BOS", "Boss House"],
  ["BR", "Bramer House"],
  ["CC", "417 S. Craig"],
  ["CFA", "College of Fine Arts"],
  ["CIC", "Collaborative Innovation Center"],
  ["CLY", "Clyde House"],
  ["CUC", "Cohon University Center"],
  ["CYH", "Cyert Hall"],
  ["DH", "Doherty Hall"],
  ["DON", "Donner House"],
  ["EDS", "Smith Hall"],
  ["FAF", "Fairfax Apartments"],
  ["FBA", "Forbes Beeler Apartments"],
  ["FCL", "Fifth and Clyde House"],
  ["FIF", "Fifth Neville Apartments"],
  ["FM", "Facilities Management Services Building"],
  ["FRB", "4615 Forbes (CTTEC)"],
  ["GHC", "Gates & Hillman Centers"],
  ["GQ1", "Greek Quad"],
  ["GQ2", "Greek Quad"],
  ["GQ3", "Greek Quad"],
  ["GQ4", "Greek Quad"],
  ["GQ5", "Greek Quad"],
  ["GQ6", "Greek Quad"],
  ["HAM", "Hamerschlag House"],
  ["HBH", "Hamburg Hall"],
  ["HEN", "Henderson House"],
  ["HH", "Hamerschlag Hall"],
  ["HIL", "Highlands Apartments"],
  ["HL", "Hunt Library"],
  ["HOA", "Hall of the Arts"],
  ["INI", "4616 Henry"],
  ["MC", "4721 Fifth Ave (CDFD)"],
  ["MCG", "McGill House"],
  ["MI", "Mellon Institute"],
  ["MM", "Margaret Morrison Carnegie Hall"],
  ["MMA", "Margaret Morrison Apartments Greek Housing"],
  ["MOE", "Morewood E-Tower"],
  ["MOR", "Morewood Gardens"],
  ["MUD", "Mudge House"],
  ["NSH", "Newell-Simon Hall"],
  ["NVL", "Neville Apartments"],
  ["PC", "Posner Center"],
  ["PCA", "Purnell Center for the Arts"],
  ["PH", "Porter Hall"],
  ["PO", "620 Henry"],
  ["POS", "Posner Hall"],
  ["REH", "Roberts Engineering Hall"],
  ["RES", "Resnik House"],
  ["ROF", "Residence on Fifth"],
  ["ROS1", "Roselawn Terrace"],
  ["ROS2", "Roselawn Terrace"],
  ["ROS3", "Roselawn Terrace"],
  ["SC", "Scott Hall"],
  ["SCO", "Scobell House"],
  ["SH", "Scaife Hall"],
  ["SPT", "Spirit House"],
  ["STE", "Stever House"],
  ["TCS", "TCS Hall"],
  ["TEP", "Tepper Building"],
  ["UT", "4516 Henry (UTDC)"],
  ["WEH", "Wean Hall"],
  ["WEL", "Welch House"],
  ["WF", "Whitfield Hall"],
  ["WH", "Warner Hall"],
  ["WOO", "Woodlawn Apartments"],
  ["WQ", "WQED Building"],
  ["WWG", "West Wing"],
];

/**
 * Names people shorten past what dropping a suffix below would reach, and the
 * two names that belong to more than one building but mean only one of them in
 * practice. Applied after the derived names, so these win.
 */
const EXTRA_ALIASES: readonly (readonly [string, string])[] = [
  ["cohon", "CUC"],
  ["gates", "GHC"],
  ["hamerschlag", "HH"],
  ["margaretmorrison", "MM"],
  ["mellon", "MI"],
  ["morewood", "MOR"],
  ["purnell", "PCA"],
  ["studentunion", "CUC"],
  ["universitycenter", "CUC"],
];

/** The word ending a building's name that people drop when they say it out
 *  loud: "Mudge House" is "Mudge". */
const DROPPABLE_NAME_ENDING = /\s+(?:apartments|building|centers?|hall|house|library)$/iu;

/** Names compare on their letters and digits alone, so "Newell-Simon Hall"
 *  matches whether it arrives hyphenated, spaced, or lowercase. */
function aliasKey(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "");
}

/**
 * Every spelling of a building that resolves to a single code. A name shared by
 * several buildings — "Greek Quad" covers six — resolves to none of them:
 * guessing which one was meant would send someone to the wrong door, and
 * leaving the identifier alone is what the caller already does with anything it
 * does not recognise.
 */
function buildAliasIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const ambiguous = new Set<string>();
  function add(alias: string, code: string) {
    const key = aliasKey(alias);
    const existing = index.get(key);
    if (existing !== undefined && existing !== code) {
      ambiguous.add(key);
      return;
    }
    index.set(key, code);
  }
  for (const [code, name] of BUILDINGS) {
    add(name, code);
    add(name.replace(DROPPABLE_NAME_ENDING, ""), code);
  }
  for (const key of ambiguous) {
    index.delete(key);
  }
  for (const [alias, code] of EXTRA_ALIASES) {
    index.set(aliasKey(alias), code);
  }
  // Last, so that a code always stands for its own building no matter what the
  // names above made of it, and so a URL that already holds one survives.
  for (const [code] of BUILDINGS) {
    index.set(aliasKey(code), code);
  }
  return index;
}

const ALIAS_INDEX = buildAliasIndex();

/**
 * Waypoints that are not a plain building name. A comma is a coordinate pair, a
 * colon is the map's `floor:` prefix, and a slash is a nested route such as
 * `events/<id>`. Each already carries a code where it needs one, so translating
 * would only corrupt them.
 */
const STRUCTURED_WAYPOINT = /[,:/]/u;

/**
 * The CMU Maps building code for `value`, or null if it names no single
 * building. A room or floor waypoint such as `GHC-4301` returns null too: the
 * building code inside it is already a code, and rewriting the pair as a whole
 * would drop the room.
 */
export function cmuMapsBuildingCode(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "" || STRUCTURED_WAYPOINT.test(trimmed)) {
    return null;
  }
  return ALIAS_INDEX.get(aliasKey(trimmed)) ?? null;
}
