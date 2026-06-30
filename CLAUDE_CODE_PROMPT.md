# PROMPT PARA O CLAUDE CODE — Projeto BRASA (Ultra Code Mode)

> Cole **todo** o conteúdo abaixo no Claude Code, com a pasta `brasa-hero/` já aberta no VS Code.
> Ele assume que os arquivos `index.html`, `css/styles.css`, `js/main.js`, `assets/` e `README.md` já existem (a hero section já está construída e funcional). Sua missão é **plugar o vídeo, calibrar, expandir e lapidar**.

---

## CONTEXTO DO PROJETO

`brasa-hero/` é o site de um restaurante autoral premium fictício chamado **BRASA** — "cozinha de fogo". Foco em fogo vivo / brasa / lenha, alta gastronomia, prato-assinatura (magret de pato com purê defumado, redução de vinho, flores comestíveis).

A **hero section** já está pronta: vanilla HTML/CSS/JS + GSAP 3.12.5 + ScrollTrigger + Lenis (todos via CDN). O efeito-assinatura é um **mergulho cinematográfico sincronizado ao scroll**: conforme o usuário rola, a cena dá um *push-in* (zoom) até um close no prato, que termina enquadrado no **canto inferior direito**; a headline some, e uma legenda do prato é revelada. Tudo funciona **apenas com o poster** (`assets/hero-poster.jpg`); o vídeo é uma camada de upgrade que roda em scrub (seek por scroll).

Paleta (já em `:root`): ink `#0B0A09`, cream `#F4ECDD`, copper `#C57B3C`, copper-lit `#E0A45E`, gold `#E0B36A`.
Tipografia (já carregada): **Cormorant Garamond** (display/serifa) + **Hanken Grotesk** (UI/sans).
Idioma de todo o conteúdo: **português (pt-BR)**.

**Princípios inegociáveis:**
- Mobile-first e acessível (WCAG 2.1 AA): foco visível, navegação por teclado, `prefers-reduced-motion`, contraste, labels/aria.
- Performance: a hero é o LCP. Não regredir Lighthouse. Lazy-load do que estiver below-the-fold.
- Nada de "cara de template de IA": respeitar a tipografia, o ritmo e a paleta já definidos. Sem gradientes roxo-genéricos, sem emojis na UI, sem glassmorphism padrão.
- Não quebrar o que já funciona. Cada mudança deve degradar com elegância se o GSAP/Lenis/vídeo falhar.

---

## TAREFA 1 — Plugar e otimizar o vídeo do Higgsfield (PRIORITÁRIO)

O vídeo cinematográfico é gerado no **Higgsfield (modelo Kling v3.0)** a partir da imagem original do prato. Ele chega como `.mp4` 16:9.

1. Pegue o arquivo de vídeo que o usuário baixou do Higgsfield (ele vai colocá-lo na raiz do projeto, ex.: `hero-source.mp4`).
2. **Otimize-o para scrubbing suave** (seek frame-a-frame). O segredo é forçar GOP curto (idealmente todo frame como keyframe) e `faststart`. Rode no terminal:

   ```bash
   ffmpeg -i hero-source.mp4 \
     -an \
     -vf "scale=1920:-2:flags=lanczos,format=yuv420p" \
     -c:v libx264 -profile:v high -preset slow -crf 20 \
     -g 1 -keyint_min 1 -sc_threshold 0 \
     -movflags +faststart \
     assets/hero-brasa.mp4
   ```

   - `-g 1 -keyint_min 1 -sc_threshold 0`: todo frame vira keyframe → `currentTime` no scroll fica preciso e fluido (sem "engasgo" entre keyframes). Esse é o detalhe que faz ou quebra o scrub.
   - `-an`: remove áudio (não toca em scrub).
   - Se o arquivo ficar pesado (> ~8 MB), suba o `-crf` para 22–24, ou reduza para `scale=1600:-2`.

3. (Opcional, recomendado) Gere também um **WebM** menor como fonte primária, com MP4 de fallback:

   ```bash
   ffmpeg -i hero-source.mp4 -an \
     -vf "scale=1920:-2:flags=lanczos,format=yuv420p" \
     -c:v libvpx-vp9 -crf 32 -b:v 0 -g 1 -keyint_min 1 \
     assets/hero-brasa.webm
   ```

   Se gerar o WebM, ajuste o `<video>` em `index.html` para ter as duas `<source data-src="...">` (WebM primeiro, MP4 depois). O `js/main.js` já lê `data-src` e seta a fonte — confira `initVideo()` e adapte para múltiplas sources se necessário.

