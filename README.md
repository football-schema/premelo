# premelo

Elo ratings for the clubs of eleven European leagues on one scale, and the chances for each coming match, computed
from every result since 1993-94 and tested out of sample against the bookmakers' closing prices. A static site on
GitHub Pages; everything it shows is plain JSON in `data/`.

**Site:** https://football-schema.github.io/premelo/

Leagues: Premier League, La Liga, Bundesliga, Serie A and Ligue 1 (each with its second division), and the Primeira
Liga, Eredivisie, Pro League, Süper Lig, Scottish Premiership (with the Championship) and Greek Super League.

## How it works

- **Ratings.** Each league runs its own divisions, with its own settings, over every match since 1993-94. After each
  match both clubs move by `K × margin × (result − expected)`, the home side's expected score including a home
  advantage that is learnt as it goes (`kH`): home advantage has fallen since about 2015 and a fixed one can't follow
  it. Between seasons each club is pulled part of the way to its division's average; a club arriving from below
  (where there are no results here) takes the average rating of the clubs that left. The first season is played twice
  as a warm-up, so 1993's flat starting ratings don't show.
- **One scale.** The European cups are the only matches between countries, so they set one league against another, as
  ClubElo does: 20,252 Champions League, UEFA Cup / Europa League and Conference League matches since 1993-94,
  qualifiers included. A European result moves the two clubs, and moves each club's whole league (or, for a club from an
  unrated league, its country's clubs) a little the other way, since only the clubs at the top ever play in Europe. A
  shift of a whole league changes no gap inside it, so domestic predictions don't feel it. The scale's origin is set so
  the numbers read like ClubElo's; that moves every club alike and changes no gap or prediction.
- **Predictions.** Two models, blended per league (`params.json`'s `blend`). The Elo gap becomes expected goals,
  `μ/2 · e^(±gap/c)` a side, the same `c` in every league. A second model (`lib/attack.mjs`) rates each club's attack and
  defence in goals, updated online by how far its goals beat or missed expectation, and learns each division's home and
  away scoring rates. Each gives a Poisson score grid (0-0 and 1-1 made a little likelier); the grids are mixed, and
  home/draw/away, the goal lines, both teams to score and the likeliest scores all come from the mix.

## How good it is

Honestly scored: every setting, the Elo's, the attack/defence model's, the blend and the European ones, was tuned on
2000-01 to 2011-12 only (`params-holdout.json`), then frozen and scored on every top-division match since 2012-13,
which nothing was tuned on, against Pinnacle's closing prices with the margin taken out (`data/<league>/backtest.json`,
`test`). Lower is better:

| League | Matches | premelo log loss | Elo alone | Closing odds | premelo RPS | Closing odds |
|---|---|---|---|---|---|---|
| Premier League | 5,390 | 0.974 | 0.977 | 0.956 | 0.1994 | 0.1937 |
| La Liga | 5,409 | 0.968 | 0.972 | 0.953 | 0.1951 | 0.1903 |
| Bundesliga | 4,338 | 0.991 | 0.992 | 0.977 | 0.2034 | 0.1994 |
| Serie A | 5,390 | 0.977 | 0.979 | 0.952 | 0.1965 | 0.1887 |
| Ligue 1 | 5,060 | 1.002 | 1.004 | 0.985 | 0.2047 | 0.1996 |
| Primeira Liga | 4,224 | 0.932 | 0.933 | 0.919 | 0.1855 | 0.1818 |
| Eredivisie | 4,291 | 0.958 | 0.961 | 0.944 | 0.1940 | 0.1894 |
| Pro League | 3,837 | 1.004 | 1.008 | 0.985 | 0.2081 | 0.2020 |
| Süper Lig | 4,661 | 1.002 | 1.003 | 0.982 | 0.2047 | 0.1984 |
| Scottish Premiership | 3,197 | 0.972 | 0.973 | 0.955 | 0.1992 | 0.1937 |
| Super League (Greece) | 3,504 | 0.947 | 0.949 | 0.916 | 0.1867 | 0.1778 |
| **All** | **49,301** | **0.9760** | **0.9782** | **0.9576** | **0.1981** | **0.1925** |

A baseline that knows only how often home sides, draws and away sides win scores about 1.07. premelo is about
0.018 behind the closing line, which is where the literature puts results-only models; nothing
published reliably beats closing odds. The published model (`params.json`) is the same method tuned on all the
seasons; its in-sample scores (`all` in each backtest file) flatter it and are not the claim.

