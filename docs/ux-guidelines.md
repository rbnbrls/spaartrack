# Spaartrack UX-regels

Deze regels zijn de canonieke presentatiecontracten voor web, PWA en toekomstige dashboardcomponenten. Ze gelden naast de financiële regels uit [ADR-0002](adr/0002-canonical-ledger.md): de presentatie leest rebuildable read models, maakt financiële herkomst en status zichtbaar en muteert nooit de canonical ledger. Iedere request, job, import, provider call en agent-run behoudt trace- en correlation-ID’s.

De kern van deze stijl is: **dense financial information, presented with calm visual hierarchy**.

## UX-principes

### 1. Werk vanuit één duidelijke informatiehiërarchie

Elke pagina volgt deze volgorde:

1. Globale navigatie
2. Kerncijfers
3. Visuele samenvatting
4. Filter- en segmentatieopties
5. Gedetailleerde tabel
6. Secundaire of historische informatie

De gebruiker moet binnen enkele seconden de totale portefeuillewaarde, performance en belangrijkste verdeling begrijpen. Details verschijnen pas na het overzicht. Elke pagina heeft één primaire context: Portfolio, Prestaties, Dividend of Kalender.

### 2. Gebruik een vaste applicatiestructuur

De bovenbalk bevat horizontale hoofdsecties, een compacte kernwaarde zoals totale portefeuillewaarde, een korte performance-indicator, het merklogo en een gebruikersavatar of accountactie.

De hoofd navigatie blijft op alle pagina’s identiek. De actieve sectie is zichtbaar via kleur, gewicht of underline. Globale statusinformatie blijft bereikbaar zonder extra navigatie. Labels zijn kort en inhoudelijk; gebruik geen marketingtaal.

### 3. Combineer financiële dichtheid met visuele rust

Gebruik veel witruimte, zachte grijze achtergronden, dunne scheidingslijnen, afgeronde kaarten, beperkt kleurgebruik en sterke typografische hiërarchie. Tabellen en controls gebruiken neutrale oppervlakken. Kleur is uitsluitend semantisch: positief, negatief, geselecteerd of informatief. Vermijd decoratieve kleuren en houd rijen compact maar scanbaar.

## Visuele stijl

### Kleuren

De stijl combineert een donkere petrol/groenblauwe hero voor portfolioverdeling met een lichte, bijna grijze applicatieachtergrond voor grafieken en tabellen.

| Token | Richting |
|---|---|
| App background | zeer licht grijs |
| Surface | wit |
| Primary dark | diep petrol / blauwgroen |
| Positive | gedempt groen |
| Negative | gedempt rood |
| Accent | blauw of lavendel |
| Border | lichtgrijs |
| Muted text | middengrijs |
| Primary text | bijna zwart |

Positief en negatief mogen nooit alleen door kleur worden onderscheiden: voeg een percentage, teken of icoon toe. Gebruik maximaal enkele semantische accentkleuren per scherm. Laat grafiekkleuren terugkomen in legenda’s, meters en statuslabels. Tekst, knoppen en statusinformatie voldoen aan WCAG AA-contrast.

### Typografie

Gebruik grote, lichte paginatitels, middelgrote cijfers voor kernmetrics, compacte labels en duidelijke kolomhiërarchie. Gebruik maximaal drie tekstniveaus binnen één component. Financiële kernwaarden zijn dominant maar niet overdreven groot. Bedragen, percentages en datums gebruiken tabulaire cijfers; decimalen, valutatekens en negatieve waarden zijn consistent uitgelijnd.

### Componenten

De kern bestaat uit pill-achtige filter- en periodeknoppen, afgeronde metric cards, compacte toggles, tabbladen met underline, tabellen met subtiele horizontale lijnen, inline meters/progress bars, korte semantische statusbadges, iconen naast security- of eventnamen en accordions voor secundaire secties.

Elke interactieve component heeft hover-, focus-, active- en disabled-states. Dropdowns tonen de huidige selectie. Toggles tonen zowel visuele als tekstuele status. Iconen ondersteunen tekst maar vervangen die niet. Badges zijn kort en semantisch.

## Dashboard- en datavisualisatie-regels

### Portfolio-overzicht

Gebruik een grote verdelingsgrafiek, een logisch geordende legenda met categorie, kleur, verhouding en horizontale meter, filters voor sector/land/valuta/beurs en een tabel met individuele posities.

Filters beïnvloeden grafiek én tabel direct. Toon absolute waarden en percentages waar relevant. Tooltips bevatten alleen aanvullende context. Toon wanneer data actueel is en op welk moment zij is berekend.

### Grafieken

