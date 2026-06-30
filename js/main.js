/* =========================================================================
   BRASA — Hero scroll cinema + Fase 2 (seções, reservas, sommelier, i18n)
   GSAP ScrollTrigger + Lenis. A câmera mergulha no prato à medida que o
   usuário rola; o vídeo (Higgsfield, all-keyframe) vira uma SEQUÊNCIA DE
   FRAMES desenhada num <canvas> a 60fps — sem latência de seek de vídeo.
   Tudo degrada com elegância: sem frames → usa o poster; reduced-motion →
   cena estática; sem GSAP/JS → conteúdo todo visível e navegável.
   ========================================================================= */

/* ----------------------------------------------------------------- CONFIG HERO
   O "zoom" já é o push-in do próprio vídeo de origem — não há scale de tela.
   Use os marcadores (DEBUG.markers = true ou ?markers) pra calibrar o pin. */
const HERO = {
  scrollLength: '+=220%',   // distância do pin (quanto dura a reprodução). Tunável.
  frameCount:   241,        // = nº de arquivos em assets/frames/ (confira: ls | wc -l)
  framePath:    (i) => `assets/frames/f_${String(i).padStart(3, '0')}.jpg`, // JPEG decodifica rápido (WebP travava o draw)
  lerp:         0.1,        // suavização do scroll (Lenis). ↓ = mais "glide"; ↑ = mais grudado/responsivo
  ease:         0.22,       // perseguição do frame no loop rAF (a "manteiga" do guia). ↓ = mais suave; ↑ = mais colado no scroll
  contentOut:   0.80,       // progresso (0–1) em que o texto da esquerda COMEÇA a sair; o fade termina junto com o vídeo (1.0)
  dishIn:       0.80,       // progresso em que a legenda do prato aparece (entra conforme o texto sai)
  focusY:       1           // enquadramento vertical do vídeo no canvas: 0=topo, 0.5=centro, 1=base. 1 = nunca corta a parte de baixo (o prato fica rente à borda inferior)
};
const DEBUG = { markers: false };

/* Overrides de calibração via querystring (dev/QA): ?len=+=260%&lerp=0.14&markers
   Inócuo em produção (sem params, nada muda). */
(function applyHeroQueryOverrides() {
  const p = new URLSearchParams(location.search);
  if (p.has('len'))  HERO.scrollLength = p.get('len');
  if (p.has('lerp')) HERO.lerp = parseFloat(p.get('lerp'));
  if (p.has('ease')) HERO.ease = parseFloat(p.get('ease'));
  if (p.has('focusy')) HERO.focusY = parseFloat(p.get('focusy')); // enquadramento vertical do vídeo (0=topo … 1=base)
  if (p.has('markers')) DEBUG.markers = true;
})();

/* ----------------------------------------------------------------- CONFIG APP
   Tudo que liga em produção (número, idioma, backend de IA) mora aqui.
   ⚠️ NUNCA coloque a API key da Anthropic no front-end — a chamada à
   /v1/messages deve passar por um backend/proxy seu (ver askSommelierAPI). */
const CONFIG = {
  // Número do WhatsApp em formato internacional, só dígitos (DDI+DDD+número).
  // TODO: troque pelo número real da casa.
  whatsapp: '5511999999999',
  brandName: 'BRASA',
  defaultLang: 'pt',
  anthropic: {
    // Endpoint do SEU backend, que por sua vez chama a API da Anthropic.
    // TODO: implemente este proxy. Ele recebe { question } e devolve { answer }.
    proxyEndpoint: '/api/sommelier',
    model: 'claude-sonnet-4-6'
  }
};

/* ------------------------------------------------------------------ helpers */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const libsReady = window.gsap && window.ScrollTrigger;

const stage   = $('.hero__stage');
const media   = $('[data-media]');
const content = $('[data-content]');
const dish    = $('[data-dish]');
const cue     = $('[data-cue]');
const heroSection = $('[data-hero]');

/* =========================================================================
   1. SMOOTH SCROLL (Lenis) + ponte com o ScrollTrigger
   ========================================================================= */
