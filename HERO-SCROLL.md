# Hero scroll — como funciona agora (frames no canvas)

A hero **não usa mais `<video>`**. Ela toca uma **sequência de frames JPEG** (`assets/frames/`)
num `<canvas>`, exatamente como o guia `guia-sites-scroll.md` (técnica C — Logitech/Iron Man).

## Por que estava travando (e o que mudou)
- **Antes:** os frames estavam em **WebP**. `ctx.drawImage()` força um **decode síncrono** do WebP
  na thread principal a cada frame novo. WebP decodifica devagar → durante o scroll a thread
  engasgava e a imagem ficava **segundos atrás** do scroll ("delay absurdo").
- **Agora:** frames em **JPEG** (decodifica ~3–5× mais rápido) + um **loop `requestAnimationFrame`**
  que persegue o frame-alvo e desenha, **desacoplado** do scroll. O scroll só atualiza o alvo;
  quem desenha é o loop. Um decode lento nunca trava a rolagem, e o easing dá o movimento "manteiga".
- **Sem zoom de tela:** o "mergulho" é o próprio push-in do vídeo de origem, frame a frame. Não há
  mais `scale` na camada (era um zoom duplo, redundante).

## Os botões de ajuste (em `js/main.js`, objeto `HERO`)
- `ease` (**0.22**): o quão "colado" no scroll a imagem fica. **Menor** (0.15) = mais suave/cinematográfico;
  **maior** (0.3) = mais grudado/responsivo. É o principal regulador da sensação.
- `lerp` (**0.1**): suavização do scroll (Lenis). Menor = mais "glide"; maior = mais direto.
- `scrollLength` (**+=220%**): quanto de rolagem dura a reprodução (o "pin"). Maior = passa mais devagar.
- `frameCount` (**241**): tem que bater com `ls assets/frames | wc -l`.

Dá pra calibrar ao vivo pela URL, sem editar nada:
`?ease=0.18&lerp=0.12&len=+=260%&markers` (o `markers` mostra os marcadores do ScrollTrigger).

## Rodar localmente
Sirva por HTTP (nunca `file://`):
```bash
python3 -m http.server 5173   # abra http://localhost:5173
```
O pôster aparece na hora; uma barra fininha de progresso enche enquanto os 241 frames carregam;
quando prontos, o canvas faz fade-in e o scroll passa/volta o vídeo, liso.

## Regerar os frames (se trocar o vídeo)
Os frames saem de `assets/hero-brasa.mp4` (vídeo all-keyframe, otimizado). Para reextrair em alta
qualidade, no tamanho nativo (1280px), mantendo a contagem:
```bash
rm -f assets/frames/*.jpg
ffmpeg -y -i assets/hero-brasa.mp4 -fps_mode passthrough -qscale:v 3 assets/frames/f_%03d.jpg
ls assets/frames/*.jpg | wc -l     # ajuste HERO.frameCount p/ esse número
```
- `qscale:v 3` = qualidade alta (2 = quase sem perda e mais pesado; 4–5 = mais leve). Conjunto atual: ~18MB.
- Mantenha a nomenclatura `f_001.jpg`, `f_002.jpg`…

## Mobile / acessibilidade
No mobile (≤860px) e com `prefers-reduced-motion`, a hero é o **pôster estático** (sem canvas, sem pin,
sem zoom) — performance e conforto. Nada de frames é baixado fora do desktop.