Dividend- en Performancepagina’s combineren KPI-kaarten, periodekeuze, vergelijkingsopties, staaf- en lijngrafieken en een detailtabel. Elke grafiek heeft eenheid, tijdschaal, legenda, assenlabel en context. Werkelijke, verwachte en historische data zijn visueel én tekstueel onderscheidbaar. Kiesbaar zijn maand, kwartaal, jaar en aangepaste periode. Elke grafiek heeft een tabelalternatief of toegankelijke datalaag.

### Tabellen

Securitynaam staat links; financiële waarden staan rechts uitgelijnd. Kolommen zijn sorteerbaar, met inline progress bars voor gewicht of bijdrage, een totaalrij en waar relevant logo, strategie en status. Sorteerrichting en actieve sortering zijn zichtbaar. De eerste kolom blijft herkenbaar tijdens horizontaal scrollen. De totaalrij heeft een aparte visuele behandeling.

Ontwerp expliciete states voor laden, geen data en fout. Op kleinere schermen is de tabel horizontaal scrollbaar of transformeert zij naar cards. Bedragen, percentages en negatieve waarden zijn consistent uitgelijnd.

## Interactiepatronen

### Filters en tijdsperioden

Filters staan dicht bij de data en kunnen categorie-tabs, periodeknoppen, dropdowns, zoekveld, datumbereik en vergelijkingstoggle bevatten. Filters zijn voorspelbaar en omkeerbaar, actieve filters zijn duidelijk zichtbaar en er is een eenvoudige reset. Behoud filterstatus tijdens navigatie waar dat de workflow ondersteunt. Essentiële data mag niet achter verborgen filters zitten.

### Kalender

Ondersteun maand- en weekweergave, periode- en eventfilters, vorige/volgende navigatie en gegroepeerde gebeurtenissen per week. Events zijn scanbaar op datum, type en security. Vandaag is duidelijk gemarkeerd. Eventtypes zijn niet uitsluitend van kleur afhankelijk. Maandnavigatie werkt met toetsenbord en screenreader. Lege dagen tonen expliciet “geen events” of een gelijkwaardige lege staat.

### Progressive disclosure

Toon eerst informatie die beslissingen ondersteunt. Verplaats zelden gebruikte informatie naar accordion, modal of detailpagina. Gebruik disclosure-patronen consistent en behoud de open/dichte status tijdens kleine interacties.

## Responsive requirements

Desktop is leidend, maar mobiel krijgt een expliciete vergelijkbare UX:

- navigatie wordt een compact menu of horizontaal scrollbare tabbar;
- metric cards stapelen verticaal;
- grafieken behouden horizontale leesbaarheid;
- tabellen scrollen horizontaal of veranderen naar positiekaarten;
- belangrijke acties blijven thumb-friendly;
- filters worden samengebracht in één filterpaneel;
- geen kritieke financiële waarde wordt door clipping onzichtbaar.

Minimum: desktop als brede dashboardlayout, tablet als twee kolommen met compacte tabel en mobiel als één kolom met cards en horizontaal scrollbare datavisualisaties.

## Toegankelijkheid

De UI ondersteunt volledige toetsenbordbediening, een zichtbare focusindicator, semantische headings en landmarks, correcte tabelheaders en sorteerstatus, ARIA-labels voor icon-only knoppen, screenreader-uitleg voor grafieken en percentages, formulieren met expliciete labels en foutmeldingen en een minimum touch target van ongeveer 44 × 44 px. Geen betekenis uitsluitend via kleur of positie; ondersteun betekenis altijd met tekst, teken, icoon of structuur.

## Content en tone of voice

Gebruik korte, zakelijke labels zoals “Portfolio”, “Prestaties”, “Dividend”, “Kalender”, “Acties”, “Totaal”, “Geen data” en “Gesloten”. Gebruik financiële termen consequent, schrijf zelfstandige naamwoorden of korte acties en vermijd lange uitleg in de hoofdinterface. Tooltips en helpteksten zijn alleen nodig waar interpretatie lastig is. Lokalisatie blijft consistent voor taal, datumformaat, valuta, decimalen en navigatie.

## Acceptance criteria

Een vergelijkbare UX voldoet minimaal wanneer:

- de belangrijkste portfoliostatus binnen 5 seconden te vinden is;
- elke pagina dezelfde navigatie- en componentlogica gebruikt;
- grafiek, legenda, filters en tabel elkaar inhoudelijk spiegelen;
- positieve, negatieve, verwachte en historische waarden direct herkenbaar zijn;
- tabellen sorteerbaar, scanbaar en responsive zijn;
- empty, loading en error states ontworpen zijn;
- belangrijke functies met toetsenbord en screenreader bruikbaar zijn;
- financiële gegevens nooit uitsluitend door kleur of positie worden verklaard;
- de UI rustig blijft ondanks grote hoeveelheden data;
- lokalisatie en financiële notatie overal consistent zijn.
