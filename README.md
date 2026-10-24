# premelo

Elo ratings for the clubs of twenty European leagues on one scale, and the chances for each coming match, computed
from every result since 1993-94 and tested out of sample against the bookmakers' closing prices. A static site on
GitHub Pages; everything it shows is plain JSON in `data/`.

**Site:** https://football-schema.github.io/premelo/

Leagues: Premier League, La Liga, Bundesliga, Serie A and Ligue 1 (each with its second division), the Primeira
Liga, Eredivisie, Pro League, Süper Lig, Scottish Premiership (with the Championship) and Greek Super League, all
from 1993-94 or so; and, from 2012, the Austrian, Swiss, Danish, Norwegian, Swedish, Polish, Romanian, Irish and
Finnish top divisions. (Russia is left out: its file stops in August 2026 and its clubs are barred from Europe.)

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
  away scoring rates. Where a match has shots on target it learns from the chances too: the goals it learns from are
  part goals scored, part shots on target × a conversion rate (both tuned; shots stay in the cache, unpublished). Each gives a Poisson score grid (0-0 and 1-1 made a little likelier); the grids are mixed, and
  home/draw/away, the goal lines, both teams to score and the likeliest scores all come from the mix.
- **Table and projection** (`lib/table.mjs`). Each division's table from this season's results, and, in the divisions
  played as a plain double round-robin (the big five's top two, Portugal, the Netherlands, Turkey, Poland, Norway and
  Sweden: `PLACES` in `lib/leagues.mjs`), every remaining pairing played out 10,000 times from its chances, the ratings held
  where they are today. Each result is drawn from home/draw/away and its score from the expected goals given that result,
  for goal difference. Out of that: projected points and the chance of the title, the top four or automatic promotion, and
  direct relegation. Ties split on goal difference, then goals; head-to-head rules, deductions and play-offs aren't
  modelled. The generator is seeded, so the same results give the same numbers. Leagues that split into further rounds
  (Belgium, Scotland, Greece, Austria, Switzerland, Denmark, Romania, Finland) or meet three times (Ireland) get the table only.

## How good it is

Honestly scored: every setting, the Elo's, the attack/defence model's, the blend and the European ones, was tuned on
2000-01 to 2011-12 only (`params-holdout.json`), then frozen and scored on every top-division match since 2012-13,
which nothing was tuned on, against Pinnacle's closing prices with the margin taken out (`data/<league>/backtest.json`,
`test`). Lower is better:

| League | Matches | premelo log loss | Elo alone | Closing odds | premelo RPS | Closing odds |
|---|---|---|---|---|---|---|
| Premier League | 5,390 | 0.971 | 0.977 | 0.956 | 0.1984 | 0.1937 |
| La Liga | 5,409 | 0.968 | 0.972 | 0.953 | 0.1951 | 0.1903 |
| Bundesliga | 4,338 | 0.990 | 0.992 | 0.977 | 0.2032 | 0.1994 |
| Serie A | 5,390 | 0.975 | 0.979 | 0.952 | 0.1958 | 0.1887 |
| Ligue 1 | 5,060 | 1.002 | 1.005 | 0.985 | 0.2048 | 0.1996 |
| Primeira Liga | 4,224 | 0.931 | 0.932 | 0.919 | 0.1854 | 0.1818 |
| Eredivisie | 4,291 | 0.958 | 0.961 | 0.944 | 0.1939 | 0.1894 |
| Pro League | 3,837 | 1.004 | 1.007 | 0.985 | 0.2081 | 0.2020 |
| Süper Lig | 4,661 | 1.002 | 1.003 | 0.982 | 0.2046 | 0.1984 |
| Scottish Premiership | 3,197 | 0.972 | 0.974 | 0.955 | 0.1992 | 0.1937 |
| Super League (Greece) | 3,504 | 0.947 | 0.949 | 0.916 | 0.1867 | 0.1778 |
| **All** | **49,301** | **0.9754** | **0.9782** | **0.9576** | **0.1979** | **0.1925** |

A baseline that knows only how often home sides, draws and away sides win scores about 1.07. premelo is about
0.018 behind the closing line, which is where the literature puts results-only models; nothing
published reliably beats closing odds. The published model (`params.json`) is the same method tuned on all the
seasons; its in-sample scores (`all` in each backtest file) flatter it and are not the claim. The nine leagues from
2012 have nothing before the holdout to be tuned on, so they have no holdout score: their in-sample scores are on the
method page, marked as such.