let lenis = null;
function initLenis() {
  if (prefersReduced || typeof Lenis === 'undefined') return;
  if (location.search.includes('nolenis')) return; // hook de QA: scroll nativo p/ screenshots
  lenis = new Lenis({ lerp: HERO.lerp, smoothWheel: true, wheelMultiplier: 1 });
  window.lenis = lenis; // exposto p/ depuração/QA (ex.: lenis.scrollTo no console)
  lenis.on('scroll', () => window.ScrollTrigger && ScrollTrigger.update());
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
/* navegação programática que respeita o Lenis quando presente */
function smoothTo(target) {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: 0, duration: 1.2 });
  else el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth' });
}

/* =========================================================================
   2. CANVAS DE FRAMES — a sequência (assets/frames/, JPEG) desenha no scroll.
   JPEG decodifica rápido, então ctx.drawImage não trava (WebP forçava um decode
   síncrono caro a CADA frame → era a causa do "delay absurdo"). O scroll só
   define o frame-ALVO; um loop requestAnimationFrame persegue esse alvo e desenha
   (padrão do guia sites-scroll), DESACOPLADO da rolagem — um decode lento nunca
   trava o scroll e o easing dá o movimento "manteiga". Carrega só no desktop. */
const canvas    = $('[data-hero-canvas]');
const loaderEl  = $('[data-hero-loader]');
const loaderBar = $('[data-hero-loader-bar]');
const ctx       = canvas ? canvas.getContext('2d', { alpha: false }) : null;
const frames    = [];
let   lastFrame = -1;        // último índice desenhado (evita redesenho idêntico)
let   targetFrame = 0;       // alvo vindo do scroll (onUpdate do ScrollTrigger)
let   easedFrame  = 0;       // posição suavizada que o loop rAF persegue e desenha
let   framesRequested = false, rafOn = false;

/* dimensiona o backing-store do canvas ao tamanho de tela × DPR e redesenha.
   O DPR é recalculado aqui (não capturado uma vez) p/ acompanhar troca de monitor. */
