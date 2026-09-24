# Arbitraasiseurannan liikkuvat virtuaalikassat — paikallinen ehdokas

Tämä jatkaa public-julkaisua `d834e7f65c482f6a9462b8c9b18f16d835b901f1`.
Toteutus on valmisteltu paikallisesti. Käyttäjä ajoi SQL-migraation Vedoxin
Supabase-projektissa ja toimitti kuvan onnistuneesta ajosta sekä 8/8 true
-katalogitarkistuksesta. Uusi frontend ei ole vielä vedox.fi:ssä.

## Käyttäjän tavoite ja semantiikka

- Perustajan bookkerikassa voi muuttua edestakaisin myös Vedoxin arbitraasivetojen
  ulkopuolella. Seurantasaldo ei ole bookkerilta automaattisesti luettu saldo.
- Lisäys ja vähennys kirjaavat ulkoista liikettä. Siirto liikuttaa saman summan
  kahden oman kassan välillä atomisesti. Täsmäytys asettaa seurantasaldon
  syötettyyn arvoon ja kirjaa erotuksen; aikaisempi alkusaldo ja vedot säilyvät.
- Tämä malli toimii sekä koko bookkerisaldon että arbitraaseihin varatun osuuden
  seurannassa. Käyttäjän valinta tästä merkityksestä on vielä avoin; käyttöliittymä
  ei väitä saldoa automaattisesti todelliseksi.
- Poistoa ei ole tässä ehdokkaassa. Kirjausten kovapoisto rikkoisi audit trailin;
  mahdollinen arkistointi tarvitsee erillisen säännön avoimille jaloille ja saldolle.
- Analytiikan suostumuksen pitkä valinta vaihtuu hyväksynnän jälkeen tilaan ja
  "Peru suostumus" -painikkeeseen. Suostumuksen voi edelleen perua.

## Rajaus ja turvallisuus

1. `sql/2026-09-24-user-arb-wallet-movements.sql` lisää olemassa olevaan
   kassakirjaustauluun muistiinpanon, operaatiotunnisteen ja jälkisaldon, laajentaa
   kirjaustyypit sekä luo kaksi `authenticated`-roolille myönnettyä RPC:tä.
   `anon`-suoritus estetään. `arb_require_user()` sitoo molemmat omaan tiliin.
2. Muutokset ovat transaktionaalisia. Kohdekassat lukitaan määrätyssä
   järjestyksessä; katteeton vähennys tai siirto ei kirjoita mitään. Yhden
   operaatiotunnisteen ja kirjaustyypin yhdistelmä on uniikki, joten saman
   pyynnön toisto ei voi kirjata samaa liikettä kahdesti.
3. Historiasta luetaan vain 50 viimeisintä oman tilin RLS-suojattua kirjausta.
   Lisää yksi rajattu Supabase-lukukysely aiempaan sivulataukseen ja vain
   käyttäjän käynnistämät RPC-kirjaukset. Ei uusia Odds API -pyyntöjä.
4. Ei muutoksia skanneriin, EV-/Telegram-valintaan, panoksiin, CLV-ikkunaan,
   tarjousten päivitystahtiin, ClickHouseen tai bookkerien oikeisiin saldoihin.

## Käyttöönoton portit

1. Katselmoi SQL sekä datan merkitys (koko saldo vai varattu osuus). Varmista
   Supabasen levytila ja tietokannan kuorma juuri ennen migraatiota: viimeksi
   kuvissa levy oli 90 % ja automaattisen kasvun yläraja 150 Gt.
2. Hyväksy ja aja **vain numero 1**, uusi SQL-tiedosto, olemassa olevassa
   Vedox-tuotantoprojektissa. Se on additive, mutta ei kirjoita kassasaldoihin
   eikä luo testimerkintöjä. Varmista kaksi uutta funktiota, niiden grantit,
   kassataulun uudet sarakkeet ja ennallaan oleva RLS.
3. Testaa erikseen yhden perustajan omalla tarkoitukseen sopivalla kassalla
   lisäys, vähennys, kahden kassan siirto, täsmäytys, reload ja toisen tilin
   lukueristys. Älä luo oikeita vetoja tai keksi tuloksia testin vuoksi.
4. Vasta erillisellä täsmällisen public-commitin luvalla julkaise frontend.
   Tarkista valmis GitHub Pages -build, `vedox.fi` ja kuormitus. Pelkkä pushin
   onnistuminen ei ole julkaisun valmistumisen todiste.

SQL:n suoritus ennen frontend-julkaisua ei riko vanhaa UI:ta. Uutta UI:ta ei
saa julkaista ennen migraatiota, koska se lukee uusia kassakirjaussarakkeita.
Frontendin rollback on aiemman static-julkaisun palautus. SQL on tarkoituksella
additive, eikä tietokantatauluja tai kassakirjauksia poisteta rollbackissa.

## Toteutunut kirjautunut paikallistesti 2026-09-24

Käyttäjän paikallisen esikatselun kuvat näyttävät yhdellä perustajatilillä
CoolBet-kassan kaksi erillistä +0,01 € lisäystä ja yhden −0,02 € vähennyksen.
Loppusaldo palautui 1,00 euroon ja kaikki kolme merkintää jäivät historiaan.
Tämä varmentaa lisäyksen ja vähennyksen käyttäjäpolun, mutta ei kahden kassan
siirtoa, täsmäytystä eikä uudelleen toistettua kahden tilin eristystestiä.
Oikeaa bookkerisaldoa tai rahaa ei muutettu.

## Paikallinen varmennus ja avoin raja

Frontend-testit ja build sekä monorepon pakolliset check-/parse-testit on
ajettava tämän ehdokkaan lopullisesta diffistä. Paikallista PostgreSQL- tai
PGlite-palvelinta ei ollut käytettävissä tarkistuksessa. Tuotannon katalogi-
ja yhden kassan käyttäjätesti eivät vielä todista siirron transaktio-/RLS-
käytöstä kahdella kassalla. Tämä dokumentti ei yksin ole deploy-lupa.
