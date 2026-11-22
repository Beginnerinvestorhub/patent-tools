# Example Sheets

Each sheet below passes every check in SKILL.md step 4. Copy their
patterns (boxes, arrowheads, lead lines, label placement), not their
content.

## FIG. 1: claim flowchart

One method claim drawn as a flowchart, with a decision that loops back.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="21.6cm" height="27.9cm" viewBox="0 0 216 279" font-family="Arial, Helvetica, sans-serif" fill="none" stroke="#000000" stroke-width="0.4">
  <ellipse cx="100" cy="45" rx="20" ry="7"/>
  <text x="100" y="46.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">START</text>
  <line x1="100" y1="52" x2="100" y2="59.5"/>
  <polygon points="98.7,59.4 101.3,59.4 100,62" fill="#000000" stroke="none"/>
  <rect x="60" y="62" width="80" height="16"/>
  <text x="100" y="71.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">RECEIVE SENSOR DATA</text>
  <text x="43" y="71.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">102</text>
  <line x1="44" y1="70" x2="60" y2="70"/>
  <line x1="100" y1="78" x2="100" y2="87.5"/>
  <polygon points="98.7,87.4 101.3,87.4 100,90" fill="#000000" stroke="none"/>
  <rect x="60" y="90" width="80" height="16"/>
  <text x="100" y="99.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">FILTER WITH THRESHOLD</text>
  <text x="43" y="99.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">104</text>
  <line x1="44" y1="98" x2="60" y2="98"/>
  <line x1="100" y1="106" x2="100" y2="115.5"/>
  <polygon points="98.7,115.4 101.3,115.4 100,118" fill="#000000" stroke="none"/>
  <polygon points="100,118 136,134 100,150 64,134"/>
  <text x="100" y="135.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">VALUE &gt; LIMIT?</text>
  <text x="43" y="135.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">106</text>
  <line x1="44" y1="134" x2="64" y2="134"/>
  <text x="144" y="130" font-size="5" text-anchor="middle" fill="#000000" stroke="none">NO</text>
  <polyline points="136,134 165,134 165,70"/>
  <line x1="165" y1="70" x2="142.5" y2="70"/>
  <polygon points="142.6,68.7 142.6,71.3 140,70" fill="#000000" stroke="none"/>
  <text x="103" y="157" font-size="5" text-anchor="start" fill="#000000" stroke="none">YES</text>
  <line x1="100" y1="150" x2="100" y2="159.5"/>
  <polygon points="98.7,159.4 101.3,159.4 100,162" fill="#000000" stroke="none"/>
  <rect x="60" y="162" width="80" height="16"/>
  <text x="100" y="171.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">GENERATE ALERT</text>
  <text x="43" y="171.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">108</text>
  <line x1="44" y1="170" x2="60" y2="170"/>
  <line x1="100" y1="178" x2="100" y2="187.5"/>
  <polygon points="98.7,187.4 101.3,187.4 100,190" fill="#000000" stroke="none"/>
  <rect x="60" y="190" width="80" height="16"/>
  <text x="100" y="199.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">TRANSMIT ALERT</text>
  <text x="43" y="199.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">110</text>
  <line x1="44" y1="198" x2="60" y2="198"/>
  <line x1="100" y1="206" x2="100" y2="213.5"/>
  <polygon points="98.7,213.4 101.3,213.4 100,216" fill="#000000" stroke="none"/>
  <ellipse cx="100" cy="223" rx="20" ry="7"/>
  <text x="100" y="224.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">END</text>
  <text x="100" y="250" font-size="6" text-anchor="middle" fill="#000000" stroke="none">FIG. 1</text>
