import React from 'react';

const packages = [
  {
    name: 'All-Star',
    price: '49,99 €/kk',
    body: 'Yksi kuukausipaketti sisältää koko Vedoxin ja kaikki nykyiset käyttäjäominaisuudet.',
    items: ['Arvovedot', 'Varmavedot', 'Omat vedot & analytiikka', 'Kelly- ja kiinteän panostuksen asetukset'],
  },
];

const terms = [
  ['Kassa', 'Rahamäärä, jonka varaat vedonlyöntiin. Jos kassasi on 500 €, et pelaa sitä kaikkea kerralla, vaan panostat siitä pieniä osia.'],
  ['Panos', 'Yhteen vetoon laitettava summa. Kelly-mallissa panos vaihtelee kertoimen, Vedoxin arvioiman edun, kassan ja valitun varovaisuusasteen mukaan.'],
  ['Fractional Kelly', 'Kellyn varovaisuusaste. Esimerkiksi Kelly 0,5 käyttää puolet täydellisen Kelly-kaavan ehdottamasta panoksesta. Vedox rajaa Kelly-panoksen enintään 5 prosenttiin kassasta.'],
  ['Arvoveto', 'Veto, jossa Vedox arvioi kertoimen olevan pelaajalle parempi kuin kohteen todellinen todennäköisyysarvio antaisi ymmärtää. Yksittäinen arvoveto voi hävitä, mutta pitkässä sarjassa hyvä arvo tekee voittamisesta selvästi todennäköisempää.'],
  ['Arvo / etu', 'Kuinka paljon paremmalta veto näyttää Vedoxin mallin mukaan. Esimerkiksi +4 % etu tarkoittaa, että kerroin näyttää noin 4 % paremmalta kuin sen pitäisi olla.'],
  ['Varmaveto', 'Tilanne, jossa eri lopputulokset voidaan pelata eri vedonlyöntisivustoille niin, että oikein asetetuilla panoksilla tuotto on laskennallisesti lukittu riippumatta ottelun lopputuloksesta.'],
  ['H2H', 'Head-to-head eli ottelun voittaja. Esimerkiksi joukkue A voittaa tai joukkue B voittaa.'],
  ['Totals', 'Yli/alle-veto. Esimerkiksi jääkiekossa yli 5,5 maalia tarkoittaa, että ottelussa pitää tulla vähintään 6 maalia.'],
  ['Spread', 'Tasoitusveto. Joukkueelle annetaan kuvitteellinen etu tai haitta, esimerkiksi +1,5 tai -1,5 maalia.'],
  ['Markkina', 'Vedon tyyppi, kuten H2H, totals tai spread.'],
  ['Liiga', 'Sarja tai kilpailu, esimerkiksi MLB, Allsvenskan, Serie A tai Roland Garros.'],
  ['Vedonlyöntisivusto', 'Sivusto, jonne veto asetetaan. Vedox ei aseta vetoja puolestasi.'],
  ['Kerroin', 'Luku, joka kertoo paljonko veto maksaa takaisin osuessaan. Kerroin 2.00 tarkoittaa, että 10 € panos palauttaa 20 €, josta voittoa on 10 €.'],
  ['ROI', 'Tuotto suhteessa panostettuun rahaan. Jos olet panostanut 100 € ja voittoa on 10 €, ROI on 10 %.'],
  ['PNL', 'Voitto tai tappio euroina. +20 € tarkoittaa voittoa, -20 € tappiota.'],
  ['Push / palautus', 'Veto ei voita eikä häviä, vaan panos palautuu.'],
  ['Omat vedot & analytiikka', 'Näkymä, jossa tallennat omat vetosi, muokkaat kerrointa ja panosta, merkitset tulokset sekä seuraat oman vetohistoriasi tuottoa ja CLV:tä.'],
];