function sizeHeroCanvas() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // limita a 2 (retina não trava)
  const r = canvas.getBoundingClientRect();
  canvas.width  = Math.max(1, Math.round(r.width  * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  // Os frames (1280px) são ampliados no cover até o backing-store (~viewport × DPR).
  // Reescrever canvas.width/height ZERA o estado do contexto 2D — então o smoothing
  // precisa ser re-aplicado AQUI a cada resize (setar só uma vez no getContext não cola).
  // 'high' troca o bilinear cru (default 'low') por um kernel bicúbico/Lanczos → menos "mole".
  if (ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }
  drawFrame(easedFrame, true);
}

/* desenha o frame `f` (arredondado) com COVER centralizado, sem bordas */
function drawFrame(f, force) {
  if (!ctx) return;
  const idx = Math.max(0, Math.min(HERO.frameCount - 1, Math.round(f)));
  if (!force && idx === lastFrame) return;                   // mesmo frame → não redesenha
  const img = frames[idx];
  if (!img || !img.complete || !img.naturalWidth) return;   // ainda carregando/falhou → pula
  const cw = canvas.width, ch = canvas.height;
  const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
  const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
  // X centralizado; Y ancorado por HERO.focusY. Como (ch - h) ≤ 0, focusY=1 cola a
  // BASE do vídeo na borda inferior → o crop sai só do topo, e a parte de baixo
  // (o prato, rente ao rodapé do frame) nunca é cortada.
  ctx.drawImage(img, (cw - w) * 0.5, (ch - h) * HERO.focusY, w, h);
  lastFrame = idx;
}

/* Pré-carrega os frames; `onDone(decoded)` recebe quantos decodificaram DE FATO.
   onload conta sucesso; onerror só avança a barra — assim, se TUDO falhar (404 do
   diretório, etc.), decoded=0 e o pôster permanece (degradação "sem frames → pôster"). */
function preloadFrames(onDone) {
  let settled = 0, decoded = 0;
  const tick = () => {
    settled++;
    if (loaderBar) loaderBar.style.transform = `scaleX(${settled / HERO.frameCount})`;
    if (settled >= HERO.frameCount) onDone && onDone(decoded);
  };
  for (let i = 0; i < HERO.frameCount; i++) {
    const img = new Image();
    img.decoding = 'async';
    img.onload  = () => { decoded++; tick(); };
    img.onerror = tick;
    img.src = HERO.framePath(i + 1);
    frames[i] = img;
  }
}

/* Loop rAF (padrão do guia): persegue o frame-alvo e desenha — DESACOPLADO do
   scroll, então um decode lento nunca trava a rolagem, e o easing dá a "manteiga".
   onUpdate do ScrollTrigger só atualiza `targetFrame`; quem desenha é este loop. */
function renderLoop() {
  easedFrame += (targetFrame - easedFrame) * HERO.ease;
  if (Math.abs(targetFrame - easedFrame) < 0.01) easedFrame = targetFrame; // snap no fim (último frame exato)
  drawFrame(easedFrame);
  requestAnimationFrame(renderLoop);
}
function startRender() { if (rafOn) return; rafOn = true; requestAnimationFrame(renderLoop); }

/* Inicia o canvas. Chamado quando a cena DESKTOP ativa (ver boot()), então o
   preload acontece junto com o pin — incl. após um resize mobile→desktop.
   Idempotente: o preload dispara uma única vez; re-entradas só re-dimensionam.
   O loader some por padrão (CSS); só aparece durante o preload. */
function initHeroFrames() {
  if (!canvas) return;
  sizeHeroCanvas();
  startRender();                                         // liga o loop rAF (só desktop)
  if (framesRequested) return;
  framesRequested = true;
  if (loaderEl) loaderEl.classList.add('is-loading');
  preloadFrames((decoded) => {
    if (decoded > 0) {                                   // só cobre o pôster se há frame real
      drawFrame(easedFrame, true);                       // desenha o frame da posição atual
      if (media) media.classList.add('is-frames-ready');
    }
    if (loaderEl) loaderEl.classList.remove('is-loading');
  });
}

/* =========================================================================
   3. ENTRADA (carregamento) — revela marca, nav, headline, sub e CTA
   ========================================================================= */
function introTimeline() {
  if (prefersReduced) return;
  const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 1.1 } });
  tl.from('.hero__brand', { autoAlpha: 0, y: -14, duration: 0.9 }, 0.1)
    .from('.nav__list li', { autoAlpha: 0, x: 16, stagger: 0.08, duration: 0.7 }, 0.25)
    .from('.nav__social', { autoAlpha: 0, duration: 0.7 }, 0.5)
    .from('.eyebrow', { autoAlpha: 0, y: 18 }, 0.35)
    .from('.hero__title', { autoAlpha: 0, y: 28 }, 0.45)
    .from('.hero__sub', { autoAlpha: 0, y: 22 }, 0.62)
    .from('.hero__actions', { autoAlpha: 0, y: 18 }, 0.74)
    .from('.hero__cue', { autoAlpha: 0, duration: 0.8 }, 0.9);
}

/* =========================================================================
   4. O MERGULHO — pin + scrub: o scroll toca os frames; o texto sai, a legenda entra.
   Sem scale de tela: o "zoom" é o próprio push-in do vídeo, frame a frame.
   ========================================================================= */
function buildDesktopScene() {
  sizeHeroCanvas();

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: heroSection,
      start: 'top top',
      end: HERO.scrollLength,
      pin: stage,
      scrub: true,                 // segue o scroll já suavizado pelo Lenis, sem latência extra
      anticipatePin: 1,
      invalidateOnRefresh: true,
      markers: DEBUG.markers,
      // o scroll só define o frame-ALVO; o loop rAF persegue e desenha (sem travar a rolagem)
      onUpdate:  (self) => { targetFrame = self.progress * (HERO.frameCount - 1); },
      onRefresh: sizeHeroCanvas
    }
  });

  // os frames são o único "zoom" — aqui só some o texto e revela a legenda do prato.
  // O texto fica legível durante TODO o mergulho e só sai no fim: o fade começa em
  // HERO.contentOut e termina em 1.0 (exatamente quando o vídeo acaba).
  tl.to(content, { autoAlpha: 0, yPercent: -6, ease: 'power1.in', duration: 1 - HERO.contentOut }, HERO.contentOut);
  tl.to(cue,     { autoAlpha: 0, duration: 0.1 }, 0);
  // duration = 1 - dishIn → a legenda termina de entrar em 1.0 (fim do vídeo), e a
  // timeline inteira fica mapeada 0→1 no scroll, então o texto também só sai no fim.
  tl.fromTo(dish,
    { autoAlpha: 0, y: 24 },
    { autoAlpha: 1, y: 0, duration: 1 - HERO.dishIn, ease: 'power2.out' },
    HERO.dishIn);
}

