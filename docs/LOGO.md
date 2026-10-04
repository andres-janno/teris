# TERIS – Visuaalne Identiteet ja Logofailide Juhend

See dokument kirjeldab **TERIS** (teraviljakasvatajate infosüsteemi) ametlikke visuaalse identiteedi elemente, värvipaletti, logovariante ja koodinäiteid veebirakenduses kasutamiseks.

---

## 1. Brändi Sümboolika ja Taust

Logomärk ühendab teraviljakasvatuse põhiväärtused kaasaegse tarkvaradisainiga:
- **Sisemine südamik (Viljatera):** Sümboliseerib väärtuslikku saaki, kvaliteetset seemet ja küpset vilja (oder, nisu, kaer, rukis).
- **Väliskestad ja ohed (Viljapea / Tärkav oras):** Sümboliseerib kasvu, põlluelu ja ülespoole pürgivat taime elujõudu.
- **Tüpograafia:** Jõuline, kergelt paremale kaldu sans-serif font väljendab stabiilsust, tööstuslikku kindlust ja dünaamilist progressi.

---

## 2. Ametlik Värvipalett

Värviskeem on loodud spetsiaalselt teraviljakasvatajate äratundmisvajadust ja elukeskkonda arvestades:

| Värv | HEX | RGB | Kasutusala ja Semantika |
| :--- | :--- | :--- | :--- |
| **Küps Viljakuld** | `#D9822B` | `rgb(217, 130, 43)` | Embleemi sisetera. Valminud saagi ja väärtuse sümbol. |
| **Põlluroheline** | `#1B5E20` | `rgb(27, 94, 32)` | Embleemi väliskestad ja kõrred. Lopsakas oras ja põllumaa. |
| **Metsaroheline / Muld** | `#143820` | `rgb(20, 56, 32)` | Tekst "TERIS". Loetav, kindel kontrast ja professionaalsus. |
| **Särav Viljakuld (Hele)** | `#E5A93C` | `rgb(229, 169, 60)` | Alternatiivne heledam kuldne toon või gradientaktsent. |
| **Antratsiitmuld (Tume)** | `#1F2937` | `rgb(31, 41, 55)` | Neutraalne tume taust või trükitekst. |

---

## 3. Failide Inventar

Kõik SVG-failid asuvad repositooriumi juurkaustas või varade kataloogis:

### Värvilised variandid (Esmane bränding)
1. **`teris-logo-color.svg`** (512×512)  
   Täisvärvides vertikaalne logo (embleem + "TERIS" all). Kasuta esilehel, sisselogimisvaatel, splash-ekraanidel ja dokumentidel.
2. **`teris-horizontal-color.svg`** (443×120)  
   Horisontaalne päiselogo (märk vasakul, tekst paremal). Optimeeritud veebirakenduse ülemisele navigatsiooniribale (navbar).
3. **`teris-icon-color.svg`** (512×512)  
   Värviline ikoonimärk ilma tekstita. Kasutamiseks favikonina (`favicon.svg`), PWA mobiiliikoonina ja väiksemates kasutajaliidese elementides.

### Monokroomsed variandid (Teematugi ja trükk)
4. **`teris-logo.svg`** (512×512)  
   Ühevärviline vertikaalne logo `fill="currentColor"` toega. Pärib automaatselt teksti värvi (tume/hele teema).
5. **`teris-horizontal.svg`** (443×120)  
   Ühevärviline horisontaalne logo navbari.
6. **`teris-icon.svg`** (512×512)  
   Ühevärviline puhas ikoonimärk.

> **Märkus tehnoloogia kohta:**  
> Kõik tähed ja kujundid on 100% vektorrajad (`<path>`). Ükski SVG ei vaja kuvamiseks väliseid kirjatüüpe ega fontide allalaadimist.

---

## 4. Kasutusnäited Koodis

### A. HTML Standard

```html
<!-- Navigatsiooniriba logo -->
<a href="/" class="navbar-brand">
  <img src="/teris-horizontal-color.svg" alt="TERIS" height="40" />
</a>

<!-- Favicon brauseri sakil -->
<link rel="icon" type="image/svg+xml" href="/teris-icon-color.svg" />
```

### B. React / Next.js Komponent (Tailwind CSS toega)

Monokroomse ikooni kasutamine dünaamilise teemaga (`currentColor`):

```tsx
import React from 'react';

interface TerisIconProps {
  className?: string;
}

export const TerisIcon: React.FC<TerisIconProps> = ({ 
  className = 'w-8 h-8 text-emerald-700 dark:text-emerald-400' 
}) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 512 512" 
      fill="currentColor" 
      aria-label="TERIS logo"
    >
      <g id="teris-emblem">
        <path d="M 64.1 52.9 L 64.1 326.6 L 196.6 459.1 L 247.9 459.1 L 247.9 391.6 L 132.9 276.6 L 90.4 276.6 L 90.4 52.9 Z" />
        <path d="M 106.6 52.9 L 106.6 219.1 L 197.9 310.4 L 247.9 310.4 L 247.9 242.9 L 166.6 161.6 L 129.1 161.6 L 129.1 52.9 Z" />
        <path d="M 405.4 52.9 L 405.4 219.1 L 314.1 310.4 L 264.1 310.4 L 264.1 242.9 L 345.4 161.6 L 382.9 161.6 L 382.9 52.9 Z" />
        <path d="M 447.9 52.9 L 447.9 326.6 L 315.4 459.1 L 264.1 459.1 L 264.1 391.6 L 379.1 276.6 L 421.6 276.6 L 421.6 52.9 Z" />
      </g>
    </svg>
  );
};
```

### C. Vue 3 Komponent

```vue
<template>
  <img 
    :src="isDark ? '/teris-horizontal.svg' : '/teris-horizontal-color.svg'" 
    alt="TERIS" 
    class="h-10 w-auto" 
  />
</template>

<script setup>
defineProps({
  isDark: {
    type: Boolean,
    default: false
  }
});
</script>
```

---

## 5. Kujundusreeglid ja Hea Tava

1. **Minimaalne vabaruum (Clearspace):**  
   Logo ümber peab alati jääma piisavalt vaba ruumi (vähemalt embleemi sisetera laiuse jagu), et vältida teiste elementide visuaalset survet.
2. **Minimaalne suurus:**
   - Täislogo koos tekstiga (`teris-logo-color.svg`): minimaalne soovitatav laius ekraanil on `120px`.
   - Ainult embleem (`teris-icon-color.svg`): loetav ja terav alates mõõdust `16×16px`.
3. **Mitte moonutada:**  
   Säilita alati logo proportsioonid (`width` ja `height` suhe). Ära venita ega tihenda logo ebaloomulikult.