</svg>
```

## FIG. 1: software method

A software method flowchart with numbered steps.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="21.6cm" height="27.9cm" viewBox="0 0 216 279" font-family="Arial, Helvetica, sans-serif" fill="none" stroke="#000000" stroke-width="0.4">
<ellipse cx="105" cy="45" rx="20" ry="7"/>
<text x="105" y="46.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">START</text>
<line x1="105" y1="52" x2="105" y2="59.5"/>
<polygon points="103.7,59.4 106.3,59.4 105,62" fill="#000000" stroke="none"/>
<rect x="70" y="62" width="70" height="16"/>
<text x="105.0" y="71.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">RECEIVE USER INPUT</text>
<text x="53" y="71.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">102</text>
<line x1="54" y1="70" x2="70" y2="70"/>
<line x1="105" y1="78" x2="105" y2="83.5"/>
<polygon points="103.7,83.4 106.3,83.4 105,86" fill="#000000" stroke="none"/>
<polygon points="105,86 137,100 105,114 73,100"/>
<text x="105" y="101.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">INPUT VALID?</text>
<text x="56" y="101.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">104</text>
<line x1="57" y1="100" x2="73" y2="100"/>
<text x="141" y="96" font-size="5" text-anchor="middle" fill="#000000" stroke="none">NO</text>
<line x1="137" y1="100" x2="147.5" y2="100"/>
<polygon points="147.4,98.7 147.4,101.3 150,100" fill="#000000" stroke="none"/>
<rect x="150" y="92" width="44" height="16"/>
<text x="172.0" y="101.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">REJECT</text>
<text x="172" y="121" font-size="5" text-anchor="middle" fill="#000000" stroke="none">110</text>
<line x1="172" y1="108" x2="172" y2="116"/>
<line x1="172" y1="92" x2="172" y2="70"/>
<line x1="172" y1="70" x2="142.5" y2="70"/>
<polygon points="142.6,68.7 142.6,71.3 140,70" fill="#000000" stroke="none"/>
<text x="108" y="120" font-size="5" text-anchor="start" fill="#000000" stroke="none">YES</text>
<line x1="105" y1="114" x2="105" y2="121.5"/>
<polygon points="103.7,121.4 106.3,121.4 105,124" fill="#000000" stroke="none"/>
<rect x="70" y="124" width="70" height="16"/>
<text x="105.0" y="133.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">PROCESS DATA</text>
<text x="53" y="133.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">106</text>
<line x1="54" y1="132" x2="70" y2="132"/>
<line x1="105" y1="140" x2="105" y2="147.5"/>
<polygon points="103.7,147.4 106.3,147.4 105,150" fill="#000000" stroke="none"/>
<rect x="70" y="150" width="70" height="16"/>
<text x="105.0" y="159.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">STORE RESULT</text>
<text x="53" y="159.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">108</text>
<line x1="54" y1="158" x2="70" y2="158"/>
<line x1="105" y1="166" x2="105" y2="173.5"/>
<polygon points="103.7,173.4 106.3,173.4 105,176" fill="#000000" stroke="none"/>
<ellipse cx="105" cy="183" rx="20" ry="7"/>
<text x="105" y="184.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">END</text>
<text x="105" y="215" font-size="6" text-anchor="middle" fill="#000000" stroke="none">FIG. 1</text>
</svg>
```

## FIG. 2: sideways sheet

