# Insights

## 1. Ambrose Valley Dominates Play — Grand Rift and Lockdown May Be Underserving Their Potential

**What caught my eye:** Match distribution is heavily skewed toward Ambrose Valley. It consistently has 2-4x more matches than Grand Rift, and Lockdown has the fewest matches overall.

**Evidence:** The match index shows Ambrose Valley accounting for the majority of matches across all five days. The traffic heatmap for Lockdown shows players concentrated in a few corridors rather than utilizing the full map space. Grand Rift shows similar underutilization in its outer regions.

**Actionable items:**
- Overlay traffic heatmap on Lockdown and Grand Rift to identify dead zones (areas with near-zero player movement)
- Cross-reference dead zones with kill/death heatmaps. If players never go there AND never fight there, the geometry needs reworking or loot incentives
- Consider adjusting matchmaking rotation to push more players toward underplayed maps, then measure if engagement metrics change
- Add objectives, high-value loot, or extraction points in underutilized areas to incentivize exploration

**Why a level designer should care:** If large portions of a map see no traffic, the map is effectively smaller than designed. This reduces gameplay variety and wastes development effort. The tool's traffic heatmap makes dead zones immediately visible.

**Metrics affected:** Map-specific play rate, map area utilization %, average match duration per map, player retention per map

---

## 2. Storm Deaths Cluster at Specific Chokepoints, Not Randomly Along Edges

**What caught my eye:** KilledByStorm events aren't uniformly distributed near map boundaries. They cluster in 2-3 specific locations per map, suggesting terrain bottlenecks where players consistently get caught.

**Evidence:** The storm death heatmap shows concentrated hotspots rather than a uniform edge distribution. On Ambrose Valley, there are clear clusters that likely correspond to narrow passages, elevation changes, or areas with limited escape routes. Players appear to be funneling through the same chokepoints and getting caught by the advancing storm.

**Actionable items:**
- Identify the top 3 storm death clusters per map
- Check if those locations have terrain bottlenecks (narrow paths, elevation barriers, dead ends)
- Add secondary extraction routes or widen passages near high-death zones
- Consider visual indicators near common storm-death areas showing storm direction and nearest safe zone
- Test whether placing a loot incentive near these areas changes player routing timing (move earlier vs. risk storm)

**Why a level designer should care:** Storm deaths feel unfair to players. They're navigational failures, not combat losses. When the same spots kill players repeatedly, it signals a level design problem that directly affects player satisfaction and retention.

**Metrics affected:** Storm death rate, average survival time, player frustration sentiment, match completion rate

---

## 3. Bot Kill Patterns Suggest Predictable AI Behavior That Players May Be Farming

**What caught my eye:** BotKill events cluster in the same areas across different matches, and bot movement paths (visible in timeline playback) are noticeably more linear and predictable than human paths.

**Evidence:** The kill zone heatmap shows tighter clustering for bot kills compared to human kills, suggesting bots patrol similar routes. In timeline playback, human players show erratic tactical movement (zigzagging, holding positions, backtracking), while bots follow relatively straight-line paths. Some human players show clear hunting patterns, moving directly to known bot locations, getting kills, then extracting.

**Actionable items:**
- Map BotKill hotspots and cross-reference with bot patrol data to confirm static pathing
- Introduce route randomization for bot spawning and movement to distribute encounters more evenly
- Monitor whether bot route changes affect PvP encounter rates (if bots are less farmable, players encounter more humans)
- Reduce bot density in areas with already-high human traffic; increase in dead zones to incentivize exploration

**Why a level designer should care:** Predictable bots undermine gameplay quality. When the optimal strategy is "farm bots in known locations and extract," it devalues PvP encounters and creates a stale meta. The tool's timeline playback makes bot predictability visually obvious when comparing bot vs. human movement patterns.

**Metrics affected:** Bot kill distribution evenness, PvP encounter rate, map area utilization, gameplay variety score