4. Confirme que o vídeo aparece: sirva o projeto por HTTP (**não** abra via `file://`):

   ```bash
   python3 -m http.server 5173    # depois abra http://localhost:5173
   ```

   A classe `.is-video-ready` deve entrar (vídeo cobre o poster) e o scrub deve seguir o scroll no desktop.

**Critério de aceite T1:** ao rolar a hero no desktop, o vídeo avança/retrocede junto com o scroll, sem travar; em mobile e com `prefers-reduced-motion`, o vídeo é ignorado e o poster aparece estático.

---

## TAREFA 2 — Calibrar o mergulho (GSAP/ScrollTrigger)

Os "botões de ajuste" da animação ficam no objeto **`HERO`** no topo de `js/main.js`. O alvo: a comida (que na imagem está por volta de **46% da largura, 80% da altura**) precisa terminar no **canto inferior direito** no fim do scroll.

- `zoomScale` (atual ~2.45): o quão perto chega o close.
- `originX` / `originY` (atual 32 / 80): o `transform-origin` do zoom, em %. Origem **à esquerda** do prato empurra a comida para a direita conforme amplia. Se a comida estiver terminando muito ao centro, **diminua `originX`**; se passar do canto, aumente.
- `driftX` / `driftY`: deslocamento fino opcional (px) caso precise reposicionar sem mexer no foco do zoom.
- `contentOut` (0.40): fração do scroll em que a headline termina de sumir.
- `dishIn` (0.66): fração em que a legenda do prato começa a aparecer.
- `scrub` (0.6): suavidade do acoplamento ao scroll.

Para calibrar visualmente, ligue os marcadores: em `js/main.js`, set `DEBUG.markers = true`. Ajuste `originX/originY/zoomScale`, recarregue, repita. **Desligue os marcadores ao terminar.**

Teste em 1440px, 1280px e ultrawide. O enquadramento final deve manter a comida nítida e inteira no quadrante inferior-direito, com a legenda legível ao lado/acima dela.

**Critério de aceite T2:** no fim do scroll da hero, em desktop, o prato está cravado no canto inferior direito, nítido, com a legenda revelada; a transição é suave em todas as larguras testadas.

---

## TAREFA 3 — Construir as seções da Fase 2

A nav vertical da direita já lista: **Início · A Casa · Menu · Experiência · Reservas · Contato**. Hoje só existe um stub `#casa`. Construa as seções abaixo como `<section id="...">` na mesma linguagem visual (mesmos tokens, mesma tipografia, mesmo ritmo de respiro). Anime entradas com ScrollTrigger (reveal suave, sem exagero). Mantenha tudo responsivo e acessível.

1. **A Casa** (`#casa`) — A filosofia do fogo.
   Texto sobre cozinhar sobre brasas vivas, brasa como ingrediente, fogo controlado, produto nacional, sazonalidade. Layout editorial: uma coluna de texto forte + um detalhe visual (pode reusar `hero-poster` recortado ou um bloco tipográfico grande). Headline curta em Cormorant; corpo em Hanken.

2. **Menu** (`#menu`) — Degustação & à la carte.
   Apresente um **menu-degustação em tempos** (ex.: "Menu Brasa — 6 tempos") e alguns destaques à la carte. Estruture em uma lista elegante (nome do prato em serifa, descrição curta em sans, sem preços gritantes — sugira preço discreto ou "sob consulta"). Não usar tabela crua; usar tipografia e linhas finas cor de cobre como separadores. Inclua um marcador de harmonização opcional (taça/vinho).