const steps = [
  {
    title: 'Valitse All-Star',
    body: 'All-Star sisältää arvovedot, varmavedot sekä Omat vedot & analytiikka -näkymän. Ota yhteyttä Vedoxin tukeen tilauksen ja käyttöoikeuden aktivointia varten.',
  },
  {
    title: 'Luo tunnus ja odota oikeuksien aktivointia',
    body: 'Voit luoda tunnuksen Vedoxiin itse. Uusi tunnus ei kuitenkaan näe maksullisia näkymiä ennen kuin ylläpito aktivoi All-Star-käyttöoikeuden. Tämä suojaa maksullisen datan.',
  },
  {
    title: 'Päätä aloituskassa',
    body: 'Kassa on vedonlyöntiin varattu budjetti. Se voi olla esimerkiksi 100 €, 500 € tai 1 000 €. Vedox käyttää kassaa panossuositusten pohjana, jotta et pelaa liian isoja summia yhteen kohteeseen.',
  },
  {
    title: 'Tee tilit useammalle vedonlyöntisivustolle',
    body: 'Vedox löytää kohteita vertailemalla kertoimia eri vedonlyöntisivustoilta. Mitä useammalla tuetulla sivustolla sinulla on tili, sitä useampia kohteita pystyt hyödyntämään käytännössä.',
  },
  {
    title: 'Liity Telegramiin',
    body: 'Vedox lähettää Telegramiin ilmoituksia nykyiset julkaisu- ja turvallisuusehdot täyttävistä arvovedoista ja varmavedoista. Kaikki järjestelmän seuraamat kohteet eivät siis välttämättä päädy ilmoitukseksi. Anna käyttäjänimesi ylläpidolle, jotta oikeudet ja viestintä voidaan yhdistää oikeaan henkilöön.',
  },
  {
    title: 'Avaa profiili ja valitse panostusmalli',
    body: 'Avaa profiili sivupalkista tai puhelimen yläpalkin profiilipainikkeesta. Voit käyttää kiinteää panosta tai Kelly-mallia ja valita Kellyn varovaisuusasteeksi 0,25, 0,5, 0,75 tai 1,0. Kelly 0,5 on oletus, kun Kelly valitaan. Panos lasketaan jokaiselle kohteelle erikseen ja rajataan enintään 5 prosenttiin kassasta. Vain onnistuneesti pilveen tallennetut asetukset seuraavat samaa käyttäjätiliä toiselle laitteelle. Jos tallennus epäonnistuu, profiili ilmoittaa siitä ja palauttaa aiemman arvon.',
  },
  {
    title: 'Käytä filttereitä',
    body: 'Voit rajata kohteita lajin, liigan, markkinan, vedonlyöntisivuston ja aikavälin mukaan. Jos et tunne jotain lajia tai vedonlyöntisivustoa, voit aluksi piilottaa sen.',
  },
  {
    title: 'Kun ilmoitus tulee, tarkista kerroin',
    body: 'Avaa oikea vedonlyöntisivusto, etsi ottelu ja markkina, tarkista kerroin ja aseta veto vain jos tiedot täsmäävät. Vedox ei paina nappia puolestasi, vaan käyttäjä asettaa vedon itse.',
  },
  {
    title: 'Tallenna veto Omat vedot & analytiikka -näkymään',
    body: 'Tarkista arvovedon kerroin ja panos ennen lisäämistä. Tallennetun vedon kerrointa ja panosta voi myöhemmin muokata, ja tulokseksi voi merkitä kesken, voitto, tappio tai palautus. Muutokset tallentuvat omaan vetohistoriaasi.',
  },
  {
    title: 'Seuraa omaa analytiikkaa ja anna palautetta',
    body: 'Omat vedot & analytiikka näyttää, miten oma kassa, lajit, liigat, markkinat, CLV ja Steam-arvot kehittyvät. Kaikki luvut perustuvat omiin tallennettuihin vetoihisi. Jos jokin ei toimi, kerro siitä heti Anna palautetta -kohdasta tai yksityisviestillä ylläpidolle.',
  },
];

const kellyExamples = [
  ['Kelly 0,5 · perusesimerkki', '500 € kassa', 'Kerroin 1,90', 'Vedoxin arvioima etu +3,0 %', 'Täysi Kelly noin 3,33 % kassasta', 'Kelly 0,5: noin 8,33 €'],
  ['Kelly 0,5 · yläraja', '500 € kassa', 'Kerroin 1,80', 'Vedoxin arvioima etu +12,0 %', 'Kaava ehdottaisi 37,50 €', '5 % yläraja: panos 25,00 €'],
];