A figure too wide for an upright sheet, turned with one group transform (complex-figures.md, "Sideways sheets").

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="21.6cm" height="27.9cm" viewBox="0 0 216 279" data-orientation="landscape" font-family="Arial, Helvetica, sans-serif" fill="none" stroke="#000000" stroke-width="0.4">
  <!-- Turned sheet: draw in landscape coordinates (x 10 to 245, y 25 to 201 mm); this transform puts the top of the sheet on the right, 37 CFR 1.84(i). -->
  <g transform="matrix(0 -1 1 0 0 279)">
  <rect x="14" y="80" width="32" height="20"/>
  <text x="30" y="91.8" font-size="4.6" text-anchor="middle" fill="#000000" stroke="none">SENSOR</text>
  <line x1="30" y1="100" x2="30" y2="108"/>
  <text x="30" y="114" font-size="5" text-anchor="middle" fill="#000000" stroke="none">202</text>
  <line x1="46" y1="90" x2="51" y2="90"/>
  <polygon points="50.90,91.30 50.90,88.70 53.50,90.00" fill="#000000" stroke="none"/>
  <rect x="53.5" y="80" width="32" height="20"/>
  <text x="69.5" y="91.8" font-size="4.6" text-anchor="middle" fill="#000000" stroke="none">GATEWAY</text>
  <line x1="69.5" y1="100" x2="69.5" y2="108"/>
  <text x="69.5" y="114" font-size="5" text-anchor="middle" fill="#000000" stroke="none">204</text>
  <line x1="85.5" y1="90" x2="90.5" y2="90"/>
  <polygon points="90.40,91.30 90.40,88.70 93.00,90.00" fill="#000000" stroke="none"/>
  <rect x="93" y="80" width="32" height="20"/>
  <text x="109" y="91.8" font-size="4.6" text-anchor="middle" fill="#000000" stroke="none">INGEST</text>
  <line x1="109" y1="100" x2="109" y2="108"/>
  <text x="109" y="114" font-size="5" text-anchor="middle" fill="#000000" stroke="none">206</text>
  <line x1="125" y1="90" x2="130" y2="90"/>
  <polygon points="129.90,91.30 129.90,88.70 132.50,90.00" fill="#000000" stroke="none"/>
  <rect x="132.5" y="80" width="32" height="20"/>
  <text x="148.5" y="88.8" font-size="4.6" text-anchor="middle" fill="#000000" stroke="none">RULES</text>
  <text x="148.5" y="94.8" font-size="4.6" text-anchor="middle" fill="#000000" stroke="none">ENGINE</text>
  <line x1="148.5" y1="100" x2="148.5" y2="108"/>
  <text x="148.5" y="114" font-size="5" text-anchor="middle" fill="#000000" stroke="none">208</text>
  <line x1="164.5" y1="90" x2="169.5" y2="90"/>
  <polygon points="169.40,91.30 169.40,88.70 172.00,90.00" fill="#000000" stroke="none"/>
  <rect x="172" y="80" width="32" height="20"/>
  <text x="188" y="91.8" font-size="4.6" text-anchor="middle" fill="#000000" stroke="none">ALERTS</text>
  <line x1="188" y1="100" x2="188" y2="108"/>
  <text x="188" y="114" font-size="5" text-anchor="middle" fill="#000000" stroke="none">210</text>
  <line x1="204" y1="90" x2="209" y2="90"/>
  <polygon points="208.90,91.30 208.90,88.70 211.50,90.00" fill="#000000" stroke="none"/>
  <rect x="211.5" y="80" width="32" height="20"/>
  <text x="227.5" y="91.8" font-size="4.6" text-anchor="middle" fill="#000000" stroke="none">MOBILE APP</text>
  <line x1="227.5" y1="100" x2="227.5" y2="108"/>
  <text x="227.5" y="114" font-size="5" text-anchor="middle" fill="#000000" stroke="none">212</text>
  <text x="127" y="150" font-size="6" text-anchor="middle" fill="#000000" stroke="none">FIG. 2</text>
  </g>
</svg>
```

## FIG. 3A: flowchart, first sheet

Ends with off page connector A.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="21.6cm" height="27.9cm" viewBox="0 0 216 279" font-family="Arial, Helvetica, sans-serif" fill="none" stroke="#000000" stroke-width="0.4">
  <ellipse cx="108" cy="45" rx="20" ry="7"/>
  <text x="108" y="46.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">START</text>
  <line x1="108" y1="52" x2="108" y2="59.5"/>
  <polygon points="106.70,59.40 109.30,59.40 108.00,62.00" fill="#000000" stroke="none"/>
  <rect x="73" y="62" width="70" height="16"/>
  <text x="108" y="71.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">RECEIVE ORDER</text>
  <text x="54" y="71.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">302</text>
  <line x1="55.5" y1="70" x2="73" y2="70"/>
  <line x1="108" y1="78" x2="108" y2="85.5"/>
  <polygon points="106.70,85.40 109.30,85.40 108.00,88.00" fill="#000000" stroke="none"/>
  <rect x="73" y="88" width="70" height="16"/>
  <text x="108" y="97.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">VERIFY PAYMENT</text>
  <text x="54" y="97.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">304</text>
  <line x1="55.5" y1="96" x2="73" y2="96"/>
  <line x1="108" y1="104" x2="108" y2="111.5"/>
  <polygon points="106.70,111.40 109.30,111.40 108.00,114.00" fill="#000000" stroke="none"/>
  <rect x="73" y="114" width="70" height="16"/>
  <text x="108" y="123.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">RESERVE STOCK</text>
  <text x="54" y="123.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">306</text>
  <line x1="55.5" y1="122" x2="73" y2="122"/>
  <line x1="108" y1="130" x2="108" y2="137.5"/>
  <polygon points="106.70,137.40 109.30,137.40 108.00,140.00" fill="#000000" stroke="none"/>
  <rect x="73" y="140" width="70" height="16"/>
  <text x="108" y="149.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">PICK ITEMS</text>
  <text x="54" y="149.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">308</text>
  <line x1="55.5" y1="148" x2="73" y2="148"/>
  <line x1="108" y1="156" x2="108" y2="163.5"/>
  <polygon points="106.70,163.40 109.30,163.40 108.00,166.00" fill="#000000" stroke="none"/>
  <rect x="73" y="166" width="70" height="16"/>
  <text x="108" y="175.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">PACK ORDER</text>
  <text x="54" y="175.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">310</text>
  <line x1="55.5" y1="174" x2="73" y2="174"/>
  <line x1="108" y1="182" x2="108" y2="189.5"/>
  <polygon points="106.70,189.40 109.30,189.40 108.00,192.00" fill="#000000" stroke="none"/>
  <circle cx="108" cy="198" r="6"/>
  <text x="108" y="199.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">A</text>
  <text x="108" y="250" font-size="6" text-anchor="middle" fill="#000000" stroke="none">FIG. 3A</text>
</svg>
```

