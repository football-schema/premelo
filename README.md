# premelo

Elo ratings for every club in Europe's big five leagues and their second divisions (Premier League, La Liga,
Bundesliga, Serie A, Ligue 1), and the chances for each coming match, computed from results since 1993. A static
site on GitHub Pages; everything it shows is plain JSON in `data/`.

**Site:** https://football-schema.github.io/premelo/

## How it works

- **Ratings.** Every league runs its top two divisions with its own settings, and the European cups tie the five
  together into one scale, as ClubElo does: they are the only matches between countries. A European result moves the
  two clubs, and moves each club's whole league a little too, since only the clubs at the top ever play in Europe (a
  shift of a whole league changes no gap inside it, so domestic predictions don't feel it). Clubs from outside the big
  five enter at a set distance below the five's average and move only with their European results. After each match both clubs move by
  `K × margin × (result − expected)`, the home side's expected score including a home advantage. Between seasons
  every club is pulled a little towards its division's average. A club up from League One (where there are no results
  here) takes the average rating of the clubs that left the pool. Serie B and Ligue 2 are in the files only from
  1997-98; before that, arrivals take the rating of the clubs relegated from the top. The first season is played through once as a
  warm-up, so 1993's flat starting ratings don't show.
- **Predictions.** The rating gap becomes expected goals, `μ/2 · e^(±gap/c)` a side, with the same `c` in every
  league, so a gap means the same chances everywhere. Poisson scores, with 0-0 and 1-1
  made a little likelier, give home/draw/away, the goal lines, both teams to score and the likeliest scores.
- **Tuning.** Every setting in `params.json` was chosen per league by `scripts/backtest.mjs --tune`. It predicts each
  top-division match since 2000-01 from the ratings before it and keeps the settings with the lowest log loss.

## How good it is

Every top-division match from 2000-01 to now, predicted from the ratings before it (`data/<league>/backtest.json`),
next to the bookmakers' prices with their margin taken out (closing prices from 2012-13). Lower is better:

| League | Matches | premelo log loss | Bookmakers | premelo RPS | Bookmakers |
|---|---|---|---|---|---|
| Premier League | 9,950 | 0.977 | 0.965 | 0.199 | 0.1945 |
| La Liga | 9,967 | 0.985 | 0.970 | 0.201 | 0.1959 |
| Bundesliga | 8,010 | 1.001 | 0.990 | 0.207 | 0.2033 |
| Serie A | 9,646 | 0.983 | 0.961 | 0.196 | 0.1893 |
| Ligue 1 | 9,470 | 1.015 | 1.003 | 0.205 | 0.2016 |

European cups (3,388 matches since 2011-12): log loss 0.953, against 1.047 for base rates (`data/europe.json`).

Against ClubElo's published table of 23 January 2025 (archived), the order within each league correlates at
0.986-0.994, and the clubs at the top land close: Real Madrid 1951 (ClubElo 1952), Liverpool 2011 (2001),
Chelsea 1860 (1859), Atalanta 1897 (1908), Barcelona 1873 (1890).

A baseline that knows only how often home sides, draws and away sides win scores about 1.07. Being 0.01-0.02 behind
the closing odds is about where the literature puts results-only models; nothing published reliably beats them.

## What the research suggests next

From a survey of the field (Bunker, Yeung & Fujii 2024, [arXiv:2403.07669](https://arxiv.org/abs/2403.07669); Ley et al. 2019,
[arXiv:1705.09575](https://arxiv.org/abs/1705.09575); the 2017 Soccer Prediction Challenge; ClubElo's and FiveThirtyEight's methods),
ranked by expected gain:

1. **A second model, blended.** A Dixon-Coles / Poisson strength model with time decay (half-life about a year),
   averaged with the Elo or combined in an ordered logit. Blends and rating-features models beat single ratings
   consistently, by about 0.002-0.005 log loss.
2. **Separate attack and defence ratings.** Little gain on home/draw/away, but much better goal lines and scores.
3. **A better promoted-club prior,** tuned on the opening weeks of each season.
4. **A fairer benchmark.** De-vig the closing odds with Shin's or the power method rather than plain normalisation.

Already in: a margin-of-victory factor, home advantage set separately for the empty stadiums of June 2020 to May 2021
(tuned to zero), a draw boost (doing the work of Dixon-Coles's ρ), RPS reported next to log loss.

## Data

- **Results, 1993 on:** [football-data.co.uk](https://www.football-data.co.uk/). `scripts/fetch.mjs` downloads their season files into
  `cache/` (not published). `data/<league>/results.csv` keeps only the results, which are facts. Their bookmaker odds are read
  by the backtest and never republished.
- **This season's latest results and fixtures:** [matchday](https://melvin.me/public/matchday/), in Football Schema JSON-LD.
- **European cups:** [openfootball/champions-league](https://github.com/openfootball/champions-league) (CC0): the Champions League
  from 2011-12, the Europa and Conference Leagues from 2020-21, in `data/europe.csv` (a neutral-ground final's div is `EUN`).

## Running it

```sh
node scripts/fetch.mjs              # every season into cache/, one request a second
node scripts/import.mjs             # cache/ -> data/<league>/results.csv
node scripts/backtest.mjs [--tune]  # score (or tune) -> data/backtest.json, params.json
node scripts/build.mjs              # -> data/<league>/ratings.json, fixtures.json, clubs/*.json, and the card
npm test
```

No dependencies: Node 22 or later. To update after a matchday: `node scripts/fetch.mjs --current && node scripts/import.mjs --current && node scripts/build.mjs`, then commit and push. The site is the `gh-pages` branch as it is.

| File | What's in it |
|---|---|
| `data/leagues.json` | the leagues, with each one's top three |
| `data/europe.csv` | every European cup match: `date,season,div,home,away,hg,ag`, big-five clubs under football-data's names, others as `Name (CCC)` |
| `data/europe.json` | how well the European matches were predicted |
| `data/<league>/ratings.json` | every club of this season's top two divisions: rating, rank, 30-day change, form, last 20 ratings |
| `data/<league>/clubs/<club>.json` | a club's rating after each of its matches since 1993: `[date, elo, opponent, for, against, h/a/n, top/second/europe, opponent's league]` |
| `data/<league>/fixtures.json` | coming matches (the rest of the season for the Premier League, the next week or so elsewhere): home/draw/away, expected goals, over 2.5, both to score, likeliest scores |
| `data/<league>/backtest.json` | the scores by season, against the bookmakers, and calibration |
| `data/<league>/results.csv` | every match: `date,season,div,home,away,hg,ag` |

Leagues: `pl`, `laliga`, `bundesliga`, `seriea`, `ligue1`.
