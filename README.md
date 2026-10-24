# premelo

Elo ratings for every Premier League and Championship club, and the chances for each coming Premier League match,
computed from results since August 1993. A static site on GitHub Pages; everything it shows is plain JSON in `data/`.

**Site:** https://melvincarvalho.github.io/premelo/

## How it works

- **Ratings.** One Elo pool for the top two divisions. After each match both clubs move by
  `K × margin × (result − expected)`, the home side's expected score including a home advantage. Between seasons
  every club is pulled a little towards its division's average. A club up from League One (where there are no results
  here) takes the average rating of the clubs that went down to it. The first season is played through once as a
  warm-up, so 1993's flat starting ratings don't show.
- **Predictions.** The rating gap becomes expected goals, `μ/2 · e^(±gap/c)` a side. Poisson scores, with 0-0 and 1-1
  made a little likelier, give home/draw/away, the goal lines, both teams to score and the likeliest scores.
- **Tuning.** Every setting in `params.json` was chosen by `scripts/backtest.mjs --tune`. It predicts each Premier League
  match since 2000-01 from the ratings before it and keeps the settings with the lowest log loss.

## How good it is

Over 9,950 Premier League matches, 2000-01 to now (`data/backtest.json`):

| | Log loss | RPS |
|---|---|---|
| premelo | 0.976 | 0.198 |
| Bookmakers, margin removed (closing prices from 2012-13) | 0.965 | 0.1945 |
| Home/draw/away base rates only | ~1.07 | |

That is about where the literature puts results-only models. Nothing published reliably beats closing odds.

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
  `cache/` (not published). `data/results.csv` keeps only the results, which are facts. Their bookmaker odds are read
  by the backtest and never republished.
- **This season's latest results and fixtures:** [matchday](https://melvin.me/public/matchday/), in Football Schema JSON-LD.

## Running it

```sh
node scripts/fetch.mjs              # every season into cache/, one request a second
node scripts/import.mjs             # cache/ -> data/results.csv
node scripts/backtest.mjs [--tune]  # score (or tune) -> data/backtest.json, params.json
node scripts/build.mjs              # -> data/ratings.json, data/fixtures.json, data/clubs/*.json
npm test
```

No dependencies: Node 22 or later. A GitHub Action (`.github/workflows/update.yml`) refreshes this season's results and
rebuilds twice a day.

| File | What's in it |
|---|---|
| `data/ratings.json` | every club of this season's top two divisions: rating, rank, 30-day change, form, last 20 ratings |
| `data/clubs/<club>.json` | a club's rating after each of its league matches since 1993: `[date, elo, opponent, for, against, h/a, division]` |
| `data/fixtures.json` | the rest of the Premier League season: home/draw/away, expected goals, over 2.5, both to score, likeliest scores |
| `data/backtest.json` | the scores by season, against the bookmakers, and calibration |
| `data/results.csv` | every match: `date,season,div,home,away,hg,ag` |
