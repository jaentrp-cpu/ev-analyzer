# Arbitraasisivun uudistus — paikallinen ehdokas 30.9.2026

## Rajaus ja omistajan valinnat

- Public-repo `jaentrp-cpu/ev-analyzer`, lähtö `12d424412fd297cb5023719cedfd37a98aacb81d`.
- Yksi historia, yksi alkukassa ja yksi nettovoittokäyrä. Ei erillistä harjoitustilaa.
- Etusivulla kohteet ja keskeneräiset yritykset; selkeät taulukot ja rivin alta avautuva kirjaus.
- Muokkaus erillisellä oikaisumerkinnällä. Poisto on palautettava soft delete: tallenne säilyy, mutta poistettu yritys ei vaikuta uuden UI:n laskelmiin.
- Poisto ei peru oikeaa vetoa. Palautus tai korjaus voi paljastaa negatiivisen vapaan saldon; sitä ei piiloteta.

## Laskenta ja ajoitus

Kokonaiskassa = käyttäjän ilmoittama alkukassa + ratkaistujen vetojen kirjattu nettopalautus − niiden panokset. Vapaana = kokonaiskassa − avoimien vetojen panokset. Pankin ja kirjojen väliset rahansiirrot eivät ole tuottoa.

Voittokäyrään tulee yksi nettotulospiste kokonaan ratkaistusta yrityksestä. Avoimen yrityksen ratkaistut osatulokset vaikuttavat kassaan, mutta niiden ero käyrään selitetään. Puuttuvaa ratkaisuhetkeä ei keksitä.

Tulos kirjataan käsin todellisena maksettuna palautuksena komission ja kulujen jälkeen. Tämä ei muuta scannerin Betfair-komissiopolitiikkaa eikä väitä, että kirjojen selvityssäännöt olisivat yhteensopivat.

Yrityksen aloitus ja alkuperäiset asettamishetket säilyvät. Uusi `checked_at` tallentaa myös epäonnistuneen kirjaushavainnon. Kirjakohtainen viive on viimeisestä tarjouksen päivityksestä käyttäjän vahvistukseen, ei koko kerroinelinkaaren automaattinen mittaus. Tarjousrevision tarkistus ja erillisen uuden yrityksen polku säilyvät.

Vanhojen palautusten nettomäärä ei ole varmistettu: `net_return_verified` alkaa arvosta false. UI kertoo vanhoista palautuksista. Uusi tuloskirjaus tai ratkaistun vedon muokkaus vahvistaa ilmoitetun nettopalautuksen. Vanhoja palautuksia ei muuteta automaattisesti.

## Tietokantaraja

`sql/2026-09-30-arbitrage-shared-bankroll.sql` on **ajamaton tuotantoehdokas**. Lisää omistajaeristetyn `user_arb_bankroll`-taulun, `deleted_at`/`checked_at`-sarakkeet sekä rajatut RPC:t. Yhteiskassan mutaatiot ottavat käyttäjäkohtaisen riv lukon ennen yritys- ja vetolukkoja. Suora asiakkaan kirjoitus ei ole sallittu. Alkukassa asetetaan käyttäjän toimesta; vanhoja kirjakohtaisia saldoja ei automaattisesti tulkita yhteiseksi alkukassaksi.

Vanhat kassat, rahakirjaukset ja RPC:t säilyvät muuttumattomina. Ne eivät ole uuden yhteiskassan laskentaperuste. Vanhassa selainversiossa tehty kirjaus ei osallistu uuden RPC:n yhteiskassalukkoon. Julkaisussa vanhat istunnot pitää päivittää; vanhan ja uuden kirjauspolun rinnakkaista käyttöä ei pidä hyväksyä varmennetuksi.

Palautus voi osua toisen avoimen yrityksen samaa kohdetta suojaavaan unique-indeksiin. Tällöin tietokanta estää palautuksen ja UI näyttää virheen. Poisto ei poista indeksin suojaa muiden aktiivisten yritysten väliltä.

## Testit

- 43 frontend-testiä läpäisi, mukaan lukien 300 → 306 €, avoimet panokset, oikaisu, poisto/palautus, epäonnistunut havainto ja puuttuvat ajat.
- In-memory PostgreSQL (PGlite): migraatio, placement, double submit, insufficient funds, settlement, correction-before-settlement, alkuperäisen sijoitusajan säilyminen, poisto/palautus, RLS, suoran kirjoituksen kielto ja eri käyttäjän RPC-kielto läpäisivät. Ei oikeaa Supabase Auth/PostgREST -varmennusta eikä kuormitustestiä.
- Offline Chrome: oikeat komponentit fiktiivisellä RPC-adapterilla; kohteet, yritykset, muokkaus, poisto/palautus, käyrä, alkukassa ja 390 px mobiilileveys läpäisivät. Ei tuotantokirjautumista tai oikean rahan kirjauksia.
- Vite build läpäisi; olemassa olevan suuren bundlen varoitus säilyy.
- Backend-repon puhtaassa worktreessa `node --check index.js`, Hallinta- ja Simulation-parse sekä diff check läpäisivät. Ne ovat suojatun backendin tarkistuksia, eivät public-sivun julkaisutodiste.

SQL-testi: asenna PGlite erilliseen työkalukansioon, aseta `ARB_PGLITE_MODULE` sen ESM-moduulin file-URL:ksi ja aja `node sql/arbitrage-shared-bankroll.test.mjs`. Selainfixture: `node frontend/src/arb-ui-preview.mjs <output-dir>` ja `node frontend/src/arb-ui-browser.test.mjs <output-dir> <Playwright-module-url>`.

## Julkaisu ja rollback

**Ei julkaistu.** Rootin `index.html` ja nykyiset GitHub Pages -assetit säilyvät. Paikallinen build todistaa lähdekoodin kääntymisen; se ei ole tuotantokonfiguroitu static-release. Migraatio ja lopullinen public-bundle julkaistaan erillisen hyväksynnän jälkeen tunnistettuun kohteeseen, tarkalla commitilla ja tuotantovarmennuksella. Main-merge voi käynnistää Pages-buildin, vaikka tässä lähdekoodiehdokkaassa rootin vanha bundle säilyy.

Rollback alkaa aiemman static-releasen palautuksella. Uudet sarakkeet/taulu/RPC:t ja käyttäjädata säilytetään; tietokantaan ei tehdä tuhoavaa rollbackia. Vanhan UI:n kirjakohtaiset saldot eivät enää kuvaa uuden yhteiskassan kirjauksia, joten uuden mallin kirjaamista pitää tauottaa UI-rollbackin aikana. Pelkkä vanhan bundlen palautus ei todista kirjauspolun palautumista oikein.

Scanner, arvovedot, Betfair-komission scanner-laskenta, Original, liigojen/markkinoiden asetukset, Telegram/public-suodattimet, panosjakoalgoritmi, scan cadence, websocket ja ClickHouse pysyvät ennallaan. Ei uusia Odds API -kutsuja tai tarjousrevisiotriggeriä. Tracker-lataus vaihtuu kuudesta kyselyhaarasta viiteen (paginointi ennallaan); ei uutta polling-ajastinta.