**Against ClubElo.** On ClubElo's table of 24 October 2026, the 37 clubs of these leagues in its top 40 are about 30
points apart on average (root mean square), most within 20. Agreement with ClubElo is not accuracy, though. The test
of the one scale is whether cross-country gaps predict European results: since 2015, in European matches between
clubs of different rated leagues, most leagues' clubs scored within about 3% of what premelo expected; Belgium's
(+5.8% over 381 matches) look underrated, and the big five's slightly overrated (−1.2% to −1.9%).

## What's not done, and what would help

- **Shots on target**: in. Out of sample they improved the holdout from 0.9760 to 0.9754, most in the Premier League
  (0.9741 to 0.9713) and Serie A (0.9773 to 0.9749).
- **Uncertainty per club** (a simple form of ClubElo's Kalman filter: variance that grows between matches and with the
  summer, faster K for new clubs; `q`, `rNew`): built and searched, but tuned on 2000-2011 it never beat a plain K, so
  the holdout model doesn't use it; tuned on everything, only Portugal and Romania pick it up, by a hair.
- **Real xG** (not just shots on target) would likely help more; there is no free, licensed source.
- **The small cross-country bias** (since 2015, Belgian and Polish clubs score about 4% above what premelo expects in
  Europe, the big five's 1-2% below): four fixes were tested out of sample on 2015-2026 European matches, a faster or
  slower league shift, a fixed European offset per league fitted on 2000-2014, and pulling European entrants towards
  their league's average (they qualify off good, partly lucky, seasons). None improved the European log loss by more
  than 0.0002 or moved the bias, so none is in. It's worth about 25 points for Belgium and Poland and 10 for the big
  five; squad rotation in Europe is one likely cause that results alone can't see.
- **Domestic cups** would link each league's divisions directly, not only through promotion and relegation.
- **Older history for the 2012 leagues** (engsoccerdata and RSSSF have some) would give them a holdout and a better start.
- Tried and found no help out of sample: an ordered logit in place of the Poisson grid, FiveThirtyEight's margin
  multiplier, a higher K early in the season or for promoted clubs, and a Dixon-Coles model on top of the blend.

## Data

- **League results, 1993 on (2012 on for the extra leagues):** [football-data.co.uk](https://www.football-data.co.uk/).
  `scripts/fetch.mjs` downloads their season files and extra-league files (`new/<code>.csv`) into `cache/` (not published),
  one request a second. `data/<league>/results.csv` keeps only the results, which are facts. Their
  bookmaker odds are read by the backtest and never republished. Two of their files hold another division's rows
  (1993-94's Portuguese file is Spain's; Spain's second division for 1993-96 repeats the first); rows from the wrong
  division are dropped.
- **European cups:** UEFA's match data (match.uefa.com, the API behind uefa.com), fetched by `scripts/fetch-uefa.mjs`.
  UEFA's team ids keep one identity per club whatever it is called; awarded and abandoned matches are left out; only
  dates, clubs and 90-minute scores are kept, in `data/europe.csv` (a neutral-ground match's div is `EUN`).
- **This season's Premier League fixtures and latest results:** [matchday](https://melvin.me/public/matchday/), in Football
  Schema JSON-LD. Other leagues' coming fixtures: football-data's `fixtures.csv` and `new_league_fixtures.csv`.

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

Updates: `scripts/update.sh` fetches this season's results (one request a second), imports, scores, builds, and commits and pushes `data/` if anything moved. Cron runs it on the maintainer's machine once a day at 08:00, after matchday's own refresh; nothing runs on GitHub's side. No dependencies: Node 22 or later. The site is the `gh-pages` branch as it is.

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
| `data/scorecard.json` | this season so far, per league, with the settings frozen since 2012: scores against the results and the closing prices, the last week's results with the chance premelo gave each, and the upsets |
| `data/movers.json` | the week's biggest rating changes |
| `data/europe-fixtures.json` | the coming Champions League, Europa League and Conference League matches, priced |

League ids: `pl`, `laliga`, `bundesliga`, `seriea`, `ligue1`, `primeira`, `eredivisie`, `proleague`, `superlig`, `scotland`, `superleague`, `austria`, `switzerland`, `denmark`, `norway`, `sweden`, `poland`, `romania`, `ireland`, `finland`.