export default function Guides() {
  return (
    <div className="page-body">
      <div className="ph">
        <div>
          <h1>Ohjeet</h1>
          <div className="sub">Vedox selitettynä alusta asti: mitä termit tarkoittavat ja miten palvelua käytetään</div>
        </div>
      </div>

      <section className="guide-hero card">
        <div>
          <div className="ey">Aloita tästä</div>
          <h2>Vedox auttaa löytämään arvovetoja ja varmavetoja datan perusteella.</h2>
          <p>
            Ajatus on yksinkertainen: et pelaa tunteella, vaan etsit tilanteita, joissa kerroin tai panosjako on pelaajan
            kannalta tavallista parempi. Vedox ei aseta vetoja puolestasi, vaan näyttää kohteita, joita käyttäjä voi tarkistaa
            ja pelata omilla vedonlyöntisivustoillaan.
          </p>
        </div>
      </section>

      <div className="guide-section-title">Tärkeät termit</div>
      <div className="guide-term-grid">
        {terms.map(([term, text]) => (
          <div className="card guide-term" key={term}>
            <h3>{term}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>

      <div className="guide-section-title">Mitä arvovedot ja varmavedot tarkoittavat?</div>
      <div className="guide-two">
        <section className="card gc">
          <h3>Arvovedot</h3>
          <p>
            Arvovedossa Vedox etsii tilanteita, joissa vedonlyöntisivuston tarjoama kerroin näyttää liian hyvältä suhteessa
            kohteen todelliseen todennäköisyysarvioon. Jos sama idea toistuu sadoissa tai tuhansissa vedoissa, positiivinen
            arvo voi kääntää kokonaisuuden voitolliseksi.
          </p>
          <p>
            Yksittäinen arvoveto voi hävitä täysin normaalisti. Arvovedoissa ei ole tarkoitus osua jokaiseen vetoon, vaan saada
            pitkällä aikavälillä enemmän takaisin kuin mitä panostetaan.
          </p>
        </section>
        <section className="card gc">
          <h3>Varmavedot</h3>
          <p>
            Varmavedossa eri lopputulokset pelataan eri vedonlyöntisivustoille niin, että oikein asetetuilla panoksilla tuotto
            on laskennallisesti lukittu. Silloin ei tarvitse tietää, kumpi joukkue voittaa tai montako maalia tulee.
          </p>
          <p>
            Varmavedon käytännön virheet syntyvät yleensä siitä, että kerroin ehtii muuttua, käyttäjä näppäilee väärän panoksen,
            valitsee väärän kohteen tai unohtaa yhden panoksen. Oikeilla kertoimilla ja panoksilla laskelma voi lukita tuoton,
            mutta vedonvälittäjien sääntö-, mitätöinti- ja selvityserot on aina tarkistettava ennen pelaamista.
          </p>
        </section>
      </div>

      <div className="guide-section-title">Kuukausipaketti</div>
      <div className="guide-package-grid">
        {packages.map(pkg => (
          <div className="card guide-package" key={pkg.name}>
            <div className="guide-package-head">
              <h3>{pkg.name}</h3>
              <strong>{pkg.price}</strong>
            </div>
            <p>{pkg.body}</p>
            <ul>
              {pkg.items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ))}
      </div>

      <div className="guide-section-title">Vedonlyöntisivustojen käyttö</div>
      <section className="card guide-books">
        <div>
          <h3>Mille sivustoille kannattaa tehdä tilit?</h3>
          <p>
            Vedox voi näyttää kohteita useilta eri vedonlyöntisivustoilta. Käytännössä mitä useammalle sinulle sopivalle ja
            alueellasi sallitulle sivustolle sinulla on tili, sitä helpompi kohteita on hyödyntää.
          </p>
          <p>
            Kaikki sivustot eivät ole saatavilla kaikissa maissa. Tarkista aina itse, voiko sivustolle rekisteröityä Suomesta,
            toimivatko talletukset ja kotiutukset, ja voitko pelata Vedoxin näyttämiä kohteita.
          </p>
          <p>
            Ajantasaiset sivusto- ja tiliohjeet annetaan asiakkaille erikseen, koska tuetut markkinat ja saatavuus voivat
            muuttua ajan mukana.
          </p>
        </div>
      </section>

      <div className="guide-section-title">Suositeltu etenemisjärjestys</div>
      <section className="card gc guide-prose">
        <p>
          Tutustu ensin molempien vetotyyppien toimintatapaan, ehtoihin ja käytännön riskeihin. Varmavedoissa eri lopputulosten
          panokset muodostavat yhden kokonaisuuden, kun taas arvovedoissa yksittäisten vetojen tulokset vaihtelevat ja arviointi
          perustuu pitkän aikavälin otokseen.
        </p>
        <p>
          All-Star-käyttäjä voi seurata molempia näkymiä, mutta Vedox ei lupaa tietylle strategialle suurempaa kasvua eikä
          suosittele pelaamaan jokaista kohdetta. Tarkista aina kerroin, markkina, vedonvälittäjän säännöt ja oma panos ennen vetoa.
        </p>
      </section>

      <div className="guide-section-title">Kohdemäärät ja odotukset</div>
      <section className="card gc guide-prose">
        <p>
          Kohteiden määrä vaihtelee päivän, lajikalenterin ja markkinatilanteen mukaan. Välillä hyviä kohteita on enemmän,
          välillä vähemmän, eikä määrää kannata arvioida yhden päivän perusteella.
        </p>
        <p>
          Vedox ei lupaa voittoa. Tärkeintä on käyttää järkevää panoskokoa, tarkistaa kertoimet ennen pelaamista ja arvioida
          tuloksia riittävän pitkällä aikavälillä yksittäisten osumien sijaan.
        </p>
      </section>

      <div className="guide-section-title">Kelly 0,5 -esimerkit 500 € kassalla</div>
      <div className="guide-example-grid">
        {kellyExamples.map(example => (
          <section className="card guide-example" key={example[0]}>
            <h3>{example[0]}</h3>
            <ul>
              {example.slice(1).map(item => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>
      <section className="card guide-warning">
        <h3>Tärkeä huomio esimerkeistä</h3>
        <p>
          Esimerkit havainnollistavat vain panoksen laskentaa, eivät tulevaa tuottoa. Kelly perustuu Vedoxin
          todennäköisyysarvioon, joten liian optimistinen arvio voi johtaa liian suureen panokseen. Tarkista kerroin aina,
          käytä itsellesi sopivaa varovaisuusastetta ja pelaa vain rahalla, jonka olet valmis häviämään.
        </p>
      </section>

      <div className="guide-section-title">Käyttö vaihe vaiheelta</div>
      <div className="gd-grid guide-steps">
        {steps.map((g, i) => (
          <div key={g.title} className="card gc">
            <h3><span className="n">{String(i + 1).padStart(2, '0')}</span>{g.title}</h3>
            <p>{g.body}</p>
          </div>
        ))}
      </div>

      <section className="card guide-warning">
        <h3>Vastuullinen pelaaminen</h3>
        <p>
          Vedonlyöntiin liittyy aina riski, erityisesti arvovedoissa. Pelaa vain rahalla, jonka olet valmis häviämään. Älä nosta
          panoksia tappioiden perässä, älä käytä lainarahaa pelaamiseen ja pidä kiinni etukäteen valitusta panossuunnitelmasta.
        </p>
      </section>

      <div className="guide-section-title">Käyttöehdot ja tietosuoja</div>
      <section className="card gc guide-prose" id="policies">
        <h3>Palvelun perussäännöt</h3>
        <p>
          Vedox näyttää käyttäjälle dataan perustuvia kohteita, mutta käyttäjä tekee aina itse päätöksen vedon asettamisesta.
          Vedox ei hallinnoi käyttäjän vedonlyöntisivustojen tilejä, talletuksia tai kotiutuksia.
        </p>
        <p>
          Maksulliset näkymät avautuvat, kun ylläpito on aktivoinut käyttäjälle All-Star-käyttöoikeuden. Käyttäjä ei saa yrittää
          kiertää käyttöoikeuksia, jakaa tunnuksia muille tai levittää maksullisia kohteita eteenpäin.
        </p>
        <p>
          Vedox käsittelee käyttäjän sähköpostia, profiilitietoja, asetuksia ja omia vetoja palvelun toimittamiseksi. Tukea ja
          tietosuojaan liittyviä kysymyksiä varten voit ottaa yhteyttä osoitteeseen support@vedox.fi.
        </p>
      </section>
    </div>
  );
}