**Against ClubElo.** On ClubElo's table of 24 October 2026, the 37 clubs of these leagues in its top 40 are about 30
points apart on average (root mean square), most within 20. Agreement with ClubElo is not accuracy, though. The test
of the one scale is whether cross-country gaps predict European results: since 2015, in European matches between
clubs of different rated leagues, each league's clubs scored within about 2% of what premelo expected (Belgium +6.7%
and Scotland +4.3%, on 266 and 157 matches, are the exceptions: their clubs look underrated).

## What's not done, and what would help

- **xG or shots.** The biggest single gain reported elsewhere (FiveThirtyEight's SPI); football-data has shots and
  shots on target for top leagues, which could stand in. Not tried yet.
- **Uncertainty per club** (ClubElo now runs a Kalman filter: each club carries a ±, and new or rarely seen clubs move
  faster). Not tried yet.
- **Domestic cups** would link each league's divisions directly, not only through promotion and relegation.
- **More leagues** (Austria, Switzerland, Denmark, Norway, Sweden, Poland and others from football-data's extra files)
  would rate more of the European cups' clubs at home.
- Tried and found no help out of sample: an ordered logit in place of the Poisson grid, FiveThirtyEight's margin
  multiplier, a higher K early in the season or for promoted clubs, and a Dixon-Coles model on top of the blend.

## Data

- **League results, 1993 on:** [football-data.co.uk](https://www.football-data.co.uk/). `scripts/fetch.mjs` downloads their
  season files into `cache/` (not published). `data/<league>/results.csv` keeps only the results, which are facts. Their
  bookmaker odds are read by the backtest and never republished. Two of their files hold another division's rows
  (1993-94's Portuguese file is Spain's; Spain's second division for 1993-96 repeats the first); rows from the wrong
  division are dropped.
- **European cups:** UEFA's match data (match.uefa.com, the API behind uefa.com), fetched by `scripts/fetch-uefa.mjs`.
  UEFA's team ids keep one identity per club whatever it is called; awarded and abandoned matches are left out; only
  dates, clubs and 90-minute scores are kept, in `data/europe.csv` (a neutral-ground match's div is `EUN`).
- **This season's Premier League fixtures and latest results:** [matchday](https://melvin.me/public/matchday/), in Football
  Schema JSON-LD. Other leagues' coming fixtures: football-data's `fixtures.csv`.

## Running it

```sh
node scripts/fetch.mjs                          # league seasons into cache/, one request a second
node scripts/fetch-uefa.mjs                     # European cups into cache/uefa/
node scripts/import.mjs                         # -> data/<league>/results.csv, data/europe.csv
node scripts/backtest.mjs --tune --holdout      # tune on 2000-01..2011-12 -> params-holdout.json (and --tune-europe --holdout)
node scripts/backtest.mjs --tune                # tune on everything -> params.json (and --tune-europe)
node scripts/backtest.mjs                       # score -> data/<league>/backtest.json, data/europe.json
node scripts/build.mjs                          # -> ratings, fixtures, club histories, the card
npm test
```

After a matchday: `node scripts/fetch.mjs --current && node scripts/fetch-uefa.mjs --current && node scripts/import.mjs --current && node scripts/build.mjs`, then commit and push. No dependencies: Node 22 or later. The site is the `gh-pages` branch as it is.

| File | What's in it |
|---|---|
| `data/leagues.json` | the leagues, with each one's top three |
| `data/europe.csv` | every European cup match: `date,season,div,home,away,hg,ag`, rated clubs under football-data's names, others as `Name (CCC)` |
| `data/europe.json` | how well the European matches were predicted |
| `data/<league>/ratings.json` | every club of the league this season: rating, rank, 30-day change, form, last 20 ratings |
| `data/<league>/clubs/<club>.json` | a club's rating after each of its matches since 1993: `[date, elo, opponent, for, against, h/a/n, top/second/europe, opponent's league]` |
| `data/<league>/fixtures.json` | coming matches: home/draw/away, expected goals, over 2.5, both to score, likeliest scores |
| `data/<league>/backtest.json` | `test`: the holdout scores; `all`: in-sample; by season, against the bookmakers; calibration |
| `data/<league>/results.csv` | every match: `date,season,div,home,away,hg,ag` |

League ids: `pl`, `laliga`, `bundesliga`, `seriea`, `ligue1`, `primeira`, `eredivisie`, `proleague`, `superlig`, `scotland`, `superleague`.
