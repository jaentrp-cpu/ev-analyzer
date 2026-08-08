# Vedox — design source (Vite + React)

Tuotantovalmis design-lähde Vedox-uudistukselle. Mukana on **uusi appData-skeema**
(`VDX`-objekti), joka mallintaa kaiken sovelluksen datan yhtenä rakenteena ja
toimii samanmuotoisena adapterina, kun Codex / Supabase yhdistää oikean datan.

## Käynnistys

```bash
cd frontend
npm install
npm run dev
# build:
npm run build
```

Avaa http://localhost:5173

## Skeema (`src/data.js`)

```
VDX.user                — kirjautunut käyttäjä (profiili)
VDX.tier                — { code, label } käyttöoikeustaso
VDX.settings            — bankroll, flatStake, lang, theme
VDX.stats               — yhteenvetoluvut headerin tarpeisiin
VDX.valueBets[]         — arvovedot (outcome, market, sport, edge)
VDX.arbitrages[]        — varmavedot (legs[].outcome, 2-way TAI 3-way)
VDX.userBets[]          — käyttäjän omat vedot (status: pending/won/lost/push)
VDX.bankrollSnapshots[] — bankrollin kehitys analytiikkaa varten
VDX.analytics           — esiagregoitu summary + roiBySport + sportSplit + pnlPerBet
VDX.news[]              — uutiset/ajankohtaista
VDX.guides[]            — Ohjeet ja määritelmät
VDX.tabs[]              — navigaatio
```

Lisäksi: `VDX_TIER_LABELS`, `VDX_PAGE_ACCESS`, `canAccess()`,
`VDX_STATUS_LABELS`, `VDX_NEWS_TAG_LABELS`.

## Tier-pohjainen pääsy

| code           | Label    | Pääsy                                          |
|----------------|----------|------------------------------------------------|
| `none`         | _(ei badgea)_ | Julkiset: Etusivu, Ohjeet, Ajankohtaista |
| `rookie_value` | Rookie   | + Arvovedot, Omat vedot                        |
| `rookie_sure`  | Rookie   | + Varmavedot, Omat vedot                       |
| `pro_value`    | Pro      | + Analytiikka                                  |
| `pro_sure`     | Pro      | + Analytiikka                                  |
| `all_star`     | All-Star | Kaikki                                         |

`tier.code` on **tekninen** — sitä ei näytetä käyttäjälle. UI näyttää aina `tier.label`-arvoa.

Vaihda `VDX.tier.code`-arvoa data.js:ssä kokeillaksesi eri tasoja paikallisesti.

## Sivu-stateit

Jokaisella dataa käyttävällä sivulla on viisi tilaa, jotka renderoituvat datan
tilan mukaan:

- **loading** — kun data latautuu (placeholder)
- **empty** — kun lista on tyhjä (esim. "Etsimme jatkuvasti uusia varmavetoja")
- **locked** — kun käyttäjällä ei ole tier-pääsyä (oikeaa dataa EI haeta)
- **error** — kun haku epäonnistuu
- **normal** — kun data on saatavilla

Locked-state käsitellään keskitetysti `App.jsx`:ssä; muut tilat ovat sivu-
komponenteissa.

## Codexille — Supabase-integraatio

`src/data.js` korvataan myöhemmin hookilla tai adapterilla joka palauttaa
saman skeeman:

```jsx
// Esim. src/useAppData.js
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

export function useAppData() {
  const [vdx, setVdx] = useState(null);
  useEffect(() => {
    (async () => {
      const [{ data: bets }, { data: arbs }, { data: own }, { data: settings }, { data: profile }] = await Promise.all([
        supabase.from('ev_bets').select('*'),
        supabase.from('arbitrages').select('*'),
        supabase.from('user_bets').select('*'),
        supabase.from('user_settings').select('*').single(),
        supabase.from('profiles').select('tier_code, username').single(),
      ]);
      setVdx({
        user:     { name: profile.username, /* ... */ },
        tier:     { code: profile.tier_code, label: VDX_TIER_LABELS[profile.tier_code] },
        settings,
        valueBets: bets,
        arbitrages: arbs,
        userBets: own,
        /* ...stats agregoidaan tai haetaan view-tauluista */
      });
    })();
  }, []);
  return vdx;
}
```

Sitten komponentit muutetaan vastaanottamaan `VDX` propsina tai contextina, ei
imporrtina datasta. Komponenttirakennetta tai tyylejä ei tarvitse koskea.

## Mock-data ja tuotantoperiaatteet

- **Kelly on käyttäjän valinnainen Arvovedot-panosmalli.** Se käyttää samaa Fractional Kelly -kaavaa kuin Strategy Lab, tarjoaa asteet 0,25 / 0,5 / 0,75 / 1,0 ja rajaa yksittäisen panoksen 5 prosenttiin kassasta. Se ei muuta Varmavetoja, Telegramia tai backendin automaattipanostusta.
- **Älä kovakoodaa rivejä.** Kaikki data komponentteihin tulee `VDX`:n kautta.
- **Älä oleta 1/X/2.** Varmavedon jaloissa `outcome`-nimi tulee datasta.
- **Älä näytä teknisiä tier-koodeja.** Käyttäjälle vain Rookie / Pro / All-Star.
- **Älä näytä feikkianalytiikkaa.** Jos ratkenneita vetoja on alle 5, näytä empty state.

## Rakenne

```
vedox-source/
├── README.md            — tämä tiedosto
├── package.json
├── vite.config.js
├── index.html           — Vite entry
└── src/
    ├── main.jsx
    ├── App.jsx          — shell + router + tier-pohjainen locked state
    ├── data.js          — ★ VAIHDA TÄMÄ Supabase-hookiksi
    ├── styles.css       — koko design-systeemi
    ├── theme.jsx        — ThemeProvider + useTheme
    ├── components/
    │   ├── Icon.jsx     — SVG-ikonit + Vedox-logo
    │   ├── Sidebar.jsx
    │   ├── TopBar.jsx
    │   ├── MobileNav.jsx
    │   └── Spark.jsx
    └── pages/
        ├── Home.jsx
        ├── Value.jsx
        ├── Sure.jsx
        ├── MyBets.jsx
        ├── Analytics.jsx
        ├── Guides.jsx
        └── News.jsx
```

> **Huom:** sivukomponentit lukevat `VDX`-objektia suoraan. Niihin on rakennettu
> **alkuun yhteensopivuusalias**-kerros (`data.js` lopussa), joka mappaa vanhat
> kenttänimet uuteen skeemaan kunnes Codex migratoi ne. Tämä mahdollistaa
> portittamisen vaiheittain ilman että koko UI rikkoutuu kerralla.
