# ikozijn-leescontrole

Maakt het nakijkformulier voor het i-Kozijn inmeetformulier: de scan wordt in cellen gesneden en
elke cel komt naast de waarde te staan die de assistent las. Bovenaan staan genummerd de cellen
waar de assistent twijfelde.

Het draait lokaal, in de rekenomgeving van de assistent. Het stuurt niets door: geen scan, geen
uitlezing, geen oordeel.

Een bestand, geen installatie. De i-Kozijn connector geeft de assistent het precieze commando,
met de versie en de vingerafdruk erin:

```sh
curl -sSfL -o ikozijn-leescontrole.mjs https://raw.githubusercontent.com/jappie-p/ikozijn-leescontrole/v1.0.1/ikozijn-leescontrole.mjs
node ikozijn-leescontrole.mjs "scan.pdf" uitlezing.json --uit ./uit
```

- `scan.pdf`: de gescande PDF van het inmeetformulier
- `uitlezing.json`: de uitlezing zoals de assistent hem aan de i-Kozijn connector gaf
- `--uit`: map (of `.html`-bestand) voor het formulier; standaard de huidige map

Nodig: Node 18 of hoger en `pdftoppm` (poppler). Zonder `pdftoppm` of zonder scan komt het
formulier er toch, zonder uitsnedes, met een melding.

Gebouwd en beheerd door Go to Guy voor i-Kozijn.