## FIG. 3B: flowchart, second sheet

Starts from off page connector A; step numerals run on from FIG. 3A.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="21.6cm" height="27.9cm" viewBox="0 0 216 279" font-family="Arial, Helvetica, sans-serif" fill="none" stroke="#000000" stroke-width="0.4">
  <circle cx="108" cy="46" r="6"/>
  <text x="108" y="47.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">A</text>
  <line x1="108" y1="52" x2="108" y2="59.5"/>
  <polygon points="106.70,59.40 109.30,59.40 108.00,62.00" fill="#000000" stroke="none"/>
  <rect x="73" y="62" width="70" height="16"/>
  <text x="108" y="71.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">PRINT LABEL</text>
  <text x="54" y="71.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">312</text>
  <line x1="55.5" y1="70" x2="73" y2="70"/>
  <line x1="108" y1="78" x2="108" y2="85.5"/>
  <polygon points="106.70,85.40 109.30,85.40 108.00,88.00" fill="#000000" stroke="none"/>
  <rect x="73" y="88" width="70" height="16"/>
  <text x="108" y="97.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">SHIP ORDER</text>
  <text x="54" y="97.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">314</text>
  <line x1="55.5" y1="96" x2="73" y2="96"/>
  <line x1="108" y1="104" x2="108" y2="111.5"/>
  <polygon points="106.70,111.40 109.30,111.40 108.00,114.00" fill="#000000" stroke="none"/>
  <rect x="73" y="114" width="70" height="16"/>
  <text x="108" y="123.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">NOTIFY CUSTOMER</text>
  <text x="54" y="123.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">316</text>
  <line x1="55.5" y1="122" x2="73" y2="122"/>
  <line x1="108" y1="130" x2="108" y2="137.5"/>
  <polygon points="106.70,137.40 109.30,137.40 108.00,140.00" fill="#000000" stroke="none"/>
  <rect x="73" y="140" width="70" height="16"/>
  <text x="108" y="149.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">RECORD DELIVERY</text>
  <text x="54" y="149.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">318</text>
  <line x1="55.5" y1="148" x2="73" y2="148"/>
  <line x1="108" y1="156" x2="108" y2="163.5"/>
  <polygon points="106.70,163.40 109.30,163.40 108.00,166.00" fill="#000000" stroke="none"/>
  <ellipse cx="108" cy="173" rx="20" ry="7"/>
  <text x="108" y="174.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">END</text>
  <text x="108" y="250" font-size="6" text-anchor="middle" fill="#000000" stroke="none">FIG. 3B</text>
