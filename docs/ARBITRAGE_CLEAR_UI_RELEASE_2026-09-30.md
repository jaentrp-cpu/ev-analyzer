# Arbitraasisivun tuotantojulkaisu 30.9.2026

## Toteutunut julkaisu

- AJ hyväksyi tämän chatin public-sivun tuotantojulkaisun. GitHub-toimija: jaentrp-cpu.
- Public-repo: jaentrp-cpu/ev-analyzer. Pages: legacy, main-haaran juuri, vedox.fi.
- PR #41 lähde-SHA: 576ad3aa0250ff1655c1978e79165d03a29123bb.
- Merge ja onnistunut Pages-build: 7f2c902203ff2fb13f0d958573be358fe261e2ff.
- AJ ajoi Vedox-tuotantoprojektin SQL Editorissa uuden yhteiskassamigraation. Käyttäjän toimittama onnistumiskuva ja 13/13 true katalogivarmennus. Tämä on omistajan toimittamaa tietokantanäyttöä, ei agentin suoraan suorittama DB-tarkistus.
- Agentin live HTTP-varmennus: HTML 200 ja molemmat assetit 200, HTML viittaa uusiin assetteihin ja tuotannon tavut vastaavat paikallista release-pakettia.
  - index-D0aE_J37.js SHA256: eb2862caf5f582a1dee9ce18b8bc17bf99e3645a241b90f84cf4b5c87b17ab36
  - index-xFK3EuRJ.css SHA256: 0ffd21f3fe39c606b436b21ac73f65d39a7f575c23df953b716509f61a9b1ec9
- Tuotannon selain avaa Varmavedot-reitin kirjautumiskehotteeseen. Kirjautunut yritys/kassa/muokkaus/poisto-ketju odottaa käyttäjän smoke-testiä. Tietokannan katalogi ei todista kaikkia käyttäjäpolkuja.

## Tarkistukset ja vaikutus

43 frontend-testiä ja backend-repon pakolliset index.js/Hallinta/Simulation-checkit läpäisivät ennen mergeä. Paikallinen build, fiktiivinen PostgreSQL/RLS/RPC-testi ja offline desktop/mobiilitesti läpäisivät valmistelussa. Selitteiden infopainikkeet testattiin hiirellä ja näppäimistöllä.

Public UI ja oman käyttäjän seuranta-SQL muuttuivat. Scanner, Telegram, EV-laskenta, panosjako, liigojen/markkinoiden rajat, cadence, websocket, ClickHouse ja Original säilyivät. Ei uusia Odds API -kutsuja. Tilien saldoja, oikeita vetoja tai tuloksia ei kirjoitettu testausta varten.

## Palautus ja jäljellä oleva varmennus

Palautusversio: 12d424412fd297cb5023719cedfd37a98aacb81d. Aiemmat static-assetit säilyvät repossa. SQL on säilyttävä; uusia tauluja, sarakkeita tai käyttäjäkirjauksia ei poisteta UI-rollbackissa. Vanha kirjakohtainen lompakkomalli ei vastaa uusia yhteiskassakirjauksia, joten palautuksessa kirjaamista on tauotettava ja saldot täsmättävä. Tuotannon rollback-harjoitusta ei tehty.

Käyttäjän tulee päivittää vanhat selainistunnot ennen kirjauksia. Nettopalautuksia ei vahvisteta vanhoille vedoille automaattisesti. Sääntöyhteensopivuuden kartoitus on edelleen erillinen työ, eikä tämä UI-julkaisu todista kerroinyhdistelmää riskittömäksi.
