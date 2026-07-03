# BRASA — Cozinha de Fogo

Landing page de um restaurante autoral de fogo vivo em São Paulo: cortes maturados
sobre brasa de lenha, cardápio à la carte, sommelier embutido e reservas.

Site estático (HTML + CSS + JS), sem build. Hero cinematográfico com sequência de
frames dirigida por scroll (GSAP ScrollTrigger + Lenis), scroll suave e i18n PT/EN.

## Rodar localmente
Abra `index.html` no navegador, ou sirva a pasta:

    python -m http.server 8000
    # http://localhost:8000

## Estrutura
- `index.html` — marcação e conteúdo
- `css/styles.css` — sistema de design (Fraunces + Hanken, paleta cobre/fumaça)
- `js/main.js` — hero scroll cinema, reveals, sommelier, reservas, i18n
- `assets/` — imagens (WebP/JPG), `hero-brasa.mp4` e a sequência de frames

Tipografia: Fraunces + Hanken Grotesk (Google Fonts). Scroll: Lenis + GSAP.
