---
title: '“NMPZ” (No Moving, Panning, or Zooming), a GeoGuessr Challenge'
description: '“No moving, panning, or zooming”—a GeoGuessr-esque OSINT challenge testing geographical literacy from idekCTF 2022*.'
date: 2023-01-15
tags: ['ctf', 'osint']
banner:
  light: './assets/banner-light.webp'
  dark: './assets/banner-dark.webp'
authors: ['enscribe']
---

![Banner](./assets/banner.svg)

## Introduction

Recently my team ([Project Sekai](https://sekai.team/)) and I played [idekCTF 2022\*](https://ctftime.org/event/1839) (with an asterisk... because it's 2023), which was an extraordinarily "race against the clock"-esque CTF with a ridiculously large pool of challenges - 58 of them, over a 48-hour runtime. We managed to snag a 1st place finish after countless hours of _not_ touching grass (despite analyzing it throughout this challenge), and I would like to share my personal favorite OSINT challenge of the competition - "NMPZ", an acronym in the [GeoGuessr](https://geoguessr.com/) community for "no **moving**, **panning**, or **zooming**." Although my team hadn't 100% correctly solved the challenge (we inferred part of the flag), here was our thought process tackling it. Enjoy!

## NMPZ

<challenge-info>
<dl>
<div><dt>Solver</dt><dd><a href="https://github.com/jktrn"><img src="https://github.com/jktrn.png" alt="" width="16" height="16" />enscribe</a></dd></div>
<div><dt>Author</dt><dd>jazzzooo</dd></div>
<div><dt>Category</dt><dd>

`OSINT`

</dd></div>
<div><dt>Points</dt><dd>474</dd></div>
<div><dt>File</dt><dd>

`NMPZ.zip{:file}`

</dd></div>
<div><dt>Flag</dt><dd>

<challenge-flag>`idek{BReAK_me_sPaCEbaR}`</challenge-flag>

</dd></div>
</dl>

Are you as good as Rainbolt at GeoGuessr? Prove your skills by geo-guessing
these 17 countries.

</challenge-info>

The provided `README{:file}` file contains the following:

~~~text title="`README{:file}`"
Figure out in which country each image was taken.
The first letter of every country's name will create the flag.
Countries with over 10 million inhabitants will have a capital letter.
Countries with less than one million inhabitants become an underscore.
~~~

Here is a table of the provided example flag (`idek{TEST_flAg}`), and how the flag construction works:

| Image | Country                                                                                   | [Population](https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_population) | Flag |
| ----- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| `1.png{:file}` | <img class="country-flag" src="https://flagcdn.com/20x15/tr.png" srcset="https://flagcdn.com/40x30/tr.png 2x" width="20" height="15" alt="tr" /> [Turkey](https://en.wikipedia.org/wiki/Turkey)               | 84,680,273 ([2021](https://en.wikipedia.org/wiki/Demographics_of_Turkey))                    | `T`  |
| `2.png{:file}` | <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> [Ecuador](https://en.wikipedia.org/wiki/Ecuador)             | 18,145,568 ([2023](https://en.wikipedia.org/wiki/Demographics_of_Ecuador))                   | `E`  |
| `3.png{:file}` | <img class="country-flag" src="https://flagcdn.com/20x15/es.png" srcset="https://flagcdn.com/40x30/es.png 2x" width="20" height="15" alt="es" /> [Spain](https://en.wikipedia.org/wiki/Spain)                 | 47,615,034 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Spain))                     | `S`  |
| `4.png{:file}` | <img class="country-flag" src="https://flagcdn.com/20x15/th.png" srcset="https://flagcdn.com/40x30/th.png 2x" width="20" height="15" alt="th" /> [Thailand](https://en.wikipedia.org/wiki/Thailand)           | 66,883,467 ([2023](https://en.wikipedia.org/wiki/Demographics_of_Thailand))                  | `T`  |
| `5.png{:file}` | <img class="country-flag" src="https://flagcdn.com/20x15/va.png" srcset="https://flagcdn.com/40x30/va.png 2x" width="20" height="15" alt="va" /> [Vatican City](https://en.wikipedia.org/wiki/Vatican_City)   | 825 (2019)                        | `_`  |
| `6.png{:file}` | <img class="country-flag" src="https://flagcdn.com/20x15/fi.png" srcset="https://flagcdn.com/40x30/fi.png 2x" width="20" height="15" alt="fi" /> [Finland](https://en.wikipedia.org/wiki/Finland)             | 5,528,796 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Finland))                    | `f`  |
| `7.png{:file}` | <img class="country-flag" src="https://flagcdn.com/20x15/lt.png" srcset="https://flagcdn.com/40x30/lt.png 2x" width="20" height="15" alt="lt" /> [Lithuania](https://en.wikipedia.org/wiki/Lithuania)         | 2,839,020 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Lithuania))                  | `l`  |
| `8.png{:file}` | <img class="country-flag" src="https://flagcdn.com/20x15/ar.png" srcset="https://flagcdn.com/40x30/ar.png 2x" width="20" height="15" alt="ar" /> [Argentina](https://en.wikipedia.org/wiki/Argentina)         | 47,327,407 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Argentina))                 | `A`  |
| `9.png{:file}` | <img class="country-flag" src="https://flagcdn.com/20x15/ge.png" srcset="https://flagcdn.com/40x30/ge.png 2x" width="20" height="15" alt="ge" /> [Georgia](<https://en.wikipedia.org/wiki/Georgia_(country)>) | 3,688,600 ([2022](<https://en.wikipedia.org/wiki/Demographics_of_Georgia_(country)>))        | `g`  |

We're given... 17 different screenshots of locations on [Google Street View](https://www.google.com/streetview/). Currently, our goal is to find the Country for each and every single one of these screenshots, and to combine each letter together to form the flag (as per the README). Let's get to work.

---

### `1.png{:file}`

![Picture of a waterfront walkway near a sea, with boats in a local harbor with overcast skies. A small statue is visible in the background, peeking above the clouds](./assets/1.png)

Looks like we're on a waterfront walkway with a beautiful view of a harbor. A quick [Google Lens](https://lens.google/) results in a "[Muerta da Urca](https://www.google.com/search?q=mureta+da+urca)" in Rio de Janeiro, <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> [Brazil](https://en.wikipedia.org/wiki/Brazil):

![Google Lens output for `1.png`](./assets/1-lens.png)

Oh, yeah, there's totally a World Wonder in the background by the way... [Christ the Redeemer](<https://en.wikipedia.org/wiki/Christ_the_Redeemer_(statue)>):

![Zoomed in picture of Christ the Redeemer in the background](./assets/1-christ.png)

Since Brazil had a population of ~215 million in [2022](https://en.wikipedia.org/wiki/Demographics_of_Brazil), it'll be capitalized in the flag.

| Image          | Country                                                                     | Population | Flag |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| [`1.png{:file}`](#1png) | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil | 215,652,035 (2023)                   | `B`  |

---

### `2.png{:file}`

![Picture of a flat plaza with Cyrillic posters on the left side. There is a Russian-style Orthodox church in the background](./assets/2.png)

Wow... this is the most <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> [Russia](https://en.wikipedia.org/wiki/Russia) photo I've ever seen! If you don't believe me, here's a Google Lens of the very evident [St. Basil's Cathedral](https://en.wikipedia.org/wiki/Saint_Basil%27s_Cathedral) looming in the background:

![Google lens output of `2.png`](./assets/2-lens.png)

| Image          | Country                                                                     | Population | Flag |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| [`1.png{:file}`](#1png) | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil | 215,652,035 (2023)                   | `B`  |
| [`2.png{:file}`](#2png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia | 146,980,061 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Russia))                   | `R`  |

---

### `3.png{:file}`

![Picture of an empty sidewalk in a European business district. There is a lamppost in the center-left of the screen with directional signs on it](./assets/3.png)

Finally, no more trivial landmarks in the background! Looks like we're now on the roadside of some European business-y area. I quickly noticed a name on the brown sign attached to the streetlight:

![Zoomed in picture of the directional signs on the lamppost](./assets/3-zoom.png)

It reads "Kalamaja", which upon a quick Google results in a small city district in [Tallinn](https://en.wikipedia.org/wiki/Tallinn), <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> [Estonia](https://en.wikipedia.org/wiki/Estonia):

![Google search results for the term "Kalamaja"](./assets/3-google.png)

| Image          | Country                                                                       | Population | Flag |
| -------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| [`1.png{:file}`](#1png) | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil   | 215,652,035 (2023)                   | `B`  |
| [`2.png{:file}`](#2png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia   | 146,980,061 (2022)                   | `R`  |
| [`3.png{:file}`](#3png) | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia | 1,331,796 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Estonia))                    | `e`  |

---

### `4.png{:file}`

![Picture of the side of a rural highway, with patchy grass and reddish soil](./assets/4.png)

The middle of nowhere... a classic. Let's see what the Google Lens yields:

![Google Lens output of `4.png`](./assets/4-lens.png)

The first result identifies a [Stuart Highway](https://en.wikipedia.org/wiki/Stuart_Highway), which runs straight through central <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> [Australia](https://en.wikipedia.org/wiki/Australia) (a.k.a. the middle of nowhere). Also, if you look closely, there's a reflector sign in the center of the photo which looks exactly like the Australian bollard on [geohints.com](https://geohints.com/meta/bollards), a resource for GeoGuessr players:

<div class="button-row">

<figure class="tight">

![Zoomed in picture of the bollard at the center-bottom of
`4.png`](./assets/4-bollard.png)
<figcaption class="caption">

Bollard in [`4.png{:file}`](#4png)

</figcaption>

</figure>
<figure class="tight">

![Screenshot of example Australian bollards on
geohints.com](./assets/4-comparison.png)
<figcaption class="caption">

Australian bollard in [geohints.com](https://geohints.com/meta/bollards)

</figcaption>

</figure>

</div>

Additionally, a key "Australian" identifier would be the orangey dirt on the roadsides, which is common around the country.

| Image          | Country                                                                           | Population | Flag |
| -------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| [`1.png{:file}`](#1png) | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil       | 215,652,035 (2023)                   | `B`  |
| [`2.png{:file}`](#2png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia       | 146,980,061 (2022)                   | `R`  |
| [`3.png{:file}`](#3png) | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia     | 1,331,796 (2022)                    | `e`  |
| [`4.png{:file}`](#4png) | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia | 26,033,493 ([2023](https://en.wikipedia.org/wiki/Demographics_of_Australia))                 | `A`  |

---

### `5.png{:file}`

![Picture taken on top of a car in a small, dusty alleyway. There is Arabic script on the right-hand side, and the license plates are yellow. Left-hand drive is also present](./assets/5.png)

This one was extraordinarily rough. According to the author themselves:

> its hilarious that every single person got one country wrong, but the letter was the same so it didnt matter... you included ;)
>
> <cite>— jazzzooo</cite>

...and apparently this was the one that everyone was messing up!

Let's move on to my approach. I noticed a few things:

![Labeled version of 5.png](./assets/5-lettered.webp)

<ol type="A">
  <li>
    The extraordinarily ambiguous "Third St" on top of the grey SUV in front of
    us
  </li>
  <li>
    The words "Al-Siraad Plaza" plastered to the side of the grey building on
    the left
  </li>
  <li>
    The words "Ab-Furqan" on the poster above the white/green checkered wall on
    the left
  </li>
  <li>Arabic script on the walls of the white/green building on the right</li>
  <li>An advertisement for "Peri Peri Pizza" on the far right</li>
  <li>Consistently yellow license plates</li>
</ol>

All signs point to an Arabic-speaking country. In addition, since we solved each image out of order (and knew the next character would be an underscore) the flag contained the word segment `BReA-`, which only had three possibilities to form a proper word: `BReAD`, `BReAK`, and `BReAM` (which we ruled out due to unlikeliness). As a result, we simply guessed the country to be <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> [Kazakhstan](https://en.wikipedia.org/wiki/Kazakhstan) (even though it doesn't have official Google Street View coverage and Arabic isn't a nationally recognized language).

#### GeoGuessr meta: the infamous snorkel

Now... here is the absolutely crazy part. After solving the challenge, the author revealed to me what the actual country was:

> do you see the little snorkel on the right front corner of your car in `5.png{:file}`?
> i implore you to google "geoguessr snorkel" haha
>
> <cite>— jazzzooo</cite>

I had no idea what they were talking about, so I zoomed in on the car and lo and behold, snorkel:

![Zoomed in picture of the "snorkel"-looking object (an upward exhaust) on the car's right-hand side](./assets/5-snorkel.png)

I did a quick Google search, and found a tweet from the official GeoGuessr [Twitter](https://twitter.com/geoguessr/) account:

<static-tweet>
<tweet-header>
<img src="https://pbs.twimg.com/profile_images/1598668200375369728/0aaAqc68_400x400.jpg" alt="" width="48" height="48" />
<tweet-author>
<b>GeoGuessr</b>
<span>@geoguessr</span>
<span>August 30, 2022</span>
</tweet-author>
<a href="https://twitter.com/geoguessr/status/1564621460034969606">View on Twitter</a>
</tweet-header>

The Kenya Snorkels 🤿 Beautiful, bombastic & ehm... broombroom?

<img src="https://pbs.twimg.com/media/FbamixjXoBIGYzm?format=jpg&name=medium" alt="Tweet media" />

</static-tweet>

Apparently, this was one of the strategies that GeoGuessr pros use to quickly identify countries: using the car the Photo Sphere was taken from to their advantage, considered to be part of the "meta" game. The "<img class="country-flag" src="https://flagcdn.com/20x15/ke.png" srcset="https://flagcdn.com/40x30/ke.png 2x" width="20" height="15" alt="ke" /> [Kenya](https://en.wikipedia.org/wiki/Kenya) Snorkel" was one of the more infamous ones, and I had no idea it existed. I was absolutely blown away. Since I guessed Kazakhstan wrong, it will be italicized in the below table.

| Image          | Country                                                                               | Population | Flag |
| -------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| [`1.png{:file}`](#1png) | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil           | 215,652,035 (2023)                   | `B`  |
| [`2.png{:file}`](#2png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia           | 146,980,061 (2022)                   | `R`  |
| [`3.png{:file}`](#3png) | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia         | 1,331,796 (2022)                    | `e`  |
| [`4.png{:file}`](#4png) | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia     | 26,033,493 (2023)                 | `A`  |
| [`5.png{:file}`](#5png) | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_ | 19,392,112 ([2023](https://en.wikipedia.org/wiki/Demographics_of_Kazakhstan))                | `K`  |

---

### `6.png{:file}`

![Picture of a road in an extremely flat & empty plains, with overcast skies and yellow reflector poles](./assets/6.png)

Ah, yes, another "middle of nowhere." This time, however, it's a bit easier! Here's the Google Lens yield:

![Google Lens output of `6.png`](./assets/6-lens.png)

Yep, that's definitely <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> [Iceland](https://en.wikipedia.org/wiki/Iceland). Here are some things you use to identify Iceland:

- 99% of the time there will be overcast skies
- Off-green, almost yellow-ish grass. Here is an example from [GeoHints](https://geohints.com/meta/sceneries):

![Example screenshots of Iceland on geohints.com](./assets/6-geohints.png)

- Bollards! These ones are bright yellow with a diagonally pointed top, and a white reflector:

<div class="button-row">

<figure class="tight">

![Screenshot of yellow bollard in `6.png`](./assets/6-bollard.png)
<figcaption class="caption">

Bollard in [`6.png{:file}`](#6png)

</figcaption>

</figure>
<figure class="tight">

![Screenshot of example Icelandic bollards on
geohints.com](./assets/6-comparison.png)
<figcaption class="caption">

Icelandic bollard in [geohints.com](https://geohints.com/meta/bollards)

</figcaption>

</figure>

</div>

This character will be an underscore (`_`), since the population of Iceland is 376,000 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Iceland)).

| Image          | Country                                                                               | Population | Flag |
| -------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| [`1.png{:file}`](#1png) | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil           | 215,652,035 (2023)                   | `B`  |
| [`2.png{:file}`](#2png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia           | 146,980,061 (2022)                   | `R`  |
| [`3.png{:file}`](#3png) | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia         | 1,331,796 (2022)                    | `e`  |
| [`4.png{:file}`](#4png) | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia     | 26,033,493 (2023)                 | `A`  |
| [`5.png{:file}`](#5png) | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_ | 19,392,112 (2023)                | `K`  |
| [`6.png{:file}`](#6png) | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland         | 385,230 (2022)                      | `_`  |

---

### `7.png{:file}`

![Picture of a giant neighborhood in a brushland/desert region, with wooden fences, roofs, and electric poles](./assets/7.png)

Wow... I've never seen a neighborhood this massive with not a single piece of foliage in sight. Here's the Google Lens output:

![Google lens output of `7.png`](./assets/7-lens.png)

Definitely [Ulaanbaatar](https://en.wikipedia.org/wiki/Ulaanbaatar), <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> [Mongolia](https://en.wikipedia.org/wiki/Mongolia)! We confirmed it with the license plate of the car on the left:

<div class="button-row">

<figure class="tight">

![Zoomed in screenshot of a car's license plate in
`7.png`](./assets/7-plate.png)
<figcaption class="caption">

License plate in [`7.png{:file}`](#7png)

</figcaption>

</figure>
<figure class="tight">

![Wikimedia Commons example of Mongolian license
plate](./assets/7-comparison.png)
<figcaption class="caption">

Mongolian license plate
([Wikipedia](https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_Mongolia))

</figcaption>

</figure>

</div>

| Image          | Country                                                                               | Population | Flag |
| -------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- |
| [`1.png{:file}`](#1png) | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil           | 215,652,035 (2023)                   | `B`  |
| [`2.png{:file}`](#2png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia           | 146,980,061 (2022)                   | `R`  |
| [`3.png{:file}`](#3png) | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia         | 1,331,796 (2022)                    | `e`  |
| [`4.png{:file}`](#4png) | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia     | 26,033,493 (2023)                 | `A`  |
| [`5.png{:file}`](#5png) | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_ | 19,392,112 (2023)                | `K`  |
| [`6.png{:file}`](#6png) | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland         | 385,230 (2022)                      | `_`  |
| [`7.png{:file}`](#7png) | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia       | 3,477,605 ([2023](https://en.wikipedia.org/wiki/Demographics_of_Mongolia))                   | `m ` |

---

### `8.png{:file}`

![Picture of a hilly region with paved roads and scarce foliage. The houses have red-tiled roofs](./assets/8.png)

This was arguably one of the hardest to solve (and one that we got incorrect). Here's the Google Lens output:

![Google Lens output of `8.png`](./assets/8-lens.png)

No idea! Our original guess was the <img class="country-flag" src="https://flagcdn.com/20x15/ph.png" srcset="https://flagcdn.com/40x30/ph.png 2x" width="20" height="15" alt="ph" /> [Philippines](https://en.wikipedia.org/wiki/Philippines) or <img class="country-flag" src="https://flagcdn.com/20x15/id.png" srcset="https://flagcdn.com/40x30/id.png 2x" width="20" height="15" alt="id" /> [Indonesia](https://en.wikipedia.org/wiki/Indonesia), but `BReAK_m(P/I)_` didn't make any sense. We moved on to the next image and discovered it was an underscore (`_`), and eventually came to the conclusion that the country had to either start with `E` or `Y` to make any sense (to make either `BReAK_m`(`Y`/`y`) or `BReAK_m`(`E`/`e`)). The only recognized country which starts with Y is <img class="country-flag" src="https://flagcdn.com/20x15/ye.png" srcset="https://flagcdn.com/40x30/ye.png 2x" width="20" height="15" alt="ye" /> [Yemen](https://en.wikipedia.org/wiki/Yemen), which was an unlikely guess because of the consistent greenery, foliage, and hills (in the Arabian Peninsula, practically all desert).

In accordance with `E`/`e` as the only likely character, we eventually settled on either <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> [El Salvador](https://en.wikipedia.org/wiki/El_Salvador) or <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> Ecuador, so this character would be either uppercase or lowercase.

| Image          | Country                                                                                                                                                                   | Population                                                               | Flag    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png) | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png) | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png) | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png) | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png) | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png) | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png) | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 ([2021](https://en.wikipedia.org/wiki/Demographics_of_El_Salvador)) / 18,145,568 (2023) | `e`/`E` |

---

### `9.png{:file}`

![Picture taken in the water off the shore of a large city's downtown area. The buildings are mostly white and there are hills in the background](./assets/9.png)

A Photo Sphere in the middle of the sea! Looks like we're in a pretty large city, and it's giving off tourist resort-y vibes. Here's the Google Lens output:

![Google Lens output of `9.png`](./assets/9-lens.png)

It looks like it's identified the cityscape as belonging to <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> [Monaco](https://en.wikipedia.org/wiki/Monaco). It's even identified the facade of one of the buildings in the city as the [Opéra de Monte-Carlo](https://en.wikipedia.org/wiki/Op%C3%A9ra_de_Monte-Carlo):

![Zoomed in picture of grand building in the city skyline](./assets/9-facade.png)

Let's add an underscore to the flag, since Monaco's population is 37,308 ([2016](https://en.wikipedia.org/wiki/Demographics_of_Monaco)).

| Image          | Country                                                                                                                                                                   | Population                                                               | Flag    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png) | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png) | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png) | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png) | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png) | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png) | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png) | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 (2021) / 18,145,568 (2023) | `e`/`E` |
| [`9.png{:file}`](#9png) | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco                                                                                               | 39,150 (2021)                                                                                      | `_`     |

---

### `10.png{:file}`

![Picture of a small town next to a hillside, with North European/Scandinavian-style houses](./assets/10.png)

We're now given a small town in the hills of an assumingly European country (overall house aesthetic). Here's the Google Lens output:

![Google Lens output of `10.png`](./assets/10-lens.png)

Lens results are giving me either <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> [Switzerland](https://en.wikipedia.org/wiki/Switzerland) or <img class="country-flag" src="https://flagcdn.com/20x15/no.png" srcset="https://flagcdn.com/40x30/no.png 2x" width="20" height="15" alt="no" /> [Norway](https://en.wikipedia.org/wiki/Norway). My suspicions for Switzerland were confirmed when I saw its recognizable square flag hanging off one of the houses:

![Zoomed in picture of the Swiss flag hung off the eave of a house on the left](./assets/10-zoom.png)

| Image            | Country                                                                                                                                                                   | Population                                                               | Flag    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png)   | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png)   | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png)   | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png)   | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png)   | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 (2021) / 18,145,568 (2023) | `e`/`E` |
| [`9.png{:file}`](#9png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco                                                                                               | 39,150 (2021)                                                                                      | `_`     |
| [`10.png{:file}`](#10png) | <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland                                                                                     | 8,789,726 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Switzerland))                                                                              | `s`     |

---

### `11.png{:file}`

![Picture of a sparsely green suburban neighborhood, with not many houses](./assets/11.png)

Splat in the middle of an inconspicuous-looking suburb! Here's the Google Lens output when you focus in on the bollards on the street (since there's nothing of interest anywhere else):

![Google Lens output of `11.png`](./assets/11-lens.png)

Scrolling through the outputs results in distinctly <img class="country-flag" src="https://flagcdn.com/20x15/pl.png" srcset="https://flagcdn.com/40x30/pl.png 2x" width="20" height="15" alt="pl" /> [Polish](https://en.wikipedia.org/wiki/Poland) bollards:

<div class="button-row">

<figure class="tight">

![Zoomed in picture of a bollard in `11.png`](./assets/11-bollard.png)
<figcaption class="caption">

Bollard in [`11.png{:file}`](#11png)

</figcaption>

</figure>
<figure class="tight">

![Screenshot of example Polish bollard on
geohints.com](./assets/11-comparison.png)
<figcaption class="caption">

Polish bollard in [geohints.com](https://geohints.com/meta/bollards)

</figcaption>

</figure>

</div>

| Image            | Country                                                                                                                                                                   | Population                                                               | Flag    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png)   | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png)   | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png)   | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png)   | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png)   | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 (2021) / 18,145,568 (2023) | `e`/`E` |
| [`9.png{:file}`](#9png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco                                                                                               | 39,150 (2021)                                                                                      | `_`     |
| [`10.png{:file}`](#10png) | <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland                                                                                     | 8,789,726 (2022)                                                                              | `s`     |
| [`11.png{:file}`](#11png) | <img class="country-flag" src="https://flagcdn.com/20x15/pl.png" srcset="https://flagcdn.com/40x30/pl.png 2x" width="20" height="15" alt="pl" /> Poland                                                                                               | 37,796,000 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Poland))                                                                                  | `P`     |

---

### `12.png{:file}`

![Picture of a distinctly European street curving right with business establishments on the left-hand side](./assets/12.png)

More Europe! Here's the Google Lens output:

![Google Lens output of `12.png`](./assets/12-lens.png)

The vertical sign reads "ELEKTRO", whilst the lower horizontal sign reads "Weißensteiner", two distinctly German words (with the latter being a surname, romanized into "[Weissensteiner](https://forebears.io/surnames/weissensteiner)"). Although we could automatically assume <img class="country-flag" src="https://flagcdn.com/20x15/de.png" srcset="https://flagcdn.com/40x30/de.png 2x" width="20" height="15" alt="de" /> [Germany](https://en.wikipedia.org/wiki/Germany), there are multiple other German-speaking European countries, so we'll have to narrow it down further.

Here's the solution: simply Google "Elektro Weißensteiner" and you'll find that it's an electronics store based in <img class="country-flag" src="https://flagcdn.com/20x15/at.png" srcset="https://flagcdn.com/40x30/at.png 2x" width="20" height="15" alt="at" /> [Austria](https://en.wikipedia.org/wiki/Austria):

![Google search result of "Elektro Weißensteiner"](./assets/12-google.png)

> [Elektro Weißensteiner GmbH](https://www.google.com/maps?q=elektro+weissensteiner)  
> 4.3 ⭐⭐⭐⭐⭐ 6 Google reviews  
> Electronics store in Liezen, Austria

| Image            | Country                                                                                                                                                                   | Population                                                               | Flag    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png)   | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png)   | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png)   | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png)   | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png)   | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 (2021) / 18,145,568 (2023) | `e`/`E` |
| [`9.png{:file}`](#9png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco                                                                                               | 39,150 (2021)                                                                                      | `_`     |
| [`10.png{:file}`](#10png) | <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland                                                                                     | 8,789,726 (2022)                                                                              | `s`     |
| [`11.png{:file}`](#11png) | <img class="country-flag" src="https://flagcdn.com/20x15/pl.png" srcset="https://flagcdn.com/40x30/pl.png 2x" width="20" height="15" alt="pl" /> Poland                                                                                               | 37,796,000 (2022)                                                                                  | `P`     |
| [`12.png{:file}`](#12png) | <img class="country-flag" src="https://flagcdn.com/20x15/at.png" srcset="https://flagcdn.com/40x30/at.png 2x" width="20" height="15" alt="at" /> Austria                                                                                             | 9,090,868 ([2022](https://en.wikipedia.org/wiki/Demographics_of_Austria))                                                                                  | `a`     |

---

### `13.png{:file}`

![Picture of a paved road spanning an extremely flat area covered with dead prairie grass](./assets/13.png)

This is probably the quintessential "North America" picture ever—impossibly flat land, a random city skyline in the background, and huge fields. A Google Lens search yields nothing we don't already know:

![Google Lens output of `13.png`](./assets/13-lens.png)

Currently, our only issue here is telling between either <img class="country-flag" src="https://flagcdn.com/20x15/ca.png" srcset="https://flagcdn.com/40x30/ca.png 2x" width="20" height="15" alt="ca" /> [Canada](https://en.wikipedia.org/wiki/Canada) or the <img class="country-flag" src="https://flagcdn.com/20x15/us.png" srcset="https://flagcdn.com/40x30/us.png 2x" width="20" height="15" alt="us" /> [United States](https://en.wikipedia.org/wiki/United_States). Let's narrow it down a bit more.

The only telling sign here is **road markings**. Since I live in the US, I know that two-way roads (with one lane per direction) are typically marked with either **broken double** yellow lines or **solid double** yellow lines. Although **single dashed** yellow lines exist in the US, they are much more common in Canada (albeit still existing in the US). Here's a diagram I threw up, which you can combine with the overall "feel" of an image to make a calculated guess:

![Original diagram of American vs. Canadian road markings. "Either US or Canada" is labeled for both broken/solid double lines, while "More likely Canada" is marked for single dashed lines](./assets/13-streets.svg)

Alongside this, not a single common word in English starts with the prefix `spau-`, so ruling out the US is a no-brainer. However, the above knowledge about road markings is useful when you have no flag to infer characters from!

| Image            | Country                                                                                                                                                                   | Population                                                               | Flag    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png)   | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png)   | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png)   | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png)   | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png)   | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 (2021) / 18,145,568 (2023) | `e`/`E` |
| [`9.png{:file}`](#9png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco                                                                                               | 39,150 (2021)                                                                                      | `_`     |
| [`10.png{:file}`](#10png) | <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland                                                                                     | 8,789,726 (2022)                                                                              | `s`     |
| [`11.png{:file}`](#11png) | <img class="country-flag" src="https://flagcdn.com/20x15/pl.png" srcset="https://flagcdn.com/40x30/pl.png 2x" width="20" height="15" alt="pl" /> Poland                                                                                               | 37,796,000 (2022)                                                                                  | `P`     |
| [`12.png{:file}`](#12png) | <img class="country-flag" src="https://flagcdn.com/20x15/at.png" srcset="https://flagcdn.com/40x30/at.png 2x" width="20" height="15" alt="at" /> Austria                                                                                             | 9,090,868 (2022)                                                                                  | `a`     |
| [`13.png{:file}`](#13png) | <img class="country-flag" src="https://flagcdn.com/20x15/ca.png" srcset="https://flagcdn.com/40x30/ca.png 2x" width="20" height="15" alt="ca" /> Canada                                                                                               | 39,082,640 ([2023](https://en.wikipedia.org/wiki/Demographics_of_Canada))                                                                                  | `C`     |

---

### `14.png{:file}`

![Picture of a roadside in a seemingly tropical area. There are black on yellow turn chevrons on the edges of the road, and a car off to the right with an orange license plate](./assets/14.png)

This one was actually really, really clever. Although a Google Lens yields nothing of use (since its viewpoint is a random tropical area), take a look at the bottom right-hand corner of the image:

![Screenshot of the street label partially visible on the bottom right of the image](./assets/14-bottom.png)

Is that an acute accent mark on top of the letter I ("í")? Inferring from the shape of the other letters, it looks like this segment of the word spells out "-íal", which many Spanish words end with. We can safely narrow this down to a Latin-American/Spanish-speaking country.

Let's keep inferring from the flag. It currently says `BReAK_m(E/e)_sPaC`, so we can safely guess that the next country should start with "e" or "E" to continue the next likely word, "space." <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> Ecuador and <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> El Salvador are the only Spanish-speaking countries that start with "e" or "E", and I was able to narrow it down to Ecuador solely from the license plate of the car on the right, which looks like a taxi:

<div class="image-grid">

<figure class="tight">

![Zoomed in picture of blurred orange license plate](./assets/14-plate.png)
<figcaption class="caption">

License plate in [`14.png{:file}`](#14png)

</figcaption>

</figure>
<figure class="tight">

![Wikimedia Commons example Ecuadorian license plate, colored orange to
indicate taxis/buses](./assets/14-comparison.jpg)
<figcaption class="caption">

Ecuadorian license plate (commercial vehicles,
[Wikipedia](https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_Ecuador))

</figcaption>

</figure>

</div>

| Image            | Country                                                                                                                                                                   | Population                                                               | Flag    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png)   | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png)   | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png)   | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png)   | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png)   | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 (2021) / 18,145,568 (2023) | `e`/`E` |
| [`9.png{:file}`](#9png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco                                                                                               | 39,150 (2021)                                                                                      | `_`     |
| [`10.png{:file}`](#10png) | <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland                                                                                     | 8,789,726 (2022)                                                                              | `s`     |
| [`11.png{:file}`](#11png) | <img class="country-flag" src="https://flagcdn.com/20x15/pl.png" srcset="https://flagcdn.com/40x30/pl.png 2x" width="20" height="15" alt="pl" /> Poland                                                                                               | 37,796,000 (2022)                                                                                  | `P`     |
| [`12.png{:file}`](#12png) | <img class="country-flag" src="https://flagcdn.com/20x15/at.png" srcset="https://flagcdn.com/40x30/at.png 2x" width="20" height="15" alt="at" /> Austria                                                                                             | 9,090,868 (2022)                                                                                  | `a`     |
| [`13.png{:file}`](#13png) | <img class="country-flag" src="https://flagcdn.com/20x15/ca.png" srcset="https://flagcdn.com/40x30/ca.png 2x" width="20" height="15" alt="ca" /> Canada                                                                                               | 39,082,640 (2023)                                                                                  | `C`     |
| [`14.png{:file}`](#14png) | <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> Ecuador                                                                                             | 18,146,244 (2023)                                                                                 | `E`     |

---

### `15.png{:file}`

![Picture of a dilapidated, bleak snowy area with a dirt road weaving through two red-tiled houses. A small metal dumpster rests on the left](./assets/15.png)

We are now presented with... some dilapidated, snowy houses! This will be difficult to narrow down.

Google Lens yielded nothing of use, but I did identify some Cyrillic writing on the dumpster to the left:

![Zoomed in picture of dumpster with Cyrillic writing](./assets/15-bin.png)

#### The guesswork begins

This was around the time my team started to suspect the flag for the challenge read "break me spacebar", which is a meme in the GeoGuessr community for how content creator [Rainbolt](https://www.youtube.com/@georainbolt) hits his spacebar really loudly when guessing a location on the map:

![Google search for "rainbolt spacebar"](./assets/15-spacebar.png)

> YouTube: "[1 hour of silence randomly interrupted by Rainbolt annihilating his spacebar](https://www.youtube.com/watch?v=UDFFWi0pKlM)" by wid  
> YouTube: "[geoguessr but i have to slam my spacebar](https://www.youtube.com/watch?v=xDoy9CFIiBw)" by Toofee  
> YouTube: "[Rainbolt hitting space bar for 1 minute](https://www.youtube.com/watch?v=vdgPDUpyT9Y)" by PSM

In accordance with the word "spacebar", I narrowed the country down to the only Russian-speaking country (in terms of officially recognized languages) with starts with "B": <img class="country-flag" src="https://flagcdn.com/20x15/by.png" srcset="https://flagcdn.com/40x30/by.png 2x" width="20" height="15" alt="by" /> [Belarus](https://en.wikipedia.org/wiki/Belarus).

#### GeoGuessr meta: snow coverage

So... Belarus was incorrect. However, it had a population under 10 million (similarly to the correct answer), meaning that the letter `b` was correct, regardless. The real country this image was taken in was <img class="country-flag" src="https://flagcdn.com/20x15/bg.png" srcset="https://flagcdn.com/40x30/bg.png 2x" width="20" height="15" alt="bg" /> [Bulgaria](https://en.wikipedia.org/wiki/Bulgaria), which a pro player would guess due to the typical snow coverage of Google Street View. According to this [GeoGuessr Tips](https://somerandomstuff1.wordpress.com/2019/02/08/geoguessr-the-top-tips-tricks-and-techniques/#bulgaria) article:

> Hungary is one of three European countries that can have similar, bleak, winter scenery with trees without leaves and snowfall beside the road. The other two countries are Bulgaria and small parts of Czechia.

> Much of Bulgarian Street View was taken in winter and thus the trees are often without leaves and the Street View scenes in Bulgaria are often fairly bleak. Within Europe, Hungary and parts of Czechia have similar bleak wintery scenery. Bulgaria is one of the poorest countries in Europe and the Bulgarian roads reflect this fact. These roads are commonly crumbling and filled with cracks and holes.

So when you see a combination of dilapidation/bleakness and snowiness, Bulgaria, <img class="country-flag" src="https://flagcdn.com/20x15/hu.png" srcset="https://flagcdn.com/40x30/hu.png 2x" width="20" height="15" alt="hu" /> [Hungary](https://en.wikipedia.org/wiki/Hungary), or <img class="country-flag" src="https://flagcdn.com/20x15/cz.png" srcset="https://flagcdn.com/40x30/cz.png 2x" width="20" height="15" alt="cz" /> [Czechia](https://en.wikipedia.org/wiki/Czech_Republic) would be your best guesses.

| Image            | Country                                                                                                                                                                   | Population                                                               | Flag    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png)   | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png)   | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png)   | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png)   | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png)   | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 (2021) / 18,145,568 (2023) | `e`/`E` |
| [`9.png{:file}`](#9png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco                                                                                               | 39,150 (2021)                                                                                      | `_`     |
| [`10.png{:file}`](#10png) | <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland                                                                                     | 8,789,726 (2022)                                                                              | `s`     |
| [`11.png{:file}`](#11png) | <img class="country-flag" src="https://flagcdn.com/20x15/pl.png" srcset="https://flagcdn.com/40x30/pl.png 2x" width="20" height="15" alt="pl" /> Poland                                                                                               | 37,796,000 (2022)                                                                                  | `P`     |
| [`12.png{:file}`](#12png) | <img class="country-flag" src="https://flagcdn.com/20x15/at.png" srcset="https://flagcdn.com/40x30/at.png 2x" width="20" height="15" alt="at" /> Austria                                                                                             | 9,090,868 (2022)                                                                                  | `a`     |
| [`13.png{:file}`](#13png) | <img class="country-flag" src="https://flagcdn.com/20x15/ca.png" srcset="https://flagcdn.com/40x30/ca.png 2x" width="20" height="15" alt="ca" /> Canada                                                                                               | 39,082,640 (2023)                                                                                  | `C`     |
| [`14.png{:file}`](#14png) | <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> Ecuador                                                                                             | 18,146,244 (2023)                                                                                 | `E`     |
| [`15.png{:file}`](#15png) | <img class="country-flag" src="https://flagcdn.com/20x15/by.png" srcset="https://flagcdn.com/40x30/by.png 2x" width="20" height="15" alt="by" /> Belarus                                                                                             | 9,349,645 ([2021](https://en.wikipedia.org/wiki/Demographics_of_Belarus))                                                                                  | `b`     |

---

### `16.png{:file}`

![Picture of a beautiful valley area with hills and mountains, and a white on black turn chevron on the road](./assets/16.png)

Beautiful hills and mountains... However, I genuinely have no idea where this could be!

Let's start off with what little we have, and analyze the black and white chevron marker in the center of the image:

![Zoomed in picture of the turn chevron](./assets/16-zoom.png)

I initially scoured the internet for countries which use this specific chevron and came across this map, courtesy of user [u/isaacSW](https://www.reddit.com/r/geoguessr/comments/lwa9wr/map_of_european_road_curve_chevron_signs/) on the [r/geoguessr](https://www.reddit.com/r/geoguessr/) subreddit:

![Diagram of Europe, with each country filled in with the color of turn chevrons they use](./assets/16-map.webp)

According to this map, the only countries which use white-on-black turn chevrons are the <img class="country-flag" src="https://flagcdn.com/20x15/gb.png" srcset="https://flagcdn.com/40x30/gb.png 2x" width="20" height="15" alt="gb" /> [United Kingdom](https://en.wikipedia.org/wiki/United_Kingdom), <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland, <img class="country-flag" src="https://flagcdn.com/20x15/it.png" srcset="https://flagcdn.com/40x30/it.png 2x" width="20" height="15" alt="it" /> [Italy](https://en.wikipedia.org/wiki/Italy), <img class="country-flag" src="https://flagcdn.com/20x15/gr.png" srcset="https://flagcdn.com/40x30/gr.png 2x" width="20" height="15" alt="gr" /> [Greece](https://en.wikipedia.org/wiki/Greece), <img class="country-flag" src="https://flagcdn.com/20x15/al.png" srcset="https://flagcdn.com/40x30/al.png 2x" width="20" height="15" alt="al" /> [Albania](https://en.wikipedia.org/wiki/Albania), and occasionally <img class="country-flag" src="https://flagcdn.com/20x15/es.png" srcset="https://flagcdn.com/40x30/es.png 2x" width="20" height="15" alt="es" /> Spain.

Since this part of the flag says "spacebar", the only choice which starts with "A" is Albania, so we will be using "a" for this character.

#### GeoGuessr meta: rifts in the sky

After the challenge was completed, the author revealed something really interesting about this image... "**rifts in the sky**":

<static-tweet>
<tweet-header>
<img src="https://pbs.twimg.com/profile_images/1749414032279216128/sxf-SdKE_400x400.jpg" alt="" width="48" height="48" />
<tweet-author>
<b>PokemonChallenges</b>
<span>@pChalTV</span>
<span>Aug 25, 2022</span>
</tweet-author>
<a href="https://twitter.com/pChalTV/status/1562906335125336067">View on Twitter</a>
</tweet-header>

Geoguessr players when they fly to Albania and theres no rift in the sky

![Tweet media](./assets/walter-white-falling.gif)

</static-tweet>

Apparently, for countries like Albania, <img class="country-flag" src="https://flagcdn.com/20x15/me.png" srcset="https://flagcdn.com/40x30/me.png 2x" width="20" height="15" alt="me" /> [Montenegro](https://en.wikipedia.org/wiki/Montenegro), and <img class="country-flag" src="https://flagcdn.com/20x15/sn.png" srcset="https://flagcdn.com/40x30/sn.png 2x" width="20" height="15" alt="sn" /> [Senegal](https://en.wikipedia.org/wiki/Senegal), there are camera imperfections in the Photo Sphere which result in creases in the sky:

![Various screenshots on geohints.com of rifts in the sky](./assets/16-rift.png)

We can see the rift itself in `16.png{:file}` in the top center of the image:

![Screenshot of the image imperfection in the center-top section of `16.png`](./assets/16-rift2.png)

Little meta tricks and trivia like these are what make GeoGuessr such an interesting game.

| Image            | Country                                                                                                                                                                   | Population                                                               | Flag    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png)   | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png)   | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png)   | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png)   | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png)   | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 (2021) / 18,145,568 (2023) | `e`/`E` |
| [`9.png{:file}`](#9png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco                                                                                               | 39,150 (2021)                                                                                      | `_`     |
| [`10.png{:file}`](#10png) | <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland                                                                                     | 8,789,726 (2022)                                                                              | `s`     |
| [`11.png{:file}`](#11png) | <img class="country-flag" src="https://flagcdn.com/20x15/pl.png" srcset="https://flagcdn.com/40x30/pl.png 2x" width="20" height="15" alt="pl" /> Poland                                                                                               | 37,796,000 (2022)                                                                                  | `P`     |
| [`12.png{:file}`](#12png) | <img class="country-flag" src="https://flagcdn.com/20x15/at.png" srcset="https://flagcdn.com/40x30/at.png 2x" width="20" height="15" alt="at" /> Austria                                                                                             | 9,090,868 (2022)                                                                                  | `a`     |
| [`13.png{:file}`](#13png) | <img class="country-flag" src="https://flagcdn.com/20x15/ca.png" srcset="https://flagcdn.com/40x30/ca.png 2x" width="20" height="15" alt="ca" /> Canada                                                                                               | 39,082,640 (2023)                                                                                  | `C`     |
| [`14.png{:file}`](#14png) | <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> Ecuador                                                                                             | 18,146,244 (2023)                                                                                 | `E`     |
| [`15.png{:file}`](#15png) | <img class="country-flag" src="https://flagcdn.com/20x15/by.png" srcset="https://flagcdn.com/40x30/by.png 2x" width="20" height="15" alt="by" /> Belarus                                                                                             | 9,349,645 (2021)                                                                                  | `b`     |
| [`16.png{:file}`](#16png) | <img class="country-flag" src="https://flagcdn.com/20x15/al.png" srcset="https://flagcdn.com/40x30/al.png 2x" width="20" height="15" alt="al" /> Albania                                                                                             | 2,829,741 ([2021](https://en.wikipedia.org/wiki/Demographics_of_Albania))                                                                                  | `a`     |

---

### `17.png{:file}`

![Image of dilapidated sheds and fences next to an ocean, with overcast skies](./assets/17.png)

To be honest, we didn't solve this one at all—we just completed the sentence "break me spacebar" and guessed the last character was either "R" or "r". Our original <img class="country-flag" src="https://flagcdn.com/20x15/kh.png" srcset="https://flagcdn.com/40x30/kh.png 2x" width="20" height="15" alt="kh" /> [Cambodia](https://en.wikipedia.org/wiki/Cambodia) guess didn't make any sense, anyways \:P

#### GeoGuessr meta: the Sakhalin plant

The author of the challenge revealed that the last location was <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia, on the large island of [Sakhalin](https://en.wikipedia.org/wiki/Sakhalin) north of <img class="country-flag" src="https://flagcdn.com/20x15/jp.png" srcset="https://flagcdn.com/40x30/jp.png 2x" width="20" height="15" alt="jp" /> [Japan](https://en.wikipedia.org/wiki/Japan):

![Screenshot of Google Maps with red circle around Sakhalin Island](./assets/17-map.png)

The intended method of identifying the location was to analyze this patch of particular foliage in the image:

![Zoomed in picture of butterbur in bottom-center of `17.png`](./assets/17-plant.png)

This plant is called [butterbur](https://en.wikipedia.org/wiki/Petasites_japonicus) (_Petasites japonicus_, or colloquially "The Sakhalin Plant"), and it's native to Sakhalin, Japan, <img class="country-flag" src="https://flagcdn.com/20x15/cn.png" srcset="https://flagcdn.com/40x30/cn.png 2x" width="20" height="15" alt="cn" /> [China](https://en.wikipedia.org/wiki/China), and <img class="country-flag" src="https://flagcdn.com/20x15/kp.png" srcset="https://flagcdn.com/40x30/kp.png 2x" width="20" height="15" alt="kp" />/<img class="country-flag" src="https://flagcdn.com/20x15/kr.png" srcset="https://flagcdn.com/40x30/kr.png 2x" width="20" height="15" alt="kr" /> [Korea](https://en.wikipedia.org/wiki/Korea). Apparently, GeoGuessr pros can instantly identify this particular area of Russia from this plant alone!

| Image            | Country                                                                                                                                                                   | Population                                                               | Flag    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| [`1.png{:file}`](#1png)   | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil                                                                                               | 215,652,035 (2023)                                                                                 | `B`     |
| [`2.png{:file}`](#2png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |
| [`3.png{:file}`](#3png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia                                                                                             | 1,331,796 (2022)                                                                                  | `e`     |
| [`4.png{:file}`](#4png)   | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia                                                                                         | 26,033,493 (2023)                                                                               | `A`     |
| [`5.png{:file}`](#5png)   | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> _Kazakhstan_                                                                                     | 19,392,112 (2023)                                                                              | `K`     |
| [`6.png{:file}`](#6png)   | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland                                                                                             | 385,230 (2022)                                                                                    | `_`     |
| [`7.png{:file}`](#7png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia                                                                                           | 3,477,605 (2023)                                                                                 | `m `    |
| [`8.png{:file}`](#8png)   | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> _El Salvador_ / <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> _Ecuador_ | 6,825,935 (2021) / 18,145,568 (2023) | `e`/`E` |
| [`9.png{:file}`](#9png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco                                                                                               | 39,150 (2021)                                                                                      | `_`     |
| [`10.png{:file}`](#10png) | <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland                                                                                     | 8,789,726 (2022)                                                                              | `s`     |
| [`11.png{:file}`](#11png) | <img class="country-flag" src="https://flagcdn.com/20x15/pl.png" srcset="https://flagcdn.com/40x30/pl.png 2x" width="20" height="15" alt="pl" /> Poland                                                                                               | 37,796,000 (2022)                                                                                  | `P`     |
| [`12.png{:file}`](#12png) | <img class="country-flag" src="https://flagcdn.com/20x15/at.png" srcset="https://flagcdn.com/40x30/at.png 2x" width="20" height="15" alt="at" /> Austria                                                                                             | 9,090,868 (2022)                                                                                  | `a`     |
| [`13.png{:file}`](#13png) | <img class="country-flag" src="https://flagcdn.com/20x15/ca.png" srcset="https://flagcdn.com/40x30/ca.png 2x" width="20" height="15" alt="ca" /> Canada                                                                                               | 39,082,640 (2023)                                                                                  | `C`     |
| [`14.png{:file}`](#14png) | <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> Ecuador                                                                                             | 18,146,244 (2023)                                                                                 | `E`     |
| [`15.png{:file}`](#15png) | <img class="country-flag" src="https://flagcdn.com/20x15/by.png" srcset="https://flagcdn.com/40x30/by.png 2x" width="20" height="15" alt="by" /> Belarus                                                                                             | 9,349,645 (2021)                                                                                  | `b`     |
| [`16.png{:file}`](#16png) | <img class="country-flag" src="https://flagcdn.com/20x15/al.png" srcset="https://flagcdn.com/40x30/al.png 2x" width="20" height="15" alt="al" /> Albania                                                                                             | 2,829,741 (2021)                                                                                  | `a`     |
| [`17.png{:file}`](#17png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia                                                                                               | 146,980,061 (2022)                                                                                 | `R`     |

---

## Afterword

With this, the entire flag is revealed, and was successfully submitted with a lowercase "e" for the eighth character (the country was actually <img class="country-flag" src="https://flagcdn.com/20x15/sz.png" srcset="https://flagcdn.com/40x30/sz.png 2x" width="20" height="15" alt="sz" /> [Eswatini](https://en.wikipedia.org/wiki/Eswatini)); the flag is `idek{BReAK_me_sPaCEbaR}`.

This challenge would have not been possible if the flag wasn't made up of recognizable English words. When we were approaching the end, we simply inferred that the last bit spelled "spacebar"—although we could have brute forced all 8 different capitalizations of "bar" ($2^3$) by the time we finished "sPaCE", we felt like doing so would have detracted from the fun of the challenge.

Overall, I didn't just learn more about [GEOINT](https://en.wikipedia.org/wiki/Geospatial_intelligence)-style challenges—I came to a greater understanding of how absolutely massive Earth is. I guess that's part of the fun in playing GeoGuessr!

Here is a final table of all the countries (and what I guessed incorrectly):

| Image            | Correct Country                                                                       | Population | Flag | Incorrect Guess                                                                       |
| ---------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| [`1.png{:file}`](#1png)   | <img class="country-flag" src="https://flagcdn.com/20x15/br.png" srcset="https://flagcdn.com/40x30/br.png 2x" width="20" height="15" alt="br" /> Brazil           | 215,652,035 (2023)                   | `B`  |                                                                                       |
| [`2.png{:file}`](#2png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia           | 146,980,061 (2022)                   | `R`  |                                                                                       |
| [`3.png{:file}`](#3png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ee.png" srcset="https://flagcdn.com/40x30/ee.png 2x" width="20" height="15" alt="ee" /> Estonia         | 1,331,796 (2022)                    | `e`  |                                                                                       |
| [`4.png{:file}`](#4png)   | <img class="country-flag" src="https://flagcdn.com/20x15/au.png" srcset="https://flagcdn.com/40x30/au.png 2x" width="20" height="15" alt="au" /> Australia     | 26,033,493 (2023)                 | `A`  |                                                                                       |
| [`5.png{:file}`](#5png)   | <img class="country-flag" src="https://flagcdn.com/20x15/ke.png" srcset="https://flagcdn.com/40x30/ke.png 2x" width="20" height="15" alt="ke" /> Kenya             | 47,564,296 ([2019](https://en.wikipedia.org/wiki/Demographics_of_Kenya))                     | `K`  | <img class="country-flag" src="https://flagcdn.com/20x15/kz.png" srcset="https://flagcdn.com/40x30/kz.png 2x" width="20" height="15" alt="kz" /> Kazakhstan   |
| [`6.png{:file}`](#6png)   | <img class="country-flag" src="https://flagcdn.com/20x15/is.png" srcset="https://flagcdn.com/40x30/is.png 2x" width="20" height="15" alt="is" /> Iceland         | 385,230 (2022)                      | `_`  |                                                                                       |
| [`7.png{:file}`](#7png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mn.png" srcset="https://flagcdn.com/40x30/mn.png 2x" width="20" height="15" alt="mn" /> Mongolia       | 3,477,605 (2023)                   | `m ` |                                                                                       |
| [`8.png{:file}`](#8png)   | <img class="country-flag" src="https://flagcdn.com/20x15/sz.png" srcset="https://flagcdn.com/40x30/sz.png 2x" width="20" height="15" alt="sz" /> Eswatini       | 1,202,000 ([2021](https://en.wikipedia.org/wiki/Demographics_of_Eswatini))                   | `e`  | <img class="country-flag" src="https://flagcdn.com/20x15/sv.png" srcset="https://flagcdn.com/40x30/sv.png 2x" width="20" height="15" alt="sv" /> El Salvador |
| [`9.png{:file}`](#9png)   | <img class="country-flag" src="https://flagcdn.com/20x15/mc.png" srcset="https://flagcdn.com/40x30/mc.png 2x" width="20" height="15" alt="mc" /> Monaco           | 39,150 (2021)                        | `_`  |                                                                                       |
| [`10.png{:file}`](#10png) | <img class="country-flag" src="https://flagcdn.com/20x15/ch.png" srcset="https://flagcdn.com/40x30/ch.png 2x" width="20" height="15" alt="ch" /> Switzerland | 8,789,726 (2022)                | `s`  |                                                                                       |
| [`11.png{:file}`](#11png) | <img class="country-flag" src="https://flagcdn.com/20x15/pl.png" srcset="https://flagcdn.com/40x30/pl.png 2x" width="20" height="15" alt="pl" /> Poland           | 37,796,000 (2022)                    | `P`  |                                                                                       |
| [`12.png{:file}`](#12png) | <img class="country-flag" src="https://flagcdn.com/20x15/at.png" srcset="https://flagcdn.com/40x30/at.png 2x" width="20" height="15" alt="at" /> Austria         | 9,090,868 (2022)                    | `a`  |                                                                                       |
| [`13.png{:file}`](#13png) | <img class="country-flag" src="https://flagcdn.com/20x15/ca.png" srcset="https://flagcdn.com/40x30/ca.png 2x" width="20" height="15" alt="ca" /> Canada           | 39,082,640 (2023)                    | `C`  |                                                                                       |
| [`14.png{:file}`](#14png) | <img class="country-flag" src="https://flagcdn.com/20x15/ec.png" srcset="https://flagcdn.com/40x30/ec.png 2x" width="20" height="15" alt="ec" /> Ecuador         | 18,146,244 (2023)                   | `E`  |                                                                                       |
| [`15.png{:file}`](#15png) | <img class="country-flag" src="https://flagcdn.com/20x15/bg.png" srcset="https://flagcdn.com/40x30/bg.png 2x" width="20" height="15" alt="bg" /> Bulgaria       | 6,520,314 ([2021](https://en.wikipedia.org/wiki/Demographics_of_Bulgaria))                   | `b`  | <img class="country-flag" src="https://flagcdn.com/20x15/by.png" srcset="https://flagcdn.com/40x30/by.png 2x" width="20" height="15" alt="by" /> Belarus         |
| [`16.png{:file}`](#16png) | <img class="country-flag" src="https://flagcdn.com/20x15/al.png" srcset="https://flagcdn.com/40x30/al.png 2x" width="20" height="15" alt="al" /> Albania         | 2,829,741 (2021)                    | `a`  |                                                                                       |
| [`17.png{:file}`](#17png) | <img class="country-flag" src="https://flagcdn.com/20x15/ru.png" srcset="https://flagcdn.com/40x30/ru.png 2x" width="20" height="15" alt="ru" /> Russia           | 146,980,061 (2022)                   | `R`  |                                                                                       |

### Resources

Here are some of the websites I used throughout the challenge-solving process:

- [GeoHints](https://geohints.com/) - Provides images and key characteristics of every covered country in Google Street View
- [GeoTips](https://geotips.net/) - Lots of meta stuff (e.g. camera quality, cars vs. trekkers, etc.)
- [r/geoguessr](https://www.reddit.com/r/geoguessr/) - Useful community diagrams and wiki
- [The Digital Labyrinth - GeoGuessr](https://somerandomstuff1.wordpress.com/2019/02/08/geoguessr-the-top-tips-tricks-and-techniques/) - An absolutely massive blog post with everything you need to know about the game and its tricks
- [World License Plates](http://www.worldlicenseplates.com/) - Scanned license plates of the majority of countries, including old and new designs
- [Google Lens](https://lens.google/) - A powerful image recognition tool which can identify objects, text, landmarks, foliage, you name it and provide similar images

<style>
challenge-info {
  --row-border: color-mix(in oklab, var(--muted-foreground) 30%, transparent);

  display: block;
  margin-block: 0 1em;
  padding: var(--space-xs) var(--space-s);
  border: 2px solid var(--border);
  font-size: var(--step--1);

  challenge-title {
    display: block;
    padding-block-end: var(--space-3xs);
    color: var(--foreground);
    font-weight: var(--font-weight-medium);
  }

  dl {
    display: flex;
    flex-direction: column;
    margin-block: 0;

    > div {
      display: flex;
      align-items: baseline;
      gap: var(--space-s);
      padding-block: var(--space-3xs);

      &:not(:last-child) {
        border-block-end: 1.5px solid var(--row-border);
      }
    }
  }

  dt {
    flex: 1;
    color: var(--muted-foreground);
    font-weight: var(--font-weight-medium);
  }

  dd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3xs);
    flex: 2;
    margin: 0;
    word-break: break-word;

    img {
      display: inline-block;
      margin: 0;
      border-radius: var(--radius-full);
      inline-size: 1em;
      block-size: 1em;
    }

    a {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    > p {
      margin-block: 0;
    }
  }

  > dl + p,
  > dl ~ * {
    margin-block: var(--space-2xs) 0;
  }
}

challenge-flag {
  word-break: break-all;
  filter: blur(4px);
  transition: filter 0.2s;
  user-select: all;

  &:hover {
    filter: none;
  }
}

static-tweet {
  display: block;
  margin-block: 0 1em;
  padding: var(--space-xs) var(--space-s);
  border: 2px solid var(--border);
  font-size: var(--step--1);

  tweet-header {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);

    > img {
      margin: 0;
      border-radius: var(--radius-full);
      inline-size: 2.5rem;
      block-size: 2.5rem;
    }

    > a {
      margin-inline-start: auto;
      align-self: flex-start;
      color: var(--muted-foreground);
    }
  }

  tweet-author {
    display: flex;
    flex-direction: column;
    line-height: var(--line-height-snug, 1.375);

    span {
      color: var(--muted-foreground);
    }
  }

  > p {
    margin-block: var(--space-2xs) 0;
  }

  > img,
  > video,
  > p > img {
    display: block;
    max-inline-size: 100%;
    margin-block: var(--space-2xs) 0;
  }
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  margin-block: var(--space-m);

  > * {
    min-width: 0;
  }

  :is(p, img, figure) {
    margin: 0;
  }

  .span-2 {
    grid-column: span 2;
  }
}

figcaption.caption,
.caption {
  text-align: center;
  color: var(--muted-foreground);
  font-size: var(--step--1);

  p {
    margin-block: 0.5rem 0;
    color: var(--muted-foreground);
  }
}

.tight {
  :is(p, img) {
    margin-block: 0;
  }
}

.button-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: fit-content;
  margin-inline: auto;

  @media (min-width: 640px) {
    flex-direction: row;
  }
}

img.country-flag {
  display: inline;
  margin: 0;
  vertical-align: middle;
}
</style>
