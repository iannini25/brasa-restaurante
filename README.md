# BRASA — Hero Section (cozinha de fogo)

Hero cinematográfico com **scroll sincronizado**: à medida que o usuário rola, a
câmera mergulha no prato até um close, o texto da esquerda recua e a legenda do
prato se revela no canto inferior direito. O vídeo (gerado no Higgsfield a partir
da sua foto) é "scrubado" pelo scroll — frame a frame, na velocidade do dedo.

> Arquitetura **resiliente**: tudo funciona apenas com a foto (poster). O vídeo
> (`assets/hero-brasa.mp4`, já gerado e ligado) é a camada de *upgrade* — o mergulho
> ganha vapor subindo e o chef em câmera lenta. Sem vídeo — ou em servidor sem suporte
> a *HTTP Range* — o mesmo zoom roda sobre a imagem estática, sem quebrar.

---

## 🗂 Estrutura

```
brasa-hero/
├── index.html              # marcação semântica + SEO + schema Restaurant
├── css/
│   └── styles.css          # design system (cobre/creme/preto-fumaça) + layout + responsivo
├── js/
│   └── main.js             # GSAP ScrollTrigger + Lenis · scrub de vídeo · zoom · nav
├── assets/
│   ├── hero-poster.jpg/.webp        # poster do hero (LCP) — desktop, com WebP
│   ├── hero-poster-mobile.jpg/.webp # poster leve p/ telas pequenas (<picture>)
│   ├── casa-brasa.jpg               # seção "A Casa"
│   ├── harmonizacao.jpg             # acento de harmonização
│   ├── hero-brasa.mp4               # vídeo do Higgsfield (otimizado p/ scrub) ✓ incluído
│   └── favicon.svg
├── .gitignore
├── README.md · HIGGSFIELD_VIDEO.md · CLAUDE_CODE_PROMPT.md
```

## ⚡ Performance & qualidade

- **LCP**: poster como WebP responsivo (`<picture>` + `preload` com `fetchpriority`);
  telas pequenas baixam ~54 KB em vez de ~430 KB.
- **Sem bloquear o render**: fontes Google carregam de forma assíncrona; GSAP/Lenis com
  `defer` + `preconnect`.
- **Acessibilidade (WCAG 2.1 AA)**: foco visível, navegação por teclado com foco preso nos
  overlays, `Esc` fecha menus/sommelier, `aria-live` nos status, contraste AA, `prefers-reduced-motion`.
- **Lighthouse (mobile)**: Acessibilidade **100**, SEO **100**, Práticas recomendadas **100**
  (em HTTPS), Performance dominada por compressão/HTTP-2 do host — sirva com gzip/brotli.
- **Zero overflow horizontal** (360 → 1920) e **zero erros de console**.

---

## ▶️ Como rodar

As CDNs (GSAP/Lenis) e o `<video>` pedem um servidor HTTP — **não** abra via
`file://`.

> ⚠️ **Para ver o scrub do vídeo, use um servidor com suporte a *HTTP Range*.** O scrub
> dá *seek* no vídeo a cada frame e isso exige respostas `206 Partial Content`. O
> `python -m http.server` **não** suporta Range (o vídeo carrega mas fica congelado no
> 1º frame — o zoom ainda roda). Use um destes:

- **VS Code Live Server** (extensão) → clique direito no `index.html` → "Open with Live
  Server" — **recomendado**, suporta Range. **ou**
- Terminal (qualquer um suporta Range):
  ```bash
  cd brasa-hero
  npx serve -l 5173          # ou: npx http-server -p 5173
  # abra http://localhost:5173
  ```
- `python -m http.server 5173` serve tudo **menos** o scrub do vídeo — ok para conferir
  layout/seções, não para o vídeo. Em produção (Vercel/Netlify/nginx) o Range é nativo.

Detalhes e checagem do Range em **`HIGGSFIELD_VIDEO.md`**.

---

## 🎬 Vídeo do Higgsfield — já incluído ✓

