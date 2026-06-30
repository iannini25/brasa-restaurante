# Vídeo da Hero — Higgsfield (Kling v3.0)

O vídeo cinematográfico da hero foi gerado no **Higgsfield** a partir da sua imagem original
do prato, otimizado para *scrub* e **já está plugado e ligado** no site. Este arquivo guarda a
"receita" exata — para você regenerar/ajustar quando quiser.

> **Status atual:** ✅ vídeo **gerado, otimizado e ativo**.
> `assets/hero-brasa.mp4` (1280×714, ~7,2 MB, todo-keyframe, sem áudio) está no projeto e
> `CONFIG.video.enabled = true` em `js/main.js`. No desktop o vídeo cobre o poster e é
> "scrubado" pelo scroll; em mobile e com `prefers-reduced-motion` ele é ignorado de
> propósito (roda o zoom sobre o poster estático).

## ⚠️ Pré-requisito do scrub: servidor com suporte a *HTTP Range*

O efeito de arrastar o vídeo pelo scroll depende de o servidor responder a *range requests*
(`206 Partial Content` + `Accept-Ranges: bytes`). Sem isso o navegador não consegue dar
*seek* e o vídeo fica **congelado no primeiro frame** (o zoom ainda roda — degradação graciosa,
mas sem o vapor/empurrão de câmera).

- ❌ **`python -m http.server` NÃO suporta Range** — responde `200` e ignora o cabeçalho.
  Com ele o vídeo carrega mas **não faz scrub**. Bom para testar layout, ruim para testar o vídeo.
- ✅ **Suportam Range** (use um destes p/ ver o scrub): **VS Code Live Server**, `npx serve`,
  `npx http-server`, nginx, e **qualquer host real** (Vercel, Netlify, Cloudflare, GitHub Pages…).

```bash
npx serve -l 5173      # ou: clique direito no index.html → "Open with Live Server"
# abra http://localhost:5173 e role a hero — o vídeo avança frame a frame
```

> Como confirmar rápido se o seu servidor suporta Range:
> ```bash
> curl -s -D - -o /dev/null -H "Range: bytes=0-100" http://localhost:5173/assets/hero-brasa.mp4 | grep -i "HTTP/\|accept-ranges"
> # deve aparecer: HTTP/1.1 206 Partial Content  +  Accept-Ranges: bytes
> ```

## O que foi gerado
- **Modelo:** Kling v3.0 (`kling3_0`) — cinemático, boa física de fumaça/fogo, 16:9.
- **Proporção:** 16:9 · **Duração:** ~10s · **Áudio:** desligado.
- **Imagem de origem:** o seu próprio render do prato (magret de pato), usado como *start_image*.
- **Job id:** `a8566753-0d2b-441e-9361-276c62cdbdfb`

### Prompt usado (para regenerar/ajustar)
```
Cinematic slow-motion scene in a dark, moody gourmet restaurant kitchen. Foreground hero:
a sophisticated plated dish — seared duck magret with smooth purée, edible pansy flowers,
blackberries and a glossy red wine reduction — with delicate steam rising slowly from the hot
plate. Behind, slightly out of focus, a chef in black plates another dish in slow motion under
warm copper heat lamps; a live wood-fire grill glows in the background. Hanging copper pots,
warm ambient lighting, shallow depth of field, photoreal fine-dining atmosphere. Very slow,
subtle camera push-in toward the dish. Gentle realistic steam, soft flickering fire light.
No text, no logos. Preserve the original photograph's composition, colors and lighting.
```

> Dica: para um scrub ainda mais suave, gere com duração maior (ex.: 10–15s). Quanto mais
> frames, mais "líquido" fica o avanço do vídeo conforme o scroll.

## Como regenerar e re-otimizar (caso troque o vídeo)

1. **Baixe** o novo MP4 do Higgsfield e salve como `hero-source.mp4` na raiz do projeto
   (esse nome está no `.gitignore` — o source não vai pro repositório).

2. **Otimize para scrubbing** — *todo frame vira keyframe* (`-g 1`), o que permite *seek*
   preciso em qualquer ponto, mais `+faststart` (move o índice `moov` pro início do arquivo,
   pra começar a tocar sem baixar tudo). Foi exatamente este o comando usado:

   ```bash
   ffmpeg -i hero-source.mp4 \
     -an \
     -c:v libx264 -profile:v high -preset slow -crf 23 \
     -g 1 -keyint_min 1 -sc_threshold 0 \
     -pix_fmt yuv420p -movflags +faststart \
     assets/hero-brasa.mp4
   ```

   - O all-keyframe deixa o arquivo **maior** que um MP4 normal (~7 MB para 10s a 1280×714) —
     é o preço do *seek* instantâneo. Se quiser menor, suba `-crf` para 24–26 ou reduza a
     resolução com `-vf "scale=1280:-2:flags=lanczos"`.
   - **WebM foi testado e descartado:** o VP9 all-keyframe (`crf 34`) ficou ~13,7 MB, quase o
     dobro do MP4. Por isso o `<video>` traz **só** a `<source>` MP4. Se um dia o WebM compensar,
     reative a linha no `index.html` e o `initVideo()` já cuida das duas fontes.

3. **Já está ligado.** `CONFIG.video.enabled = true` em `js/main.js`. Se algum dia quiser
   voltar a rodar só com poster (ex.: enquanto re-encoda), mude para `false`.

4. **Sirva por um servidor com Range** (veja a seção ⚠️ acima) e confira: a classe
   `.is-video-ready` entra, o vídeo cobre o poster e o `currentTime` segue o scroll.

## Importante
- **O site nunca quebra sem o vídeo.** O poster real (`assets/hero-poster.jpg`) é o fallback e o
  efeito de aproximação (zoom) roda via CSS/GSAP de qualquer forma — inclusive em servidor sem
  Range, onde o vídeo fica no frame 0.
- Em **mobile** e com **`prefers-reduced-motion`**, o vídeo é ignorado de propósito (performance/UX).
- O `js/main.js` lê o caminho do vídeo via `data-src` no `<source>` dentro do `<video>` em
  `index.html`. Se trocar o nome/*codec*, ajuste lá.
