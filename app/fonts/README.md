# Fonts

The app's three typefaces. They are kept here so builds don't download them from Google Fonts (#116). `app/layout.tsx` loads them with `next/font/local`.

| File | Typeface | Version |
|---|---|---|
| `figtree.woff2` | Figtree, variable weight | 2.002 |
| `barlow-semi-condensed-600.woff2`, `-700`, `-800` | Barlow Semi Condensed SemiBold, Bold, ExtraBold | 1.408 |
| `jetbrains-mono.woff2` | JetBrains Mono, variable weight | 2.211 |

Each file is cut from the master in [google/fonts](https://github.com/google/fonts) (`ofl/figtree`, `ofl/barlowsemicondensed`, `ofl/jetbrainsmono`) the way Google Fonts serves it:
- the characters of the family's Google subsets;
- the OpenType features Google keeps;
- no hinting;
- JetBrains Mono's weight axis limited to 400–800.

So the glyphs, spacing and line heights are the ones the app had from Google. Google splits each family into a file per subset; here each family is one file.

All three are under the SIL Open Font License 1.1, in the `*-OFL.txt` files.

## Rebuilding

Run this in a directory holding the five masters (`Figtree[wght].ttf`, `BarlowSemiCondensed-SemiBold.ttf`, `-Bold.ttf`, `-ExtraBold.ttf` and `JetBrainsMono[wght].ttf`), then copy the `.woff2` files here.

```sh
LATIN=U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD
LATIN_EXT=U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF
VIETNAMESE=U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB
GREEK=U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF
CYRILLIC=U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116
CYRILLIC_EXT=U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F
fonttools() { uvx -q --from 'fonttools[woff]==4.55.0' "$@"; }
subset() { fonttools pyftsubset "$@" --no-hinting '--name-IDs=*' --flavor=woff2; }

subset 'Figtree[wght].ttf' --unicodes=$LATIN,$LATIN_EXT \
  --layout-features=ccmp,dnom,frac,locl,numr,pnum,rvrn,tnum,kern,mark,mkmk --output-file=figtree.woff2
for w in 600:SemiBold 700:Bold 800:ExtraBold; do
  subset "BarlowSemiCondensed-${w#*:}.ttf" --unicodes=$LATIN,$LATIN_EXT,$VIETNAMESE \
    --layout-features=ccmp,dnom,frac,liga,locl,numr,pnum,tnum,kern,mark,mkmk --output-file="barlow-semi-condensed-${w%%:*}.woff2"
done
fonttools fonttools varLib.instancer 'JetBrainsMono[wght].ttf' wght=400:800 -o jetbrains-mono-400-800.ttf
subset jetbrains-mono-400-800.ttf --unicodes=$LATIN,$LATIN_EXT,$VIETNAMESE,$GREEK,$CYRILLIC,$CYRILLIC_EXT \
  --layout-features=calt,ccmp,frac,locl,mark --output-file=jetbrains-mono.woff2
```