/* =========================================================================
   5. NAVEGAÇÃO — toggle mobile (hero), scroll suave e link ativo (todas as navs)
   ========================================================================= */
function setActiveNav(id) {
  $$('[data-navlink]').forEach((l) =>
    l.classList.toggle('is-active', l.getAttribute('href') === `#${id}`));
}

function initNav() {
  const nav = $('.hero__nav');
  const toggle = $('[data-nav-toggle]');

  // abre/fecha overlay no mobile (hero) — com foco gerenciado e preso enquanto aberto
  if (toggle && nav) {
    const closeHero = () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      if (lenis) lenis.start();
    };
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      if (lenis) open ? lenis.stop() : lenis.start();
      if (open) { const first = nav.querySelector('.nav__list a'); if (first) first.focus(); }
      else toggle.focus();
    });
    // teclado: Esc fecha; Tab/Shift+Tab ficam presos dentro do overlay (full-screen)
    nav.addEventListener('keydown', (e) => {
      if (!nav.classList.contains('is-open')) return;
      if (e.key === 'Escape') { closeHero(); toggle.focus(); return; }
      if (e.key === 'Tab') {
        const f = $$('a[href], button', nav);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // scroll suave p/ qualquer âncora interna (exceto o botão de WhatsApp)
  $$('a[href^="#"]').forEach((link) => {
    if (link.matches('[data-whats-reserve]')) return;
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (!id || id === '#' || !$(id)) return;
      e.preventDefault();
      // fecha overlays abertos
      if (nav) nav.classList.remove('is-open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
      closeScrollnavMenu();
      if (lenis) lenis.start();
      smoothTo(id);
    });
  });

  // link ativo conforme a seção visível (IntersectionObserver — independe do GSAP)
  const sections = $$('main section[id]');
  if ('IntersectionObserver' in window && sections.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActiveNav(en.target.id); });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    sections.forEach((s) => io.observe(s));
  }
}

/* =========================================================================
   6. REVELAÇÕES — entrada suave das seções (IntersectionObserver).
   Estado de repouso é visível; só "arma" o efeito se houver suporte + movimento.
   ========================================================================= */
function initReveals() {
  const items = $$('[data-reveal]');
  if (!items.length) return;
  if (prefersReduced || !('IntersectionObserver' in window)) return; // tudo já visível

  document.documentElement.classList.add('reveals-armed');
  // rede de segurança: se o observer nunca acordar (ambiente estranho), revela tudo.
  // Cancelada assim que o observer prova estar vivo — então não força revelar o que
  // ainda está fora da tela (preserva o efeito de scroll-reveal).
  const safety = setTimeout(() => items.forEach((el) => el.classList.add('is-in')), 4000);
  const io = new IntersectionObserver((entries, obs) => {
    clearTimeout(safety);
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  items.forEach((el) => io.observe(el));
}

/* =========================================================================
   7. SCROLL-NAV + SOMMELIER — aparecem só depois da hero
   ========================================================================= */
function initScrollnav() {
  const bar = $('[data-scrollnav]');
  const toggle = $('[data-scrollnav-toggle]');
  const menu = $('[data-scrollnav-menu]');

  // dropdown mobile
  if (toggle && bar && menu) {
    toggle.addEventListener('click', () => {
      const open = bar.getAttribute('data-open') === 'true';
      setScrollnavMenu(!open);
    });
    // Esc fecha o dropdown e devolve o foco ao botão
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && bar.getAttribute('data-open') === 'true') {
        closeScrollnavMenu();
        toggle.focus();
      }
    });
  }

  // revela a barra fixa SÓ depois da hero (não brigar com o mergulho).
  // Usa o fundo real da hero (que inclui o pin-spacer do ScrollTrigger).
  const onScroll = () => {
    const y = window.scrollY || window.pageYOffset || 0;
    const vh = window.innerHeight;
    const heroBottom = heroSection ? heroSection.offsetTop + heroSection.offsetHeight : vh;
    const past = y > heroBottom - vh * 0.55;
    if (bar) bar.classList.toggle('is-visible', past);
    if (!past) { closeScrollnavMenu(); }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();
}
function setScrollnavMenu(open) {
  const bar = $('[data-scrollnav]');
  const toggle = $('[data-scrollnav-toggle]');
  const menu = $('[data-scrollnav-menu]');
  if (!bar || !menu) return;
  if (bar.getAttribute('data-open') === String(open)) return; // já está nesse estado (evita churn no scroll)
  bar.setAttribute('data-open', String(open));
  if (open) {
    menu.removeAttribute('hidden');
    const first = menu.querySelector('a, button');
    if (first) first.focus();        // só o caminho de abrir (clique) move o foco
  } else {
    menu.setAttribute('hidden', '');
  }
  if (toggle) toggle.setAttribute('aria-expanded', String(open));
}
function closeScrollnavMenu() { setScrollnavMenu(false); }