</svg>
```

## FIG. 4A and FIG. 4B: two figures on one sheet

Two small views, each with its own label and clear space between them.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="21.6cm" height="27.9cm" viewBox="0 0 216 279" font-family="Arial, Helvetica, sans-serif" fill="none" stroke="#000000" stroke-width="0.4">
  <rect x="58" y="45" width="100" height="48"/>
  <line x1="58" y1="61" x2="158" y2="61"/>
  <line x1="58" y1="77" x2="158" y2="77"/>
  <text x="108" y="55.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">USER ID</text>
  <text x="108" y="71.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">READ KEY</text>
  <text x="108" y="87.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">WRITE KEY</text>
  <text x="176" y="55.8" font-size="5" text-anchor="start" fill="#000000" stroke="none">402</text>
  <line x1="158" y1="54" x2="174" y2="54"/>
  <text x="176" y="71.8" font-size="5" text-anchor="start" fill="#000000" stroke="none">404</text>
  <line x1="158" y1="70" x2="174" y2="70"/>
  <text x="176" y="87.8" font-size="5" text-anchor="start" fill="#000000" stroke="none">406</text>
  <line x1="158" y1="86" x2="174" y2="86"/>
  <text x="40" y="49.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">400</text>
  <line x1="41" y1="48" x2="58" y2="48"/>
  <text x="108" y="108" font-size="6" text-anchor="middle" fill="#000000" stroke="none">FIG. 4A</text>
  <ellipse cx="55" cy="170" rx="20" ry="10"/>
  <text x="55" y="171.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">IDLE</text>
  <line x1="55" y1="180" x2="55" y2="190"/>
  <text x="55" y="196" font-size="5" text-anchor="middle" fill="#000000" stroke="none">410</text>
  <ellipse cx="108" cy="170" rx="20" ry="10"/>
  <text x="108" y="171.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">ACTIVE</text>
  <line x1="108" y1="180" x2="108" y2="190"/>
  <text x="108" y="196" font-size="5" text-anchor="middle" fill="#000000" stroke="none">412</text>
  <ellipse cx="161" cy="170" rx="20" ry="10"/>
  <text x="161" y="171.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">LOCKED</text>
  <line x1="161" y1="180" x2="161" y2="190"/>
  <text x="161" y="196" font-size="5" text-anchor="middle" fill="#000000" stroke="none">414</text>
  <line x1="75" y1="166" x2="85.5" y2="166"/>
  <polygon points="85.40,167.30 85.40,164.70 88.00,166.00" fill="#000000" stroke="none"/>
  <line x1="128" y1="166" x2="138.5" y2="166"/>
  <polygon points="138.40,167.30 138.40,164.70 141.00,166.00" fill="#000000" stroke="none"/>
  <line x1="141" y1="174" x2="130.5" y2="174"/>
  <polygon points="130.60,172.70 130.60,175.30 128.00,174.00" fill="#000000" stroke="none"/>
  <text x="108" y="225" font-size="6" text-anchor="middle" fill="#000000" stroke="none">FIG. 4B</text>
</svg>
```

## FIG. 5: user interface screen

A device outline and screen with numbered elements and lead lines from outside the device.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="21.6cm" height="27.9cm" viewBox="0 0 216 279" font-family="Arial, Helvetica, sans-serif" fill="none" stroke="#000000" stroke-width="0.4">
  <rect x="68" y="45" width="80" height="150" rx="8"/>
  <rect x="74" y="57" width="68" height="124"/>
  <line x1="98" y1="51" x2="118" y2="51"/>
  <text x="108" y="70" font-size="5.5" text-anchor="middle" fill="#000000" stroke="none">SIGN IN</text>
  <rect x="80" y="80" width="56" height="12"/>
  <text x="84" y="87.8" font-size="5" text-anchor="start" fill="#000000" stroke="none">EMAIL</text>
  <rect x="80" y="98" width="56" height="12"/>
  <text x="84" y="105.8" font-size="5" text-anchor="start" fill="#000000" stroke="none">PASSWORD</text>
  <rect x="88" y="120" width="40" height="12" rx="2"/>
  <text x="108" y="127.8" font-size="5" text-anchor="middle" fill="#000000" stroke="none">SIGN IN</text>
  <text x="108" y="146" font-size="5" text-anchor="middle" fill="#000000" stroke="none">FORGOT PASSWORD?</text>
    <text x="56" y="191.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">500</text>
  <line x1="57.5" y1="190" x2="68" y2="190"/>
  <text x="56" y="171.8" font-size="5" text-anchor="end" fill="#000000" stroke="none">502</text>
  <line x1="57.5" y1="170" x2="74" y2="170"/>
  <text x="170" y="87.8" font-size="5" text-anchor="start" fill="#000000" stroke="none">504</text>
  <line x1="136" y1="86" x2="168" y2="86"/>
  <text x="170" y="105.8" font-size="5" text-anchor="start" fill="#000000" stroke="none">506</text>
  <line x1="136" y1="104" x2="168" y2="104"/>
  <text x="170" y="127.8" font-size="5" text-anchor="start" fill="#000000" stroke="none">508</text>
  <line x1="128" y1="126" x2="168" y2="126"/>
  <text x="170" y="146.3" font-size="5" text-anchor="start" fill="#000000" stroke="none">510</text>
  <line x1="136.5" y1="144.5" x2="168" y2="144.5"/>
  <text x="108" y="225" font-size="6" text-anchor="middle" fill="#000000" stroke="none">FIG. 5</text>
</svg>
```
