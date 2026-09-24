# Perustajien arbitraasiseurannan public-julkaisu

Tämä rajattu ehdokas koskee kolmea nykyistä All-Star-perustajatiliä. Vedox ei myy asiakkuuksia. Julkaisun staattinen käyttöliittymä käyttää 2026-09-23 erikseen ajettua henkilökohtaisen arbitraasiseurannan tietokantamigraatiota. Tämä haara ei sisällä tarjousrevision triggereitä, 30 sekunnin Supabase-revisiokyselyä eikä scanner-muutosta. Viiden minuutin nykyinen tarjouspäivitys säilyy.

## Todisteet ja rajat

- Käyttäjä vahvisti tuotannosta kuusi uutta `user_arb_*`-taulua: RLS päällä, `authenticated` saa lukea omaa dataa, suora INSERT ei ole sallittu. Omistajapolitiikat käyttävät `auth.uid()`-rajausta. Yhdeksän seurantaan kuuluvaa RPC:tä on asennettu, `anon`-suoritus estetty ja `authenticated`-suoritus sallittu. SQL-katalogi ei yksin todista käyttäjäeristystä.
- Käyttäjä testasi paikallisella käyttöliittymällä kahdella All-Star-tilillä: tilin A virtuaalinen CoolBet-avaussaldo 1,00 € säilyi ulos-/sisäänkirjautumisessa; tilin B lista oli tyhjä. Tämä todistaa yhden kevyen persistoivan kirjauspolun ja käytännön lukueristyksen, ei yrityksen, jalan, ratkaisun tai oikaisun koko ketjua.
- Käyttäjän 2026-09-24 Supabase-kuvissa levyn käyttö oli 90 % ja 133/150 Gt. Tietokantakortin hetkellinen CPU oli 13 %; alempi CPU-kaavio näytti 71 %. Levyautomaattikasvun maksimi on 150 Gt ja muutosraja oli kuvassa tilapäisesti saavutettu. Lisäksi Supabase ilmoitti tutkivansa teknistä häiriötä. Nämä ovat kuvan ajankohdan havaintoja, eivät jatkuva tuotantotila.
- Tarjouslista oli selaintestissä tyhjä. Varsinaista yritys–jalat–tulos-ketjua ei voitu vahvistaa käyttäjän datalla eikä testivetoja luotu. Ei oikeita bookkerisaldoja, rahapanoksia tai ylimääräisiä Odds API -kutsuja.
- Paikallinen fiktiivinen PostgreSQL-testi kattoi RLS:n, suoran kirjoituskiellon, kaksoiskirjausten eston, katteettoman kassan rollbackin, osittaisen yrityksen tilan ja jalkojen erilliset oikaisut. Se ei korvaa oikeaa Supabase Auth/PostgREST -testiä.

## Julkaisuraja

`jaentrp-cpu/ev-analyzer` GitHub Pages käyttää `main`-haaran juurta (`legacy` build). Viimeksi vain lukevasti tarkistettu `origin/main` ja onnistunut Pages-build olivat molemmat `f18510e713d1946b16f5c57aec9e447489a88de9`. Tarkista nämä uudelleen ennen täsmällisen release-commitin hyväksyntää. `main`-päivitys voi julkaista sivun automaattisesti. Tätä haaraa ei saa puskea/mergetä ilman erillistä pääkäyttäjän lupaa.

Julkaisupaketti: vain arbitraasin henkilökohtainen UI, rajattu Supabase-mappaus, testit ja uusi static JS/CSS. Tuotannon jo ajettua käyttäjädata-SQL:ää ei ajeta uudelleen. Ei scannerin, EV-valinnan, panosten, Telegram/public-suodattimien, CLV-ikkunan, ajastusrytmin, Odds API -kutsujen tai tietokantatriggerien muutoksia. Tarjousrevision koe säilyy toisessa paikallisessa haarassa eikä kuulu tähän julkaisuun.

## Hyväksyntä ja varmennus

1. Aja frontendin kaikki paikalliset testit, build, juuriprojektin pakolliset parse-/check-testit, `git diff --check`, staattisen bundlen HTTP-tarkistus sekä työpöytä- ja mobiiliselaimen kirjautumis-/välilehtitarkistus.
2. Varmista juuri ennen julkaisua `origin/main`, Pages-lähde ja nykyinen onnistunut build-SHA. Ehdokkaan tulee olla tämän mainin jälkeläinen eikä sisältää toisen haaran kokeiluja.
3. Pyydä erillinen hyväksyntä täsmälliselle commitille ja mainiin siirtämiselle. Ota rollback-talteen edellinen main-SHA ja sen static JS/CSS. Älä sekoita pushin onnistumista Pages-julkaisun onnistumiseen.
4. Hyväksynnän jälkeen varmista GitHub Pagesin valmis build, `vedox.fi`-assetit, kirjautuminen, neljä Varmavedot-välilehteä, perustajatilien eristys ja Supabasen kuorma kevyesti. Jos julkaisu rikkoo sivun, palauta vain static-commit erikseen hyväksytyllä rollbackilla; älä poista käyttäjädataa.

Harvinaiset tarjous- ja tulospolut tarkistetaan ajan kanssa oikean käytön yhteydessä. Niiden testaamattomuutta ei saa tulkita läpäistyksi testiksi.