/* =========================================================================
   8. RESERVAS — validação acessível + deep-link de WhatsApp
   ========================================================================= */

/* Monta o deep-link wa.me com os dados do formulário. Isolada e testável. */
function buildWhatsAppReservation(data = {}) {
  const dataFmt = formatDateBR(data.data);
  const lines = [
    `Olá, ${CONFIG.brandName}! Gostaria de solicitar uma reserva.`,
    ''
  ];
  if (data.nome)       lines.push(`• Nome: ${data.nome}`);
  if (dataFmt)         lines.push(`• Data: ${dataFmt}`);
  if (data.horario)    lines.push(`• Horário: ${data.horario}`);
  if (data.pessoas)    lines.push(`• Pessoas: ${data.pessoas}`);
  if (data.observacoes) lines.push(`• Observações: ${data.observacoes}`);
  if (lines.length === 2) lines.push('Gostaria de verificar disponibilidade de mesa.');
  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${CONFIG.whatsapp}?text=${text}`;
}
// exposta p/ testes manuais no console
window.buildWhatsAppReservation = buildWhatsAppReservation;

function formatDateBR(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function readReservation(form) {
  const fd = new FormData(form);
  return {
    nome: (fd.get('nome') || '').toString().trim(),
    data: (fd.get('data') || '').toString(),
    horario: (fd.get('horario') || '').toString(),
    pessoas: (fd.get('pessoas') || '').toString(),
    observacoes: (fd.get('observacoes') || '').toString().trim()
  };
}

function initReservation() {
  const form = $('[data-resform]');
  const status = $('[data-resform-status]');
  const whatsLinks = $$('[data-whats-reserve]');

  // mantém o href do WhatsApp sempre atualizado com o que estiver preenchido
  const refreshWhats = () => {
    if (!form) return;
    const url = buildWhatsAppReservation(readReservation(form));
    whatsLinks.forEach((a) => a.setAttribute('href', url));
  };
  if (form) {
    form.addEventListener('input', refreshWhats);
    refreshWhats();
  } else {
    // página sem formulário: link genérico
    whatsLinks.forEach((a) => a.setAttribute('href', buildWhatsAppReservation()));
  }

  if (!form) return;

  const fieldError = (name, msg) => {
    const el = $(`[data-err-for="${name}"]`, form);
    const input = form.elements[name];
    if (el) el.textContent = msg || '';
    if (input) {
      if (msg) {
        input.setAttribute('aria-invalid', 'true');
        if (el && el.id) input.setAttribute('aria-describedby', el.id); // leitor anuncia o erro no foco
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    }
  };

  const validate = (data) => {
    let firstBad = null;
    const fail = (name, msg) => { fieldError(name, msg); if (!firstBad) firstBad = name; };
    fieldError('nome'); fieldError('data'); fieldError('horario'); fieldError('pessoas');

    if (!data.nome) fail('nome', 'Por favor, informe seu nome.');
    if (!data.data) fail('data', 'Escolha uma data.');
    else {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const chosen = new Date(data.data + 'T00:00:00');
      if (chosen < today) fail('data', 'Escolha uma data a partir de hoje.');
    }
    if (!data.horario) fail('horario', 'Escolha um horário.');
    const n = parseInt(data.pessoas, 10);
    if (!data.pessoas || isNaN(n) || n < 1) fail('pessoas', 'Quantas pessoas?');
    else if (n > 20) fail('pessoas', 'Para grupos acima de 20, fale conosco pelo WhatsApp.');
    return firstBad;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = readReservation(form);
    const bad = validate(data);
    if (bad) {
      if (status) { status.textContent = 'Confira os campos destacados para concluir.'; status.className = 'resform__status is-err'; }
      const input = form.elements[bad];
      // adia o foco 1 tick p/ o leitor de tela enfileirar o status (live region) antes
      if (input && input.focus) setTimeout(() => input.focus(), 80);
      return;
    }
    // ---- SUCESSO (mock) -------------------------------------------------
    // TODO(backend): envie `data` ao seu endpoint de reservas (e-mail/CRM/agenda).
    // Por ora confirmamos localmente e deixamos o WhatsApp como canal direto.
    refreshWhats();
    if (status) {
      status.innerHTML = `Recebemos seu pedido, <strong>${escapeHTML(data.nome.split(' ')[0])}</strong>. ` +
        `Confirmaremos para <strong>${escapeHTML(formatDateBR(data.data))}</strong> às ` +
        `<strong>${escapeHTML(data.horario)}</strong> em até 2 horas. Prefere agilizar? Use o WhatsApp acima.`;
      status.className = 'resform__status is-ok';
    }
    form.reset();
    refreshWhats();
  });

  // o botão de WhatsApp valida levemente antes de abrir (mas nunca bloqueia)
  whatsLinks.forEach((a) => a.addEventListener('click', () => refreshWhats()));
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* =========================================================================
   9. SOMMELIER VIRTUAL — chat mockado, pronto p/ backend Anthropic
   ========================================================================= */
const PAIRINGS = [
  { keys: ['magret', 'pato'],            wine: 'Pinot Noir de clima frio',     note: 'fruta vermelha e leve defumado acompanham a pele crocante e a redução de vinho. Um Syrah do norte do Rhône também brilha.' },
  { keys: ['vieira'],                    wine: 'Chablis mineral',              note: 'a acidez corta a manteiga de algas; um espumante brut nature faz o mesmo papel.' },
  { keys: ['polvo'],                     wine: 'Albariño (ou Vinho Verde)',    note: 'salino e cítrico, conversa com o pimentão queimado e a batata ao murro.' },
  { keys: ['costela', 'tutano'],         wine: 'Malbec de altitude',           note: 'taninos maduros e fruta concentrada para o fogo lento de 12 horas. Cabernet Franc também vai bem.' },
  { keys: ['peixe', 'pesca'],            wine: 'Borgonha branco (ou Riesling seco)', note: 'a brasa pede acidez e tensão para equilibrar o beurre blanc.' },
  { keys: ['alcachofra'],               wine: 'Fino / Manzanilla (xerez seco)', note: 'a alcachofra é traiçoeira para vinhos; um xerez seco, ou um saquê Junmai, resolve com elegância.' },
  { keys: ['raíz', 'raiz', 'beterraba', 'cinza'], wine: 'Gamay (Beaujolais), levemente gelado', note: 'um tinto leve e terroso ecoa a doçura das raízes assadas nas cinzas.' },
  { keys: ['brasa doce', 'sobremesa', 'banana', 'doce', 'rapadura'], wine: 'Tawny 10 anos (ou cachaça envelhecida)', note: 'o caramelo de cachaça da sobremesa se repete na taça.' }
];

function sommelierSuggest(question) {
  const q = (question || '').toLowerCase();
  const hit = PAIRINGS.find((p) => p.keys.some((k) => q.includes(k)));
  if (hit) {
    return `Para esse prato, eu serviria um <strong>${hit.wine}</strong>, ${hit.note}`;
  }
  if (/vinho|tinto|branco|taça|harmoniz/.test(q)) {
    return `Posso sugerir a taça certa para cada tempo. Me diga o prato, ou toque em um dos atalhos acima, que eu indico a harmonização. Para a noite inteira, recomendo nossa <strong>harmonização autoral</strong> (+ R$ 240).`;
  }
  return `Conte qual prato você vai pedir (ou escolha um dos tempos do menu) que eu sugiro o vinho ideal. Nossa <strong>harmonização autoral</strong> acompanha todo o menu degustação, taça a taça.`;
}

/* Backend real (a implementar). NUNCA exponha a API key no front.
   O proxy recebe { question } e chama a Anthropic /v1/messages com o
   modelo CONFIG.anthropic.model, devolvendo { answer }. */
async function askSommelierAPI(question) {
  // TODO(backend): habilite quando o proxy existir.
  // const res = await fetch(CONFIG.anthropic.proxyEndpoint, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ question, model: CONFIG.anthropic.model })
  // });
  // if (!res.ok) throw new Error('sommelier proxy error');
  // const { answer } = await res.json();
  // return answer;
  return sommelierSuggest(question); // fallback local (mock) por enquanto
}

/* Sommelier EMBUTIDO na seção #menu (caixa .menu__sommelier). Sempre visível —
   sem FAB/abrir/fechar. Dá respostas prontas (sommelierSuggest, por palavra-chave). */
function initSommelier() {
  const root = $('[data-sommelier]');
  if (!root) return;
  const log = $('[data-somm-log]', root);
  const form = $('[data-somm-form]', root);
  const input = $('[data-somm-input]', root);
  const chips = $$('[data-somm-chip]', root);
  if (!log) return; // degrada se a marcação estiver incompleta

  const addMsg = (html, who) => {
    const el = document.createElement('div');
    el.className = `somm__msg somm__msg--${who}`;
    if (who === 'user') el.textContent = html;   // entrada do usuário: nunca como HTML
    else el.innerHTML = html;                     // resposta controlada por nós
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  };

  // saudação inicial — a caixa é sempre visível na seção
  addMsg('Boa noite. Sou o sommelier da BRASA. Toque num atalho ou pergunte — eu sugiro a taça certa.', 'bot');

  const ask = async (question) => {
    addMsg(question, 'user');
    const answer = await askSommelierAPI(question).catch(() => sommelierSuggest(question));
    addMsg(answer, 'bot');
  };

  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      ask(q);
    });
  }
  chips.forEach((c) => c.addEventListener('click', () => ask(c.dataset.sommChip)));
}

/* =========================================================================
   10. i18n — pt/en. PT vem do markup (fonte da verdade); EN é o "esqueleto".
   Chaves sem tradução em EN caem de volta para PT — nada fica em branco.
   ========================================================================= */
const I18N = {
  // EN: esqueleto — preenchido para nav, hero, títulos de seção e CTAs.
  // O corpo de texto mais longo cai no PT por ora (TODO: traduzir).
  en: {
    'nav.inicio': 'Home', 'nav.casa': 'The House', 'nav.menu': 'Menu',
    'nav.experiencia': 'Experience', 'nav.reservas': 'Reservations',
    'nav.contato': 'Contact', 'nav.reservar': 'Book', 'nav.label': 'Menu',
    'brand.tag': 'fire kitchen',
    'hero.eyebrow': 'Tasting menu · live fire',
    'hero.title': 'Where fire<br /><em>becomes art</em>',
    'hero.sub': 'Authorial cooking over live embers. Selected ingredients, precise technique and an experience considered down to the smallest detail, from the first aroma to the last spoonful.',
    'hero.cta.reservar': 'Book a table', 'hero.cta.menu': 'See the menu',
    'hero.dish.name': 'Duck magret', 'hero.dish.desc': 'wine reduction · smoked purée · edible flowers',
    'hero.cue': 'scroll to discover',
    'casa.kicker': 'The method',
    'casa.title': 'Fire is our method.<br /><em>Precision, our language.</em>',
    'menu.kicker': 'Live fire · à la carte', 'menu.title': 'The menu',
    'menu.lead': 'From the fire, plates to share. The menu changes with the seasons and with what the fire asks for that day.',
    'menu.signature': 'signature',
    'menu.note': 'Prices per person, in reais (R$). Dietary restrictions accommodated with advance notice.',
    'exp.kicker': "Chef's counter", 'exp.title': 'Twelve seats. One fire. One night.',
    'exp.p1.title': 'Live fire', 'exp.p2.title': 'Authorial pairing', 'exp.p3.title': "Chef's table",
    'exp.band': 'From the counter, you watch the fire work.',
    'resv.kicker': 'Tue–Sun · from 7pm', 'resv.title': 'Book your table', 'resv.whats': 'Book via WhatsApp',
    'resv.fact.hours.k': 'Hours', 'resv.fact.phone.k': 'Phone', 'resv.fact.reply.k': 'Reply',
    'resv.fact.reply.v': 'We confirm within 2 hours',
    'form.nome': 'Full name', 'form.data': 'Date', 'form.horario': 'Time', 'form.pessoas': 'Guests',
    'form.obs': 'Notes', 'form.optional': '(optional)', 'form.submit': 'Send reservation request', 'form.or': 'or',
    'contato.kicker': 'Vila Madalena, SP', 'contato.title': 'Where the fire lives',
    'contato.address.k': 'Address', 'contato.hours.k': 'Hours', 'contato.contact.k': 'Reach us',
    'footer.seal': 'fire kitchen · since 2026', 'footer.rights': '© 2026 BRASA. All rights reserved.',
    'somm.fab': 'Sommelier', 'somm.title': 'BRASA Sommelier', 'somm.sub': 'Pairing suggestions, glass by glass.',
    'somm.inputlabel': 'Ask about a pairing', 'somm.placeholder': 'Which wine goes with the magret?',
    'somm.disclaimer': 'Suggestions generated locally. Connect a backend for AI answers.',
    'somm.close': 'Close sommelier', 'somm.send': 'Send question',
    'a11y.skip': 'Skip to content', 'a11y.menu.sections': 'Open sections menu',
    'a11y.menu.open': 'Open menu', 'a11y.instagram': 'BRASA on Instagram (opens in new tab)'
  }
};

const i18nBase = new Map(); // PT capturado do markup

function captureBase() {
  $$('[data-i18n]').forEach((el) => i18nBase.set(el, { type: 'text', val: el.textContent }));
  $$('[data-i18n-html]').forEach((el) => i18nBase.set(el, { type: 'html', val: el.innerHTML }));
  $$('[data-i18n-attr]').forEach((el) => {
    const [attr] = el.dataset.i18nAttr.split(':');
    i18nBase.set(el, { type: 'attr', attr, val: el.getAttribute(attr) });
  });
}

function applyLang(lang) {
  const dict = lang === 'pt' ? null : (I18N[lang] || null);
  const get = (key, base) => (dict && dict[key] != null) ? dict[key] : base;

  $$('[data-i18n]').forEach((el) => {
    const base = i18nBase.get(el); if (!base) return;
    el.textContent = get(el.dataset.i18n, base.val);
  });
  $$('[data-i18n-html]').forEach((el) => {
    const base = i18nBase.get(el); if (!base) return;
    el.innerHTML = get(el.dataset.i18nHtml, base.val);
  });
  $$('[data-i18n-attr]').forEach((el) => {
    const base = i18nBase.get(el); if (!base) return;
    const [attr, key] = el.dataset.i18nAttr.split(':');
    el.setAttribute(attr, get(key, base.val));
  });

  document.documentElement.lang = lang === 'en' ? 'en' : 'pt-BR';
  $$('[data-lang-toggle] button').forEach((b) => {
    const on = b.dataset.lang === lang;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  try { localStorage.setItem('brasa-lang', lang); } catch (e) {}
}

function initI18n() {
  captureBase();
  let lang = CONFIG.defaultLang;
  try { lang = localStorage.getItem('brasa-lang') || lang; } catch (e) {}
  if (lang !== 'pt') applyLang(lang);
  else applyLang('pt'); // garante estado dos toggles

  $$('[data-lang-toggle] button').forEach((b) => {
    b.addEventListener('click', () => applyLang(b.dataset.lang));
  });
}

/* =========================================================================
   11. BOOT
   ========================================================================= */
function boot() {
  initI18n();        // idioma primeiro (não depende de libs)
  initNav();
  initReveals();
  initScrollnav();
  initReservation();
  initSommelier();

  if (!libsReady) return; // sem GSAP → poster + conteúdo já visíveis (degradação)

  gsap.registerPlugin(ScrollTrigger);
  initLenis();
  introTimeline();

  // Só o desktop tem cena (pin + frames). No mobile/reduced a hero é estática (pôster).
  // Os frames carregam JUNTO com a cena (mesma media query) → resize mobile↔desktop
  // sempre fica consistente, e nada baixa frames fora do desktop.
  const mm = gsap.matchMedia();
  mm.add('(min-width: 861px)', () => {
    if (prefersReduced) return;            // CSS já cuida do estado estático
    initHeroFrames();
    buildDesktopScene();                   // scroll define o frame-alvo; o loop rAF desenha (suave)
  });

  // recalcula após carregar tudo (fontes/imagens mudam alturas)
  window.addEventListener('load', () => ScrollTrigger.refresh());
}

document.addEventListener('DOMContentLoaded', boot);
