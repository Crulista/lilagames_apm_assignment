# Insights

These insights are drawn from 5 days of LILA BLACK production data (February 10-14, 2026): 796 matches, 89,000 events, 3 maps, 339 unique players. The tool generates these analyses dynamically, but below are the key findings from the full dataset.

## 1. Ambrose Valley Dominates Play, Leaving Grand Rift and Lockdown Underexplored

Ambrose Valley consistently has 2-4x more matches than Grand Rift per day, and Lockdown has the fewest matches overall. This is not just a "primary map" effect. The traffic heatmap for Lockdown shows players concentrated in a few corridors rather than utilizing the full map space. Grand Rift shows similar underutilization in its outer regions.

**Why this matters for level design:** If large portions of a map see no traffic, the map is effectively smaller than designed. This reduces gameplay variety and wastes development effort on geometry that players never interact with.

**What the tool reveals:** Switching to the Analytics tab and selecting Traffic overlay for Lockdown immediately shows which areas are dead zones (dark patches with zero movement density). Cross-referencing with Kill Zones shows these dead zones also have no combat, confirming players have no reason to go there.

**Suggestions:**
- Add high-value loot caches or extraction points in underutilized areas of Lockdown and Grand Rift
- Consider adjusting matchmaking rotation to push more players toward underplayed maps
- Place bot patrol routes through dead zones to create encounters that draw players into those areas
- Monitor if changes affect match duration, kills per match, and map area utilization

## 2. Storm Deaths Cluster at Specific Chokepoints, Not Randomly Along Map Edges

KilledByStorm events are not uniformly distributed near map boundaries. They cluster in 2-3 specific locations per map, suggesting terrain bottlenecks where players consistently get caught by the advancing storm.

The tool's adaptive heatmap rendering makes this particularly visible: because storm deaths are a rare event type (typically under 50 total), the renderer uses large 24px radius with a glow effect, making each cluster immediately obvious even at a glance.

**Why this matters for level design:** In an extraction shooter, dying to the storm feels bad. It is not a combat loss but a navigational failure. If the same spots keep killing players, the map's escape routes from those areas are insufficient. This is a direct level design lever.

**What the tool reveals:** The Storm Deaths overlay with quadrant-based insights shows exactly which map section has the highest concentration. The insights panel might say: "67% of storm deaths in the SW quadrant. This area likely has poor escape routes. Add alternate paths or extraction points nearby."

**Suggestions:**
- Identify the top storm death clusters and check for terrain bottlenecks (narrow passages, elevation barriers, dead ends)
- Add secondary extraction routes or widen passages near high-death zones
- Place visual storm-direction indicators (smoke, wind particles, warning signs) near areas where players frequently misjudge storm timing
- Test whether adding a loot cache near common storm-death areas changes player routing behavior

## 3. Bot Kill Patterns Reveal Predictable AI Behavior That Players May Be Farming

When examining individual match playbacks, bot movement paths are noticeably more linear compared to human paths. Humans show tactical movement (zigzagging, backtracking, holding positions), while bots follow relatively straight lines. BotKill events cluster in the same areas across different matches, suggesting bots follow similar patrol routes.

The tool detects this pattern automatically. When a match has significantly more bot kills than PvP kills, the insights panel flags it as a "Bot Farming Pattern" with specific numbers and suggestions.

**Why this matters for level design:** If bots are too predictable, they stop serving their game design purpose (providing dynamic combat encounters). When players learn to farm bots in fixed locations, it devalues PvP encounters and creates an imbalanced meta where the "optimal strategy" is to avoid other humans and just farm bots for loot.

**What the tool reveals:** Select a match in Explorer mode. If the insights panel shows "12 bot kills vs 2 PvP kills," combined with human paths that move directly to known bot locations, this is farming behavior. The per-event opacity sliders help here: fade BotKill markers to see where human Kill events cluster separately.

**Suggestions:**
- Introduce route randomization for bot spawning and patrolling
- Reduce bot density in areas that already have high human traffic
- Increase bot density in dead zones to incentivize exploration
- Make bot loot less valuable than PvP loot to encourage human engagement
- Monitor if bot route changes affect PvP encounter rates

## 4. Map Coverage Varies Significantly, With Some Areas Completely Ignored

The tool's map coverage analysis checks what percentage of the map grid cells have any player movement. Across the dataset, coverage varies significantly by map. Some maps have large regions that see zero player traffic across all 5 days.

**Why this matters for level design:** Every area of a map that goes unused is wasted design effort and reduces replayability. In extraction shooters, players learning "the meta" of which zones to avoid makes the gameplay predictable.

**What the tool reveals:** The Traffic overlay combined with the coverage insight ("Players utilized approximately X% of the map area") gives a clear picture. The quadrant breakdown (NW/NE/SW/SE) with the compass overlay makes it easy to identify which specific regions need attention.

**Suggestions:**
- Place high-tier loot in underused areas to create risk-reward decisions
- Add environmental storytelling (points of interest, landmarks) to make underused areas worth exploring
- Consider whether the underused areas have accessibility issues (hard to reach, confusing paths)
- Test whether adding extraction points in quiet zones changes traffic distribution

## 5. Combat Timing is Front-Loaded: Most Action Happens Early

The tool's early vs late game analysis splits match events at the midpoint and compares combat counts. Across many matches, combat is concentrated in the first half of the recording, with the second half being quieter.

**Why this matters for level design:** In an extraction shooter, the storm should create escalating tension. If most combat happens early and then players either extract or die, the late game lacks engagement. The storm mechanic may not be creating enough pressure to force interesting late-game encounters.

**Suggestions:**
- Increase the value of late-game loot spawns to reward staying longer
- Create extraction windows that open in phases rather than being always available
- Add late-game events (supply drops, high-value target spawns) that create contested objectives
- Test whether tightening the storm timeline pushes more combat into the second half

## How These Insights Are Generated

The tool does not use external AI or API calls for insights. The analysis engine (192 lines of JavaScript) examines the actual data: counts events, checks quadrant distribution, calculates coverage grids, compares ratios, and generates level-designer-specific suggestions based on extraction shooter game design principles.

This means insights update instantly when the designer switches maps, changes days, or selects a different match. There is no loading delay and no cost per analysis.

The quadrant references (NW, NE, SW, SE) correspond to the compass drawn on the map canvas, making it easy to locate the areas mentioned in each insight.
