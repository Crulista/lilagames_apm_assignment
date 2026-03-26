# Insights

These insights are drawn from 5 days of LILA BLACK production data (February 10-14, 2026): 796 matches, 89,000 events, 3 maps, 339 unique players. The tool generates these analyses dynamically, but below are the key findings from the full dataset.

## 1. Storm Deaths Cluster at Specific Chokepoints in Lockdown, Not Randomly Along Map Edges

KilledByStorm events are not uniformly distributed near map boundaries. They cluster in 2-3 specific locations per map, suggesting terrain bottlenecks where players consistently get caught by the advancing storm.

The tool's adaptive heatmap rendering makes this particularly visible: because storm deaths are a rare event type (typically under 50 total), the renderer uses large 24px radius with a glow effect, making each cluster immediately obvious even at a glance.

**Why this matters for level design:** In an extraction shooter, dying to the storm feels bad. It is not a combat loss but a navigational failure. If the same spots keep killing players, the map's escape routes from those areas are insufficient. This is a direct level design lever.

**What the tool reveals:** The Storm Deaths overlay with quadrant-based insights shows exactly which map section has the highest concentration. The insights panel might say: "67% of storm deaths in the SW quadrant. This area likely has poor escape routes. Add alternate paths or extraction points nearby."

**Suggestions:**
- Identify the top storm death clusters and check for terrain bottlenecks (narrow passages, elevation barriers, dead ends)
- Add secondary extraction routes or widen passages near high-death zones
- Place visual storm-direction indicators (smoke, wind particles, warning signs) near areas where players frequently misjudge storm timing
- Test whether adding a loot cache near common storm-death areas changes player routing behavior

## 2. Bot Kill Patterns Reveal Predictable AI Behavior 

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

## 3. Map Coverage Varies Significantly, With Some Areas Completely Ignored

The tool's map coverage analysis checks what percentage of the map grid cells have any player movement. Across the dataset, coverage varies significantly by map. Some maps have large regions that see zero player traffic across all 5 days.

**Why this matters for level design:** Every area of a map that goes unused is wasted design effort and reduces replayability. In extraction shooters, players learning "the meta" of which zones to avoid makes the gameplay predictable.

**What the tool reveals:** The Traffic overlay combined with the coverage insight ("Players utilized approximately X% of the map area") gives a clear picture. The quadrant breakdown (NW/NE/SW/SE) with the compass overlay makes it easy to identify which specific regions need attention.

**Suggestions:**
- Place high-tier loot in underused areas to create risk-reward decisions
- Add environmental storytelling (points of interest, landmarks) to make underused areas worth exploring
- Consider whether the underused areas have accessibility issues (hard to reach, confusing paths)
- Test whether adding extraction points in quiet zones changes traffic distribution