3. **A Experiência** (`#experiencia`) — Chef's table & harmonização.
   Conte a experiência: balcão de chef (chef's table) de frente para a brasa, menu harmonizado com a carta de vinhos, número limitado de lugares por noite. Pode ser um bloco com 2–3 "pilares" (Brasa viva · Harmonização autoral · Mesa do chef) — mas **sem virar card genérico**: trate como editorial, com numeração e tipografia, não como caixinhas com sombra.

4. **Reservas** (`#reservas`) — Formulário + atalho WhatsApp.
   Formulário acessível: nome, data, horário, nº de pessoas, observações. **Não** usar `<form>` que dê reload sem tratamento — faça submit via JS com validação e estado de sucesso/erro (mensagens em pt-BR, com `aria-live`). Inclua um botão/atalho destacado **"Reservar pelo WhatsApp"** que abre `https://wa.me/<numero>?text=<mensagem pré-preenchida>` com os dados do formulário (ver Tarefa 4). Deixe o número como placeholder/config no topo do JS.

5. **Contato** (`#contato`) + **rodapé**.
   Endereço, horário de funcionamento, telefone/WhatsApp, e-mail, redes (Instagram). Mapa opcional (embed lazy). Rodapé com a marca BRASA, navegação secundária, créditos e selo "cozinha de fogo". Inclua microdados/atualize o JSON-LD `Restaurant` já presente no `<head>` com endereço/horário coerentes.

**Critério de aceite T3:** as 5 seções existem, são navegáveis pela nav (com link ativo seguindo o scroll — a lógica já está em `initNav()`), entram com animação suave, são responsivas (testar 375px, 768px, 1440px) e acessíveis.

---

## TAREFA 4 — Camada de IA / automação (stubs prontos para produção)

Implemente como **stubs limpos e desacoplados** (config no topo, fáceis de ligar a um backend depois). Não exponha segredos no front.

1. **Assistente de reservas no WhatsApp** — o botão da Tarefa 3 monta o deep-link `wa.me` com a mensagem pré-preenchida a partir do formulário (nome, data, horário, pessoas). Estruture a função `buildWhatsAppReservation(data)` isolada e testável.

2. **Sommelier virtual (chat de harmonização)** — um widget discreto (botão flutuante cobre, canto inferior, que **não** atrapalhe o efeito da hero) que abre um chat sugerindo harmonização de vinhos por prato. Deixe pronto para plugar na API da Anthropic (endpoint `/v1/messages`, modelo `claude-sonnet-4-6`). **Não** coloque API key no front — comente claramente que a chamada deve passar por um backend/proxy. Por ora, responda com sugestões mockadas a partir de um pequeno dicionário prato→harmonização.

3. **Menu multilíngue (pt/en)** — toggle de idioma no nav que troca os textos do menu (estrutura i18n simples: objeto `pt`/`en`). Deixe só pt preenchido e en como esqueleto.

**Critério de aceite T4:** botões/widgets existem, funcionam com dados mockados, estão isolados em funções claras, com TODOs marcando onde o backend entra. Nenhuma chave secreta no cliente.

---

## TAREFA 5 — Polimento final

- **Micro-interações:** hover dos botões (já há lift/glow no primário — refine), underline animado nos links da nav, cursor/realce sutil. Sem exageros.
- **Performance:** rode Lighthouse (mobile). Alvo: Performance ≥ 90, Acessibilidade ≥ 95, Best Practices e SEO ≥ 95. Lazy-load de imagens below-the-fold, `loading="lazy"`, `decoding="async"`. Garanta que o vídeo só carrega no desktop (a lógica já existe — confirme).
- **Acessibilidade:** revise ordem de foco, `:focus-visible`, `aria-label` em ícones, alt text descritivo, contraste AA, skip-link funcionando, teste com teclado e leitor de tela.
- **SEO:** revise `<title>`, meta description, Open Graph/Twitter, e o JSON-LD `Restaurant` (nome, endereço, horários, faixa de preço, servesCuisine).
- **Responsivo:** valide 360px → ultrawide. Sem overflow horizontal. A nav-overlay mobile (hambúrguer) já existe — confirme o comportamento.
- **Cross-browser:** Chrome, Firefox, Safari (atenção a `object-fit`/vídeo no Safari).
- Crie/atualize um `.gitignore` (ex.: `hero-source.mp4`, `node_modules/`, `.DS_Store`).

**Critério de aceite T5:** Lighthouse nas metas, zero erros de console, sem overflow horizontal em nenhuma largura, navegação 100% por teclado, e o efeito-assinatura da hero permanece fluido após todas as adições.

---

## REGRAS DE OURO (não desviar)
1. **Não quebrar a hero.** Ela é o coração do projeto. Teste-a depois de cada bloco.
2. **Degradação graciosa sempre:** se GSAP/Lenis/vídeo falharem, o conteúdo continua visível e utilizável.
3. **Servir por HTTP** ao testar; nunca `file://`.
4. **Manter a identidade** (tokens, fontes, paleta, ritmo). Quando em dúvida, faça menos e mais refinado.
5. Conteúdo em **pt-BR**, tom premium, sem clichê de marketing barato.

Comece pela **Tarefa 1**, confirme o vídeo rodando em scrub, e só então avance. Reporte o que calibrou (valores de `HERO`) ao final.
