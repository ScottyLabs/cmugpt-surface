/**
 * Resolves place names to CMU Maps building codes. The map accepts only its
 * short codes such as MUD or GHC. Given a name it rejects the waypoint,
 * discards the route, and falls back to the campus overview. The agent may
 * still write names like mudge or Stever House, so this table translates
 * them. The list mirrors the map's own /buildings endpoint and is kept inline
 * because codes effectively never change and a fetch would delay the frame.
 */

/** Every building CMU Maps knows, as code and name pairs. */
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
 * Shortenings beyond suffix dropping, plus shared names that mean one building
 * in practice. Applied after the derived names, so these win.
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

/** Trailing generic word dropped in speech, Mudge House resolves as Mudge. */
const DROPPABLE_NAME_ENDING = /\s+(?:apartments|building|centers?|hall|house|library)$/iu;

/** Compares on letters and digits only, ignoring hyphens, spaces, and case. */
function aliasKey(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "");
}

/**
 * Index of every spelling that resolves to a single code. A name shared by
 * several buildings, such as Greek Quad, resolves to none of them rather than
 * guessing.
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
  // Added last so a code always stands for its own building even when name
  // derivation made it ambiguous.
  for (const [code] of BUILDINGS) {
    index.set(aliasKey(code), code);
  }
  return index;
}

const ALIAS_INDEX = buildAliasIndex();

/**
 * Waypoints that are not plain building names. A comma marks coordinates, a
 * colon the floor prefix, a slash a nested route. Each already carries any
 * code it needs.
 */
const STRUCTURED_WAYPOINT = /[,:/]/u;

/**
 * The building code for value, or null when it names no single building. Room
 * and floor waypoints such as GHC-4301 also return null because rewriting them
 * would drop the room.
 */
export function cmuMapsBuildingCode(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "" || STRUCTURED_WAYPOINT.test(trimmed)) {
    return null;
  }
  return ALIAS_INDEX.get(aliasKey(trimmed)) ?? null;
}