O vídeo **já foi gerado, otimizado e ligado**: `assets/hero-brasa.mp4` (Kling v3.0, 16:9,
~10s, sem áudio), re-encodado *all-keyframe* + `faststart` para *scrub* preciso, com
`CONFIG.video.enabled = true`. Não há nada a plugar — só servir por um host com Range
(seção **Como rodar** acima) e rolar a hero.

Para **trocar o vídeo** depois, o passo a passo (prompt, comando ffmpeg exato e por que
WebM foi descartado) está em **`HIGGSFIELD_VIDEO.md`**. Resumo do que foi feito:

```bash
# todo frame vira keyframe (-g 1) = seek instantâneo; +faststart = começa a tocar sem baixar tudo
ffmpeg -i hero-source.mp4 -an -c:v libx264 -profile:v high -preset slow -crf 23 \
  -g 1 -keyint_min 1 -sc_threshold 0 -pix_fmt yuv420p -movflags +faststart \
  assets/hero-brasa.mp4
```

---

## 🎛 Ajuste fino (sem tocar na lógica)

No topo de `js/main.js`, o objeto **`HERO`** controla o enquadramento:

| chave | o que faz |
|---|---|
| `zoomScale` | o quão perto a câmera chega da comida |
| `originX` / `originY` | ponto focal do zoom (já calibrado p/ a comida cair no canto inf. direito) |
| `driftX` / `driftY` | micro-ajuste de enquadramento |
| `contentOut` | em que ponto (0–1) o texto da esquerda some |
| `dishIn` | em que ponto a legenda do prato aparece |
| `scrollLength` | quanto dura o mergulho (distância de scroll) |

Para calibrar visualmente, troque `DEBUG.markers = true` (mostra os marcadores do
ScrollTrigger).

---

## ✅ Já vem de fábrica

- **Mobile-first** e responsivo (nav vira overlay; zoom mais leve sem *pin* p/
  evitar travadas no iOS).
- **Acessibilidade**: `skip-link`, foco visível, `prefers-reduced-motion`
  (cena estática), navegação por teclado, `alt`/`aria` corretos.
- **Performance**: poster como LCP pré-carregado, vídeo só no desktop, animações
  só em `transform`/`opacity` (GPU).
- **SEO**: meta tags, Open Graph, `lang=pt-BR` e **dados estruturados** de
  restaurante (aparece melhor em buscas).

---

## 🧱 Fase 2 — entregue

Seções completas, na mesma linguagem visual da hero, com reveals suaves
(IntersectionObserver, degradação graciosa) e responsivas (testadas 360 → 1920):

- **A Casa** — filosofia do fogo (editorial + imagem + princípios).
- **Menu** — degustação em 6 tempos (sequência numerada) + à la carte, com marcador
  de harmonização. Sem tabela: tipografia + fios de cobre.
- **A Experiência** — chef's table em 3 pilares editoriais + faixa full-bleed.
- **Reservas** — formulário acessível (validação JS, `aria-live`, estados de
  sucesso/erro) + **atalho WhatsApp** com mensagem pré-preenchida.
- **Contato + rodapé** — endereço/horário/contato, mapa lazy, JSON-LD coerente.

Camada de IA / automação (stubs prontos p/ produção, **sem segredos no front**):

- **WhatsApp** — `buildWhatsAppReservation(data)` monta o deep-link `wa.me`
  (número em `CONFIG.whatsapp`).
- **Sommelier virtual** — widget flutuante (aparece só depois da hero) com
  harmonizações mockadas; `askSommelierAPI()` já tem o ponto de plugar um
  **backend/proxy → Anthropic `/v1/messages`** (`CONFIG.anthropic`, modelo
  `claude-sonnet-4-6`). **Nunca** coloque a API key no cliente.
- **i18n pt/en** — toggle no nav. PT é a fonte (capturada do DOM); EN é esqueleto
  (chaves ausentes caem no PT). Objeto `I18N.en` em `js/main.js`.

> Configuração rápida vive no topo de `js/main.js`: `CONFIG.whatsapp`,
> `CONFIG.anthropic`, `CONFIG.video.enabled`, e o objeto `HERO` (calibração do mergulho:
> `zoomScale 2.35`, `originX 28`, `originY 80`). Calibre com `?markers=1` ou
> `?zoom=&ox=&oy=` na URL.
