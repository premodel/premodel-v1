(function() {
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();

  var scrollEl = document.getElementById('scroll');
  var steps = scrollEl.querySelectorAll('.step');
  // Scroll-linked reveal: each step's openness tracks how close it is to the focus line,
  // so descriptions scrub open at the rate of scroll instead of snapping on a threshold.
  var stepsArr = Array.prototype.slice.call(steps);
  var stepTicking = false;
  function updateSteps() {
    var r = scrollEl.getBoundingClientRect();
    var center = r.top + r.height * 0.45;
    // PLATEAU = band around the focus line where a step stays fully open (a dead-zone that
    // keeps the focused step stable as you scroll). RAMP = distance beyond the plateau over
    // which it eases from open to closed. Smoothstep gives a gentle slope at both ends, so
    // neighbors don't snap in/out faster than you scroll.
    var PLATEAU = Math.max(45, r.height * 0.08);
    // Asymmetric ramp: a step eases open smoothly as it APPROACHES the focus line from below
    // (RAMP_UP, long = smooth), but steps already PAST the line collapse quickly (RAMP_DOWN,
    // short). Upcoming steps below the line stay collapsed until they're near, so their headings
    // stack up readable and you can see several steps ahead instead of a wall of open text.
    var RAMP_UP = Math.max(350, r.height * 0.60);
    var RAMP_DOWN = Math.max(120, r.height * 0.20);
    // FOCUS biases off-focus steps toward closed; keeps the transition smooth via the long ramp.
    var FOCUS = 3;
    var best = null, bestDist = Infinity;
    stepsArr.forEach(function(s) {
      // Anchor the distance to the step's number/header (a FIXED-height element), not the
      // full step center. The full height grows as the description opens, which would move the
      // center and feed back into this step's own progress — an oscillation that makes the list
      // jitter. The header anchor is immune to the step's own expansion, so no feedback loop.
      var numEl = s.querySelector('.num') || s;
      var nr = numEl.getBoundingClientRect();
      var sc = nr.top + nr.height / 2;
      var signed = sc - center;              // <0 = below the focus line (upcoming), >0 = passed
      var d = Math.abs(signed);
      if (d < bestDist) { bestDist = d; best = s; }
      if (!s.classList.contains('phase-step')) {
        var ramp = signed < 0 ? RAMP_UP : RAMP_DOWN;
        var t = 1 - (d - PLATEAU) / ramp;      // 1 inside the plateau, ramps to 0 beyond it
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        var p = t * t * (3 - 2 * t);           // smoothstep: eases in and out
        p = Math.pow(p, FOCUS);                // bias periphery toward closed, keep focus open
        s.style.setProperty('--p', p.toFixed(3));
      }
    });
    stepsArr.forEach(function(s) { s.classList.toggle('active', s === best); });
    stepTicking = false;
  }
  function onStepScroll() {
    if (!stepTicking) { stepTicking = true; requestAnimationFrame(updateSteps); }
  }
  scrollEl.addEventListener('scroll', onStepScroll, { passive: true });
  updateSteps();

  // Hero rotating word — Layout A. Starts frozen on "remodel"; the cycle only begins once the
  // hero card flips to its reveal (startHeroRotator, called from the flip intro below). Every word
  // — "remodel" included — holds the same 2s, slow enough to sit calmly under the video's cuts.
  var startHeroRotator = function() {};
  (function initHeroRotator() {
    var rotator = document.getElementById('hero-rotator');
    if (!rotator) return;
    var wordEl = rotator.querySelector('.hero-rotator-word');
    if (!wordEl) return;
    var words = ['remodel', 'guess', 'commit', 'spend', 'demo'];
    var HOLD = 3000;
    var i = 0;
    function applyWord(w) {
      wordEl.textContent = w;
    }
    applyWord(words[0]);
    var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    function tick() {
      wordEl.classList.add('out');
      setTimeout(function() {
        i = (i + 1) % words.length;
        applyWord(words[i]);
        wordEl.classList.remove('out');
        setTimeout(tick, HOLD);
      }, 280);
    }
    // "remodel" is already on screen; hold it 2s from the flip, then cycle endlessly. Run once.
    startHeroRotator = function() {
      startHeroRotator = function() {};
      setTimeout(tick, HOLD);
    };
  })();

  // Slide stride = distance between adjacent slide origins. On mobile slides are
  // full-width (stride = clientWidth); at tablet/desktop they're narrower with a
  // gap, so index math must use the real stride, not the track width. Skips
  // display:none children (the hero loop's edge clones below desktop).
  function slideStride(track) {
    var kids = Array.prototype.filter.call(track.children, function(k) { return k.offsetWidth > 0; });
    return kids.length > 1 ? (kids[1].offsetLeft - kids[0].offsetLeft) : track.clientWidth;
  }

  var carousel = document.getElementById('carousel');
  var dots = document.querySelectorAll('#dots .dot');
  var heroFlipCards = carousel.querySelectorAll('.flip-card');
  function setCardFlipped(card, flipped) {
    card.classList.toggle('flipped', flipped);
    card.querySelectorAll('.hero-before-btn').forEach(function(b) {
      b.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    });
  }
  // ── Circular hero (desktop only) ──────────────────────────────────────────
  // Edge clones of the last + first slides flank the real set: [cloneLast, 1..n,
  // cloneFirst]. CSS shows them only at the desktop breakpoint; when a scroll
  // settles on a clone, we teleport (instant, on a snap point) to its real twin.
  var heroRealCount = carousel.children.length;
  (function buildHeroLoopClones() {
    var slides = Array.prototype.slice.call(carousel.children);
    if (slides.length < 2) return;
    var cloneLast = slides[slides.length - 1].cloneNode(true);
    var cloneFirst = slides[0].cloneNode(true);
    [cloneLast, cloneFirst].forEach(function(c) {
      c.classList.add('is-clone');
      c.setAttribute('aria-hidden', 'true');
      // Clones are scenery, not UI: no buttons, no playing video, and — since they only ever peek as
      // off-center neighbors — always resting on the Before face.
      c.querySelectorAll('button').forEach(function(b) { b.remove(); });
      c.querySelectorAll('video').forEach(function(v) { v.removeAttribute('autoplay'); v.preload = 'none'; });
      c.querySelectorAll('.flip-card').forEach(function(f) { f.classList.add('flipped'); });
    });
    carousel.insertBefore(cloneLast, carousel.firstElementChild);
    carousel.appendChild(cloneFirst);
  })();
  function heroLoopActive() {
    var c = carousel.querySelector('.slide.is-clone');
    return !!(c && c.offsetWidth > 0);
  }
  function heroIndex() {
    var i = Math.round(carousel.scrollLeft / slideStride(carousel));
    if (heroLoopActive()) i = ((i - 1) % heroRealCount + heroRealCount) % heroRealCount;
    return Math.max(0, Math.min(i, heroRealCount - 1));
  }
  // After a swipe/scroll settles on a clone, jump to the matching real slide.
  function heroLoopSettle() {
    if (!heroLoopActive()) return;
    var stride = slideStride(carousel);
    var visI = Math.round(carousel.scrollLeft / stride);
    if (visI === 0) carousel.scrollLeft = heroRealCount * stride;
    else if (visI === heroRealCount + 1) carousel.scrollLeft = stride;
  }
  // Both paths registered (teleport is idempotent): scrollend is precise where
  // supported; the debounce covers browsers/contexts where it never fires.
  if ('onscrollend' in window) carousel.addEventListener('scrollend', heroLoopSettle);
  var heroSettleTimer;
  carousel.addEventListener('scroll', function() {
    clearTimeout(heroSettleTimer);
    heroSettleTimer = setTimeout(heroLoopSettle, 140);
  }, { passive: true });
  // ── Desktop "deck" ────────────────────────────────────────────────────────
  // At the desktop breakpoint the @container query sets --deck:1, and the carousel becomes a stacked
  // deck instead of a scroll-snap row: the front slide is centered on top, the others tuck behind it
  // peeking on each side. Swiping/clicking shuffles which slide is in front. Below desktop, --deck:0
  // and the scroll-snap row is used unchanged.
  var realHeroSlides = function() {
    return Array.prototype.filter.call(carousel.children, function(s) { return !s.classList.contains('is-clone'); });
  };
  function isDeck() { return getComputedStyle(carousel).getPropertyValue('--deck').trim() === '1'; }
  var deckIndex = 0;
  function currentIndex() { return isDeck() ? deckIndex : heroIndex(); }
  function layoutDeck() {
    var slides = realHeroSlides();
    var n = slides.length;
    if (!n) return;
    var w = (slides[deckIndex] || slides[0]).offsetWidth || 0;
    slides.forEach(function(s, k) {
      var raw = ((k - deckIndex) % n + n) % n;     // 0..n-1
      var d = raw > n / 2 ? raw - n : raw;          // shortest signed distance; front = 0
      var front = d === 0;
      s.classList.toggle('is-front', front);
      var dx = front ? 0 : (d > 0 ? 1 : -1) * w * 0.19;
      s.style.setProperty('--dx', dx + 'px');
      s.style.setProperty('--sc', front ? '1' : '0.86');
      s.style.setProperty('--z', front ? '30' : String(20 - Math.abs(d)));
      s.style.setProperty('--op', front ? '1' : '0.5');
    });
  }
  function setDeck(i) {
    var n = realHeroSlides().length || 1;
    deckIndex = ((i % n) + n) % n;
    layoutDeck();
    updateDots();
  }
  // Enter/leave deck mode on breakpoint changes. Entering carries the current card to the front;
  // leaving restores the scroll-snap row resting on that same card.
  function syncHeroLoop() {
    if (isDeck()) {
      if (!carousel.classList.contains('deck')) {
        if (activeHeroIndex >= 0) deckIndex = activeHeroIndex;
        carousel.classList.add('deck');
      }
      layoutDeck();
      updateDots();
    } else {
      if (carousel.classList.contains('deck')) {
        carousel.classList.remove('deck');
        carousel.scrollLeft = deckIndex * slideStride(carousel);
      } else {
        carousel.scrollLeft = 0;
      }
      updateDots();
    }
  }

  function updateDots() {
    var i = currentIndex();
    dots.forEach(function(d, j) { d.classList.toggle('active', j === i); });
    focusHeroCard(i);
  }

  // Focus behavior: whichever reveal is centered starts on its Before face, holds 2s, then flips to
  // the Reveal and plays its video from the top. The 2s clock starts the moment a card becomes the
  // centered one. Any card that isn't centered defaults back to Before with its video paused and
  // rewound, so returning to center always replays the full before → reveal beat from the start.
  var heroVideoOf = function(card) { return card.querySelector('.flip-card-front video'); };
  var SWIPE_MS = 500;   // matches the deck's position transition — wait for the swipe to finish
  var XFADE_MS = 600;   // matches the video frame's opacity transition (the subtle video→before fade)
  var FLIP_MS  = 600;   // matches the .flip-card-inner rotate — hold the video until the flip lands
  function heroClearTimers(card) {
    clearTimeout(card._leaveT); clearTimeout(card._xfT); clearTimeout(card._flipT);
  }
  // Snap to Before with no flip rotation (off-focus reset for cards without a playing reveal). Re-opaques
  // the video frame so it once again covers the under-layer Before image, ready for the next reveal.
  function heroShowBefore(card, animate) {
    heroClearTimers(card);
    var v = heroVideoOf(card);
    if (v) v.classList.add('active');
    if (animate === false) card.classList.add('no-flip-anim');
    setCardFlipped(card, true);
    if (v) { try { v.pause(); v.currentTime = 0; } catch (e) {} }
    if (animate === false) { void card.offsetWidth; card.classList.remove('no-flip-anim'); }
  }
  // A card leaving focus while its reveal video is showing: keep playing through the swipe, then do a
  // subtle crossfade from the video to the under-layer Before image (fade the video out), and only then
  // pause/rewind and settle into the standard flipped Before state. No video (placeholder) → just snap.
  function heroLeaveReveal(card) {
    var v = heroVideoOf(card);
    if (!v || card.classList.contains('flipped')) { heroShowBefore(card, false); return; }
    heroClearTimers(card);
    card._leaveT = setTimeout(function() {
      v.classList.remove('active');                  // crossfade: video fades out, Before shows through
      card._xfT = setTimeout(function() {
        try { v.pause(); v.currentTime = 0; } catch (e) {}
        card.classList.add('no-flip-anim');
        setCardFlipped(card, true);                  // settle onto the back Before face (seamless: same image)
        void card.offsetWidth;
        card.classList.remove('no-flip-anim');
        v.classList.add('active');                   // restore the video frame behind the now-flipped card
      }, XFADE_MS);
    }, SWIPE_MS);
  }
  function heroShowReveal(card) {
    heroClearTimers(card);
    var v = heroVideoOf(card);
    if (v) v.classList.add('active');
    setCardFlipped(card, false);
    if (v) { try { v.currentTime = 0; var p = v.play(); if (p && p.catch) p.catch(function() {}); } catch (e) {} }
  }
  // Manual "Before": flip with animation but keep the video playing through the flip; pause/rewind only
  // once the flip has landed.
  function heroFlipToBefore(card) {
    heroClearTimers(card);
    var v = heroVideoOf(card);
    if (v) v.classList.add('active');
    setCardFlipped(card, true);                       // animated flip; the video keeps playing on the front
    card._flipT = setTimeout(function() {
      if (v) { try { v.pause(); v.currentTime = 0; } catch (e) {} }
    }, FLIP_MS);
  }
  var activeHeroIndex = -1, heroFlipTimer = null, heroRotatorStarted = false;
  var HERO_HOLD = 2000; // ms a centered card sits on its Before face before flipping to the Reveal
  function focusHeroCard(i) {
    if (i === activeHeroIndex) return;
    var prev = activeHeroIndex;
    activeHeroIndex = i;
    clearTimeout(heroFlipTimer);
    heroFlipCards.forEach(function(card, j) {
      if (j === i) return;
      if (j === prev) heroLeaveReveal(card);          // the card leaving focus crossfades (if it's revealing)
      else heroShowBefore(card, false);               // everyone else just rests on Before
    });
    var active = heroFlipCards[i];
    if (!active) return;
    heroShowBefore(active, false);
    heroFlipTimer = setTimeout(function() {
      heroShowReveal(active);
      if (!heroRotatorStarted) { heroRotatorStarted = true; startHeroRotator(); }
    }, HERO_HOLD);
  }
  // Manual Before/Reveal toggle. A tap takes over from the auto-flip timer for that card: flipping to
  // the Reveal plays its video from the top; flipping to Before keeps the video playing through the
  // flip, then pauses and rewinds it once the flip lands.
  heroFlipCards.forEach(function(card) {
    card.querySelectorAll('.hero-before-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        clearTimeout(heroFlipTimer);
        if (card.classList.contains('flipped')) heroShowReveal(card);
        else heroFlipToBefore(card);
      });
    });
  });

  carousel.addEventListener('scroll', updateDots, { passive: true });
  dots.forEach(function(d, i) {
    d.addEventListener('click', function() {
      if (isDeck()) { setDeck(i); return; }
      var offset = heroLoopActive() ? 1 : 0;
      carousel.scrollTo({ left: (i + offset) * slideStride(carousel), behavior: 'smooth' });
    });
  });
  // Deck navigation: drag (pointer), horizontal trackpad swipe (wheel), or click a peeking side card.
  var deckDownX = null, deckDragging = false;
  carousel.addEventListener('pointerdown', function(e) {
    if (!isDeck()) return;
    deckDownX = e.clientX; deckDragging = true;
  });
  window.addEventListener('pointerup', function(e) {
    if (!deckDragging) return;
    deckDragging = false;
    if (!isDeck() || deckDownX === null) return;
    var dx = e.clientX - deckDownX; deckDownX = null;
    if (Math.abs(dx) > 50) setDeck(deckIndex + (dx < 0 ? 1 : -1));
  });
  var deckWheelLock = false;
  carousel.addEventListener('wheel', function(e) {
    if (!isDeck()) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 18) return;
    e.preventDefault();
    if (deckWheelLock) return;
    deckWheelLock = true;
    setDeck(deckIndex + (e.deltaX > 0 ? 1 : -1));
    setTimeout(function() { deckWheelLock = false; }, 420);
  }, { passive: false });
  realHeroSlides().forEach(function(s, idx) {
    s.addEventListener('click', function() {
      if (!isDeck() || idx === deckIndex) return;
      setDeck(idx);
    });
  });
  // Every card (the first included) runs the same beat through focusHeroCard: it paints on its
  // Before face in the markup, then — once it's the centered card — holds 2s, flips to the Reveal,
  // and plays. The first beat (and the one-time headline-rotator kickoff on that first reveal) is
  // triggered by syncHeroLoop → updateDots on load, after the carousel rests on the first slide.

  // Hero carousel — Layout B: 9 static flip cards (3 projects × Reveal A/B/C). No auto-cycle;
  // swipe to advance, tap the Before/Reveal button to flip a card. Assigned below; the layout
  // toggle calls it the first time Layout B is shown (it starts hidden under Layout A).
  var playLayoutBIntro = function() {};
  var carouselB = document.getElementById('carousel-b');
  var dotsB = document.querySelectorAll('#dots-b .dot');
  if (carouselB) {
    var bFlipCards = carouselB.querySelectorAll('.flip-card');
    function setBCardFlipped(card, flipped) {
      card.classList.toggle('flipped', flipped);
      card.querySelectorAll('.hero-before-btn').forEach(function(b) {
        b.setAttribute('aria-pressed', flipped ? 'true' : 'false');
      });
    }
    bFlipCards.forEach(function(card) {
      card.querySelectorAll('.hero-before-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          setBCardFlipped(card, !card.classList.contains('flipped'));
        });
      });
    });
    function updateDotsB() {
      var i = Math.round(carouselB.scrollLeft / carouselB.clientWidth);
      dotsB.forEach(function(d, j) { d.classList.toggle('active', j === i); });
      // A card scrolled away from center resets to its reveal (front) side, so every card
      // comes back into view on the reveal — the user always flips to see the before.
      bFlipCards.forEach(function(card, j) {
        if (j !== i && card.classList.contains('flipped')) setBCardFlipped(card, false);
      });
    }
    carouselB.addEventListener('scroll', updateDotsB, { passive: true });
    dotsB.forEach(function(d, i) {
      d.addEventListener('click', function() {
        carouselB.scrollTo({ left: i * carouselB.clientWidth, behavior: 'smooth' });
      });
    });
    // One-time intro: the first card loads showing its Before, then flips to the reveal after
    // 1s. Setting .flipped while the frame is still hidden means the first paint shows the
    // before with no flip-in; removing it 1s later animates the reveal. Only card 1, only once.
    var bIntroPlayed = false;
    playLayoutBIntro = function() {
      if (bIntroPlayed || !bFlipCards.length) return;
      bIntroPlayed = true;
      // B's hero videos ship inert (no autoplay/preload/poster) so the hidden frame
      // costs nothing on page load — wake them the first time B becomes visible.
      carouselB.querySelectorAll('video[data-poster]').forEach(function(v) {
        v.poster = v.getAttribute('data-poster');
        v.preload = 'auto';
        try { v.play(); } catch (e) {}
      });
      setBCardFlipped(bFlipCards[0], true);
      setTimeout(function() { setBCardFlipped(bFlipCards[0], false); }, 1000);
    };
  }

  // Why Premodel — IG-style case study carousel + modal
  var igCarousel = document.getElementById('project-carousel');
  if (igCarousel) {
    var igDots = document.querySelectorAll('#project-dots .project-dot');
    function updateIgDots() {
      // Start-aligned rail: the last slides can't reach scrollLeft = i * stride, so
      // treat the end of the scroll range as the last dot.
      var maxScroll = igCarousel.scrollWidth - igCarousel.clientWidth;
      var i = (maxScroll - igCarousel.scrollLeft < 2)
        ? igDots.length - 1
        : Math.min(Math.round(igCarousel.scrollLeft / slideStride(igCarousel)), igDots.length - 1);
      igDots.forEach(function(d, j) { d.classList.toggle('active', j === i); });
    }
    igCarousel.addEventListener('scroll', updateIgDots, { passive: true });
    igDots.forEach(function(d, i) {
      d.addEventListener('click', function() {
        igCarousel.scrollTo({ left: i * slideStride(igCarousel), behavior: 'smooth' });
      });
    });
  }

  // Desktop/tablet header nav: smooth-scroll the phone scroller to the section,
  // without dirtying the URL hash.
  document.querySelectorAll('[data-nav-target]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.preventDefault();
      var t = document.getElementById(el.getAttribute('data-nav-target'));
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Why Premodel — IG-style carousel + dots (Layout B)
  var igCarouselB = document.getElementById('project-carousel-b');
  if (igCarouselB) {
    var igDotsB = document.querySelectorAll('#project-dots-b .project-dot');
    function updateIgDotsB() {
      var i = Math.round(igCarouselB.scrollLeft / igCarouselB.clientWidth);
      igDotsB.forEach(function(d, j) { d.classList.toggle('active', j === i); });
    }
    igCarouselB.addEventListener('scroll', updateIgDotsB, { passive: true });
    igDotsB.forEach(function(d, i) {
      d.addEventListener('click', function() {
        igCarouselB.scrollTo({ left: i * igCarouselB.clientWidth, behavior: 'smooth' });
      });
    });
  }

  var caseModal = document.getElementById('case-modal');
  var caseModalName = document.getElementById('case-modal-name');
  var caseModalAvatar = document.getElementById('case-modal-avatar');
  var caseModalMeta = document.getElementById('case-modal-meta');
  var caseModalQuote = document.getElementById('case-modal-quote');
  var caseModalBody = document.getElementById('case-modal-body');
  var caseModalDelivered = document.getElementById('case-modal-delivered');
  var caseModalDeliveredList = document.getElementById('case-modal-delivered-list');
  var caseModalClose = document.getElementById('case-modal-close');
  // Tablet/desktop render the modal as a two-column dialog (display:grid) — the
  // bottom-sheet behaviors (reel padding, tap/swipe expand) only apply when stacked.
  function caseModalColumns() {
    return caseModal && getComputedStyle(caseModal).display === 'grid';
  }
  function buildCaseModalReel(slide, reel) {
    if (!reel) return;
    reel.innerHTML = '';
    var labels = slide.dataset.imageLabels ? slide.dataset.imageLabels.split('·').map(function(l) { return l.trim(); }) : [];
    function addLabel(div, index) {
      var text = labels[index] || '';
      if (!text) return;
      var chip = document.createElement('span');
      chip.className = 'case-modal-img-label';
      chip.textContent = text;
      div.appendChild(chip);
    }
    if (slide.dataset.images) {
      var images = JSON.parse(slide.dataset.images);
      images.forEach(function(img, i) {
        var div = document.createElement('div');
        div.className = 'case-modal-img';
        if (img.src) {
          var el;
          if (img.type === 'video') {
            div.classList.add('case-modal-img--video');
            el = document.createElement('video');
            el.src = img.src;
            el.autoplay = true;
            el.loop = true;
            el.muted = true;
            el.playsInline = true;
            el.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          } else {
            el = document.createElement('img');
            el.loading = 'lazy';        // the reel can be 20+ full-res renders — fetch as scrolled
            el.decoding = 'async';
            el.src = img.src;
            el.alt = img.alt || '';
            el.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          }
          div.appendChild(el);
        }
        addLabel(div, i);
        reel.appendChild(div);
      });
    } else {
      var count = parseInt(slide.dataset.imageCount, 10) || 5;
      for (var i = 0; i < count; i++) {
        var div = document.createElement('div');
        div.className = 'case-modal-img';
        addLabel(div, i);
        reel.appendChild(div);
      }
    }
  }
  // Headline reads "<Name>'s <room> premodel"; the smaller line is just the location with
  // state (visitors come from outside the area). Room words are lowercased except acronyms
  // like "ADU". Meta is authored as "Room · City".
  // Custom case-study headlines, shared by the gallery caption and the modal. Falls back to the
  // generated "<Name>'s <room> premodel" for anything not listed.
  var CASE_TITLES = {
    'Anna G.': "Anna G.'s master bath reconfigure",
    'Sasha A.': "Sasha A.'s full floor reconfigure",
    'K.B.': "K.B.'s new-build kitchen",
    'Jenn S.': "Jenn S.'s basement reconfigure"
  };
  function caseStudyTitle(name, meta) {
    if (name && CASE_TITLES[name]) return CASE_TITLES[name];
    var room = (meta || '').split('·')[0].trim();
    var roomLc = room.split(' ').map(function(w) {
      return (w === w.toUpperCase() && /[A-Z]/.test(w)) ? w : w.toLowerCase();
    }).join(' ');
    return name ? (name + "'s " + roomLc + ' premodel') : roomLc;
  }
  function caseStudyLocation(meta) {
    var parts = (meta || '').split('·').map(function(s) { return s.trim(); });
    var city = parts[1] || '';
    return city ? (city + ', WA') : '';
  }
  // Each gallery card's lower-left caption mirrors the case-study modal headline it opens
  // ("<Name>'s <room> premodel"), collapsed to a single line.
  (function syncGalleryCaptions() {
    var gallery = document.getElementById('project-carousel');
    if (!gallery) return;
    gallery.querySelectorAll('.project-slide').forEach(function(slide) {
      var ov = slide.querySelector('.project-overlay');
      if (!ov) return;
      ov.innerHTML = '<p class="project-name"></p>';
      ov.querySelector('.project-name').textContent = caseStudyTitle(slide.dataset.name, slide.dataset.meta);
    });
  })();
  var caseModalCard = document.getElementById('case-modal-card');
  var caseModalImageReel = document.getElementById('case-modal-images');
  // Bottom-sheet geometry (mobile/stacked layout only). peek = resting height; full = expanded.
  var SHEET_EASE = 'cubic-bezier(0.32,0.72,0,1)';
  function modalH() { return caseModal ? (caseModal.getBoundingClientRect().height || caseModal.offsetHeight) : 0; }
  function peekH() { return Math.round(modalH() * 0.52); }
  function fullH() { return Math.round(modalH() - 60); }
  // Minimized detent: just the drag handle + head (avatar, name, meta) showing. Content is
  // top-aligned, so the head's offset from the card top is stable regardless of card height.
  function miniH() {
    if (!caseModalCard) return Math.round(modalH() * 0.16);
    var head = caseModalCard.querySelector('.case-modal-head');
    if (!head) return Math.round(modalH() * 0.16);
    return Math.round(head.getBoundingClientRect().bottom - caseModalCard.getBoundingClientRect().top + 16);
  }
  function syncReelPadding() {
    if (caseModalImageReel) caseModalImageReel.style.paddingBottom = caseModalColumns() ? '' : caseModalCard.offsetHeight + 'px';
  }
  function setCardHeight(px, animate) {
    if (!caseModalCard) return;
    caseModalCard.style.transition = animate ? ('height 0.34s ' + SHEET_EASE) : 'none';
    caseModalCard.style.height = px + 'px';
  }
  function openCaseModal(slide) {
    if (!caseModal) return;
    caseModalName.textContent = caseStudyTitle(slide.dataset.name, slide.dataset.meta);
    if (caseModalAvatar) {
      var initials = (slide.dataset.name || '').replace(/[^a-zA-Z\s]/g, ' ').trim().split(/\s+/)
        .map(function(w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
      caseModalAvatar.textContent = initials;
    }
    caseModalMeta.textContent = caseStudyLocation(slide.dataset.meta);
    if (caseModalQuote) caseModalQuote.textContent = slide.dataset.quote || '';
    if (caseModalBody) caseModalBody.innerHTML = slide.dataset.body || '';
    if (caseModalDeliveredList) {
      caseModalDeliveredList.innerHTML = '';
      if (slide.dataset.delivered) {
        slide.dataset.delivered.split('·').forEach(function(item) {
          var li = document.createElement('li');
          li.className = 'case-modal-delivered-item';
          li.textContent = item.trim();
          caseModalDeliveredList.appendChild(li);
        });
      }
    }
    if (caseModalDelivered) caseModalDelivered.style.display = slide.dataset.delivered ? '' : 'none';
    buildCaseModalReel(slide, caseModalImageReel);
    caseModal.classList.add('open');
    caseModal.setAttribute('aria-hidden', 'false');
    caseModalCard.classList.remove('expanded');
    var columns = caseModalColumns();
    // Present like a native sheet: the whole panel slides up from the bottom and fades in.
    // (Columns/desktop dialog just cross-fades — its card is a fixed grid cell, not a sheet.)
    caseModal.style.transition = 'none';
    caseModal.style.opacity = '0';
    if (!columns) { setCardHeight(peekH(), false); caseModal.style.transform = 'translateY(100%)'; }
    else { caseModalCard.style.transition = ''; caseModalCard.style.height = ''; caseModal.style.transform = ''; }
    // Commit the hidden pre-state with a forced reflow, then flip to the visible state in the same
    // tick. The committed reflow lets the transition run without depending on requestAnimationFrame.
    void caseModal.offsetWidth;
    caseModal.style.transition = 'opacity 0.3s ease' + (columns ? '' : ', transform 0.42s ' + SHEET_EASE);
    caseModal.style.opacity = '1';
    caseModal.style.transform = columns ? '' : 'translateY(0)';
    if (caseModalImageReel) caseModalImageReel.scrollTop = 0;
    var cs = document.getElementById('case-modal-card-scroll'); if (cs) cs.scrollTop = 0;
    syncReelPadding();
  }
  function closeCaseModal() {
    if (!caseModal || !caseModal.classList.contains('open')) return;
    var columns = caseModalColumns();
    var done = false;
    function finish() {
      if (done) return; done = true;
      caseModal.removeEventListener('transitionend', onEnd);
      caseModal.classList.remove('open');
      caseModal.setAttribute('aria-hidden', 'true');
      caseModal.style.transition = ''; caseModal.style.opacity = ''; caseModal.style.transform = '';
      caseModalCard.style.transition = ''; caseModalCard.style.height = ''; caseModalCard.style.transform = '';
      caseModalCard.classList.remove('expanded');
      if (caseModalImageReel) { caseModalImageReel.scrollTop = 0; caseModalImageReel.style.paddingBottom = ''; }
      var cs = document.getElementById('case-modal-card-scroll'); if (cs) cs.scrollTop = 0;
    }
    function onEnd(e) { if (e && e.target !== caseModal) return; finish(); }
    caseModal.style.transition = 'opacity 0.3s ease' + (columns ? '' : ', transform 0.34s cubic-bezier(0.4,0,1,1)');
    caseModal.style.opacity = '0';
    if (!columns) caseModal.style.transform = 'translateY(100%)';
    caseModal.addEventListener('transitionend', onEnd);
    setTimeout(onEnd, 420);
  }
  // Layout A slides → #case-modal
  document.querySelectorAll('#project-carousel .project-slide').forEach(function(slide) {
    slide.addEventListener('click', function(e) {
      if (e.target.closest('.project-link')) return;
      openCaseModal(slide);
    });
  });
  if (caseModalClose) caseModalClose.addEventListener('click', closeCaseModal);
  if (caseModal) caseModal.addEventListener('click', function(e) { if (e.target === caseModal) closeCaseModal(); });

  // ── Native bottom-sheet gestures (stacked layout only) ──────────────────────
  // Text card: follows the finger between three detents — mini (head only), peek (quote), and
  // full (reading). Dragging it NEVER closes the modal; it just resizes and snaps to the nearest
  // detent. Image reel: pulling down when scrolled to the top closes the modal, and scrolling up
  // into the images minimizes the text card so more photos show. overscroll-behavior (CSS) keeps
  // these pulls from triggering Safari's pull-to-refresh.
  if (caseModalCard && caseModalImageReel) {
    caseModalCard.addEventListener('transitionend', function(e) {
      if (e.propertyName === 'height') syncReelPadding();
    });
    function snapCard(h, vy) {
      var detents = [miniH(), peekH(), fullH()];
      var projected = h + (-vy) * 100;               // project the flick so a quick swipe carries
      var target = detents.reduce(function(a, b) { return Math.abs(b - projected) < Math.abs(a - projected) ? b : a; });
      setCardHeight(target, true);
      caseModalCard.classList.toggle('expanded', target === fullH());
    }

    var dragging = false, decided = false, moved = false, startY = 0, startH = 0, lastY = 0, lastT = 0, vy = 0;
    caseModalCard.addEventListener('touchstart', function(e) {
      if (caseModalColumns()) return;
      dragging = true; decided = false; moved = false;
      startY = e.touches[0].clientY; lastY = startY; lastT = Date.now();
      startH = caseModalCard.offsetHeight; vy = 0;
    }, { passive: true });
    caseModalCard.addEventListener('touchmove', function(e) {
      if (!dragging) return;
      var y = e.touches[0].clientY, dy = y - startY;
      if (!decided) {
        if (Math.abs(dy) < 4) return;
        var cs = document.getElementById('case-modal-card-scroll');
        // When expanded, hand the gesture to the inner scroll unless we're at the very top and
        // pulling DOWN (the intent to collapse the panel).
        if (caseModalCard.classList.contains('expanded') && (dy < 0 || (cs && cs.scrollTop > 0))) { dragging = false; return; }
        decided = true; moved = true; caseModalCard.style.transition = 'none';
      }
      var h = startH - dy, maxH = fullH(), minH = miniH();
      if (h > maxH) h = maxH + (h - maxH) * 0.18;    // rubber-band past full
      if (h < minH) h = minH - (minH - h) * 0.18;    // rubber-band at mini — never drag to dismiss
      caseModalCard.style.height = h + 'px';
      if (e.cancelable) e.preventDefault();
      var now = Date.now(), dt = now - lastT; if (dt > 0) vy = (y - lastY) / dt; lastY = y; lastT = now;
    }, { passive: false });
    function endCardDrag() {
      if (!dragging) return; dragging = false;
      if (!moved) return;                            // a tap → let click handle it
      snapCard(caseModalCard.offsetHeight, vy);
    }
    caseModalCard.addEventListener('touchend', endCardDrag, { passive: true });
    caseModalCard.addEventListener('touchcancel', endCardDrag, { passive: true });
    caseModalCard.addEventListener('click', function() {
      if (caseModalColumns() || moved) return;       // tap cycles up: mini/peek → full
      if (!caseModalCard.classList.contains('expanded')) { setCardHeight(fullH(), true); caseModalCard.classList.add('expanded'); }
    });

    var reelDrag = false, reelDY = 0;
    caseModalImageReel.addEventListener('touchstart', function(e) {
      if (caseModalColumns()) return;
      if (caseModalImageReel.scrollTop <= 0) { reelDrag = true; reelDY = 0; startY = e.touches[0].clientY; caseModal.style.transition = 'none'; }
    }, { passive: true });
    caseModalImageReel.addEventListener('touchmove', function(e) {
      if (!reelDrag) return;
      reelDY = e.touches[0].clientY - startY;
      if (reelDY > 0) {
        if (e.cancelable) e.preventDefault();
        caseModal.style.transform = 'translateY(' + (reelDY * 0.6) + 'px)';
        caseModal.style.opacity = String(Math.max(0.5, 1 - reelDY / 700));
      } else { reelDrag = false; caseModal.style.transition = ''; caseModal.style.transform = ''; caseModal.style.opacity = ''; }
    }, { passive: false });
    function endReelDrag() {
      if (!reelDrag) return; reelDrag = false;
      if (reelDY > 110) { closeCaseModal(); return; }   // pull-down at top dismisses
      caseModal.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      caseModal.style.transform = 'translateY(0)'; caseModal.style.opacity = '1';
    }
    caseModalImageReel.addEventListener('touchend', endReelDrag, { passive: true });
    caseModalImageReel.addEventListener('touchcancel', endReelDrag, { passive: true });
    // Scrolling up into the images minimizes the text card so more photos are visible.
    caseModalImageReel.addEventListener('scroll', function() {
      if (caseModalColumns()) return;
      if (caseModalImageReel.scrollTop > 6 && caseModalCard.offsetHeight > miniH() + 4) {
        setCardHeight(miniH(), true); caseModalCard.classList.remove('expanded');
      }
    }, { passive: true });

    window.addEventListener('resize', function() {
      if (!caseModal.classList.contains('open') || caseModalColumns()) return;
      setCardHeight(caseModalCard.classList.contains('expanded') ? fullH() : peekH(), false);
      syncReelPadding();
    });
  }

  // Layout B slides → #case-modal-b
  var caseModalB = document.getElementById('case-modal-b');
  var caseModalBName = document.getElementById('case-modal-b-name');
  var caseModalBMeta = document.getElementById('case-modal-b-meta');
  var caseModalBQuote = document.getElementById('case-modal-b-quote');
  var caseModalBBody = document.getElementById('case-modal-b-body');
  var caseModalBDelivered = document.getElementById('case-modal-b-delivered');
  var caseModalBDeliveredList = document.getElementById('case-modal-b-delivered-list');
  var caseModalBClose = document.getElementById('case-modal-b-close');
  function openCaseModalB(slide) {
    if (!caseModalB) return;
    caseModalBName.textContent = slide.dataset.name || '';
    caseModalBMeta.textContent = slide.dataset.meta || '';
    if (caseModalBQuote) caseModalBQuote.textContent = slide.dataset.quote || '';
    if (caseModalBBody) caseModalBBody.innerHTML = slide.dataset.body || '';
    if (caseModalBDeliveredList) {
      caseModalBDeliveredList.innerHTML = '';
      if (slide.dataset.delivered) {
        slide.dataset.delivered.split('·').forEach(function(item) {
          var li = document.createElement('li');
          li.className = 'case-modal-delivered-item';
          li.textContent = item.trim();
          caseModalBDeliveredList.appendChild(li);
        });
      }
    }
    if (caseModalBDelivered) caseModalBDelivered.style.display = slide.dataset.delivered ? '' : 'none';
    buildCaseModalReel(slide, document.getElementById('case-modal-b-images'));
    caseModalB.classList.add('open');
    caseModalB.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function() {
      var reel = document.getElementById('case-modal-b-images');
      var card = document.getElementById('case-modal-b-card');
      if (reel) reel.scrollTop = 0;
      if (card) card.scrollTop = 0;
      if (reel && card) reel.style.paddingBottom = card.offsetHeight + 'px';
    });
  }
  function closeCaseModalB() {
    if (!caseModalB) return;
    caseModalB.classList.remove('open');
    caseModalB.setAttribute('aria-hidden', 'true');
    var reel = document.getElementById('case-modal-b-images');
    if (reel) { reel.scrollTop = 0; reel.style.paddingBottom = ''; }
    var card = document.getElementById('case-modal-b-card');
    if (card) { card.classList.remove('expanded'); card.scrollTop = 0; }
  }
  document.querySelectorAll('#project-carousel-b .project-slide').forEach(function(slide) {
    slide.addEventListener('click', function(e) {
      if (e.target.closest('.project-link')) return;
      openCaseModalB(slide);
    });
  });
  if (caseModalBClose) caseModalBClose.addEventListener('click', closeCaseModalB);
  if (caseModalB) caseModalB.addEventListener('click', function(e) { if (e.target === caseModalB) closeCaseModalB(); });

  // Layout B card expand: swipe-up / tap to expand, reel padding syncs after transition
  var caseModalBCard = document.getElementById('case-modal-b-card');
  if (caseModalBCard) {
    var caseModalBImageReel = document.getElementById('case-modal-b-images');
    function syncReelPaddingB() {
      if (caseModalBImageReel) caseModalBImageReel.style.paddingBottom = caseModalBCard.offsetHeight + 'px';
    }
    caseModalBCard.addEventListener('transitionend', function(e) {
      if (e.propertyName === 'height') syncReelPaddingB();
    });
    var touchStartYB = 0;
    caseModalBCard.addEventListener('touchstart', function(e) {
      touchStartYB = e.touches[0].clientY;
    }, { passive: true });
    caseModalBCard.addEventListener('touchend', function(e) {
      var delta = touchStartYB - e.changedTouches[0].clientY;
      if (delta > 20) caseModalBCard.classList.add('expanded');
      else if (delta < -20) caseModalBCard.classList.remove('expanded');
    }, { passive: true });
    caseModalBCard.addEventListener('click', function() {
      if (!caseModalBCard.classList.contains('expanded')) caseModalBCard.classList.add('expanded');
    });
    if (caseModalBImageReel) {
      caseModalBImageReel.addEventListener('click', function() {
        caseModalBCard.classList.remove('expanded');
      });
    }
  }

  // Why Premodel — proof numbers count up sequentially the first time they scroll into view
  (function initProofAnimation() {
    var proofEl = document.querySelector('.why-proof');
    if (!proofEl || !('IntersectionObserver' in window)) return;
    var nums = proofEl.querySelectorAll('.why-proof-num');
    if (nums.length < 3) return;
    var triggered = false;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function tickInt(el, end, prefix, suffix, duration) {
      return new Promise(function(resolve) {
        var start = performance.now();
        var last = -1;
        el.textContent = prefix + '0' + suffix;
        function frame(now) {
          var t = Math.min((now - start) / duration, 1);
          var v = Math.floor(easeOut(t) * end);
          if (t === 1) v = end;
          if (v !== last) { el.textContent = prefix + v + suffix; last = v; }
          if (t < 1) { requestAnimationFrame(frame); }
          else { resolve(); }
        }
        requestAnimationFrame(frame);
      });
    }

    function tickDecimal(el, end, prefix, suffix, duration) {
      return new Promise(function(resolve) {
        var start = performance.now();
        var last = -1;
        el.textContent = prefix + (0).toFixed(1) + suffix;
        function frame(now) {
          var t = Math.min((now - start) / duration, 1);
          var v = Math.round(easeOut(t) * end * 10) / 10;
          if (t === 1) v = end;
          if (v !== last) { el.textContent = prefix + v.toFixed(1) + suffix; last = v; }
          if (t < 1) { requestAnimationFrame(frame); }
          else { resolve(); }
        }
        requestAnimationFrame(frame);
      });
    }

    function run() {
      tickInt(nums[0], 20, '', '+', 1200)
        .then(function() { return tickInt(nums[1], 12, '', '×', 1100); })
        .then(function() { return tickDecimal(nums[2], 1.2, '>', 'K', 1100); });
    }

    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !triggered) {
          triggered = true;
          run();
          io.disconnect();
        }
      });
    }, { root: scrollEl, threshold: 0.4 });
    io.observe(proofEl);
  })();

  var toggleButtons = document.querySelectorAll('.toggle-btn[data-layout]');
  var phoneFrames = document.querySelectorAll('.phone-frame');
  toggleButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var layout = btn.getAttribute('data-layout');
      toggleButtons.forEach(function(b) {
        var isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      phoneFrames.forEach(function(frame) {
        frame.hidden = frame.getAttribute('data-layout') !== layout;
        // Restore the cta-bar on the newly visible frame so the IO can take over
        if (!frame.hidden) {
          var bar = frame.querySelector('.cta-bar');
          if (bar) bar.style.display = '';
        }
      });
      // Play the one-time hero intro the first time Layout B becomes visible (same tick as
      // un-hiding it, so card 1's first paint already shows the before — no flip-in).
      if (layout === 'b') playLayoutBIntro();
    });
  });

  // ── Theme toggle (Auto / Light / Dark) ────────────────────────────────
  // Auto = remove the attribute and honor the OS preference; Light/Dark force
  // the theme via :root[data-theme="..."] (see the dark-theme CSS block).
  var themeButtons = document.querySelectorAll('.toggle-btn[data-theme-choice]');
  themeButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var choice = btn.getAttribute('data-theme-choice');
      if (choice === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', choice);
      themeButtons.forEach(function(b) {
        var isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    });
  });

  var quotesEl = document.querySelector('.quotes');
  function updateQuoteSpread() {
    if (!quotesEl) return;
    var rect = quotesEl.getBoundingClientRect();
    var scrollRect = scrollEl.getBoundingClientRect();
    var sectionTop = rect.top - scrollRect.top;
    var viewportHeight = scrollRect.height;
    var triggerStart = viewportHeight;
    var triggerEnd = viewportHeight * 0.3;
    var progress = (triggerStart - sectionTop) / (triggerStart - triggerEnd);
    progress = Math.max(0, Math.min(1, progress));
    quotesEl.style.setProperty('--spread', progress);
  }
  scrollEl.addEventListener('scroll', updateQuoteSpread, { passive: true });
  updateQuoteSpread();

  var scrollElB = document.getElementById('scroll-b');

  var stepsB = scrollElB ? scrollElB.querySelectorAll('.step') : [];
  function updateStepsB() {
    if (!scrollElB) return;
    var r = scrollElB.getBoundingClientRect();
    var center = r.top + r.height * 0.45;
    var best = null, bestDist = Infinity;
    stepsB.forEach(function(s) {
      var sr = s.getBoundingClientRect();
      var sc = sr.top + sr.height / 2;
      var d = Math.abs(sc - center);
      if (d < bestDist) { bestDist = d; best = s; }
    });
    stepsB.forEach(function(s) { s.classList.toggle('active', s === best); });
  }
  if (scrollElB) scrollElB.addEventListener('scroll', updateStepsB, { passive: true });
  updateStepsB();

  var cyclingEl = document.getElementById('b-cycling-headline');
  if (cyclingEl) {
    var cyclingPhrases = ['Before the guesswork.', 'Before the commitment.', 'Before the construction.'];
    var cyclingIdx = 0;
    cyclingEl.style.transition = 'opacity 0.4s ease';
    setInterval(function() {
      cyclingIdx = (cyclingIdx + 1) % cyclingPhrases.length;
      cyclingEl.style.opacity = '0';
      setTimeout(function() {
        cyclingEl.textContent = cyclingPhrases[cyclingIdx];
        cyclingEl.style.opacity = '1';
      }, 400);
    }, 2500);
  }

  var quotesEls = document.querySelectorAll('.quotes');
  var quotesElB = quotesEls.length > 1 ? quotesEls[1] : null;
  function updateQuoteSpreadB() {
    if (!quotesElB || !scrollElB) return;
    var rect = quotesElB.getBoundingClientRect();
    var scrollRect = scrollElB.getBoundingClientRect();
    var sectionTop = rect.top - scrollRect.top;
    var viewportHeight = scrollRect.height;
    var triggerStart = viewportHeight;
    var triggerEnd = viewportHeight * 0.3;
    var progress = (triggerStart - sectionTop) / (triggerStart - triggerEnd);
    progress = Math.max(0, Math.min(1, progress));
    quotesElB.style.setProperty('--spread', progress);
  }
  if (scrollElB) scrollElB.addEventListener('scroll', updateQuoteSpreadB, { passive: true });
  updateQuoteSpreadB();

  // Why Premodel — proof numbers count up (Layout B)
  (function initProofAnimationB() {
    var proofEls = document.querySelectorAll('.why-proof');
    var proofElB = proofEls.length > 1 ? proofEls[1] : null;
    if (!proofElB || !scrollElB || !('IntersectionObserver' in window)) return;
    var nums = proofElB.querySelectorAll('.why-proof-num');
    if (nums.length < 3) return;
    var triggered = false;

    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    function tickInt(el, end, prefix, suffix, duration) {
      return new Promise(function(resolve) {
        var start = performance.now();
        var last = -1;
        el.textContent = prefix + '0' + suffix;
        function frame(now) {
          var t = Math.min((now - start) / duration, 1);
          var v = Math.floor(easeOut(t) * end);
          if (t === 1) v = end;
          if (v !== last) { el.textContent = prefix + v + suffix; last = v; }
          if (t < 1) { requestAnimationFrame(frame); }
          else { resolve(); }
        }
        requestAnimationFrame(frame);
      });
    }

    function tickDecimal(el, end, prefix, suffix, duration) {
      return new Promise(function(resolve) {
        var start = performance.now();
        var last = -1;
        el.textContent = prefix + (0).toFixed(1) + suffix;
        function frame(now) {
          var t = Math.min((now - start) / duration, 1);
          var v = Math.round(easeOut(t) * end * 10) / 10;
          if (t === 1) v = end;
          if (v !== last) { el.textContent = prefix + v.toFixed(1) + suffix; last = v; }
          if (t < 1) { requestAnimationFrame(frame); }
          else { resolve(); }
        }
        requestAnimationFrame(frame);
      });
    }

    function run() {
      tickInt(nums[0], 20, '', '+', 1200)
        .then(function() { return tickInt(nums[1], 12, '', '×', 1100); })
        .then(function() { return tickDecimal(nums[2], 1.2, '>', 'K', 1100); });
    }

    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting && !triggered) {
          triggered = true;
          run();
          io.disconnect();
        }
      });
    }, { root: scrollElB, threshold: 0.4 });
    io.observe(proofElB);
  })();

  // Why Premodel — scrollytelling cost-of-change chart (Layout A)
  (function initChartScrolly() {
    var scrolly = document.getElementById('cc-scrolly');
    if (!scrolly || !scrollEl) return;
    var track = scrolly.querySelector('.cc-track');
    var sticky = scrolly.querySelector('.cc-sticky');
    var gline = scrolly.querySelector('.cc-gline');
    var bline = scrolly.querySelector('.cc-bline');
    var fill = scrolly.querySelector('.cc-fill');
    var wedge = scrolly.querySelector('.cc-wedge');
    var wedgeClip = scrolly.querySelector('.cc-wedge-clip-rect');
    var risk = scrolly.querySelector('.cc-risk');
    var founders = scrolly.querySelector('.why-founders');
    var photo = scrolly.querySelector('.cc-photo');
    var beats = Array.prototype.slice.call(scrolly.querySelectorAll('.cc-beat'));
    var pins = {
      g1: scrolly.querySelector('[data-pin="g1"]'),
      g2: scrolly.querySelector('[data-pin="g2"]'),
      g3: scrolly.querySelector('[data-pin="g3"]'),
      g4: scrolly.querySelector('[data-pin="g4"]'),
      g5: scrolly.querySelector('[data-pin="g5"]'),
      img: scrolly.querySelector('[data-pin="img"]'),
      end: scrolly.querySelector('[data-pin="end"]')
    };

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function lerpSeg(g, pts) {                 // piecewise-linear over [[gx, val], ...], gx ascending
      if (g <= pts[0][0]) return pts[0][1];
      for (var i = 1; i < pts.length; i++) {
        if (g <= pts[i][0]) {
          var t = (g - pts[i-1][0]) / (pts[i][0] - pts[i-1][0]);
          return pts[i-1][1] + (pts[i][1] - pts[i-1][1]) * t;
        }
      }
      return pts[pts.length - 1][1];
    }
    function lengthAtX(path, total, targetX) { // x is monotonic along these paths -> binary search
      var lo = 0, hi = total;
      for (var i = 0; i < 24; i++) {
        var mid = (lo + hi) / 2;
        if (path.getPointAtLength(mid).x < targetX) lo = mid; else hi = mid;
      }
      return hi;
    }
    function pctAtLength(path, len) {          // viewBox 405x300 -> percentage coords for overlay
      var p = path.getPointAtLength(len);
      return { l: p.x / 405 * 100, t: p.y / 300 * 100 };
    }

    var gTotal = gline.getTotalLength();
    var bTotal = bline.getTotalLength();
    gline.style.strokeDasharray = gTotal;
    bline.style.strokeDasharray = bTotal;

    // Gray dots (SVG x): 1 at Hire, 2 at Plan, 3 between Plan and Build, 4 halfway between dots 3 and 5,
    // 5 at the end. The line STARTS at dot 1 (frame 1 shows with dot 1 already in place) and then reaches
    // one dot per frame, so each text flips exactly as the line arrives at the matching dot.
    var gDrawX = [150, 254, 307, 348, 405];
    var gFrac = gDrawX.map(function(x) { return lengthAtX(gline, gTotal, x) / gTotal; });
    var gPinX = gDrawX.slice();
    var gPinLen = gPinX.map(function(x) { return lengthAtX(gline, gTotal, x); });
    // Accent (Premodel) line draws an early branch (frame 6) then the rest through Plan/Build (frame 7).
    var bLenEarly = lengthAtX(bline, bTotal, 97);    // halfway Imagine..Hire — the reveal/image marker
    var bFracEarly = bLenEarly / bTotal;

    // Pin positions (gray pins at each gray draw tip; image/end pins along the accent line)
    function place(pin, pos) { pin.style.left = clamp(pos.l, 3, 97) + '%'; pin.style.top = clamp(pos.t, 3, 97) + '%'; }
    place(pins.g1, pctAtLength(gline, gPinLen[0]));
    place(pins.g2, pctAtLength(gline, gPinLen[1]));
    place(pins.g3, pctAtLength(gline, gPinLen[2]));
    place(pins.g4, pctAtLength(gline, gPinLen[3]));
    place(pins.g5, pctAtLength(gline, gPinLen[4]));
    pins.g5.style.left = '96%';    // pull the end-of-build dot in so it isn't cropped by the right edge
    var imgPos = pctAtLength(bline, bLenEarly);
    place(pins.img, imgPos);
    place(pins.end, pctAtLength(bline, bTotal));
    pins.end.style.left = '96%';   // pull the final dot in so it isn't cropped by the right edge
    // Reveal card position/size is set in CSS (.cc-photo); JS only fades it in on frame 6.

    // Tap a dot to jump to that moment in the chart (each maps to the middle of its caption window)
    var pinTargetG = { g1: 0.5, g2: 1.5, g3: 2.5, g4: 3.5, g5: 4.5, img: 5.5, end: 6.5 };
    function jumpToG(G) {
      var runway = scrolly.offsetHeight - scrollEl.clientHeight;
      if (runway <= 0) return;
      scrollEl.scrollTo({ top: scrolly.offsetTop + (G / 7) * runway, behavior: 'smooth' });
    }
    Object.keys(pins).forEach(function(key) {
      var p = pins[key];
      if (!p) return;
      p.setAttribute('role', 'button');
      p.setAttribute('aria-label', 'Jump to this moment in the chart');
      p.addEventListener('click', function() { jumpToG(pinTargetG[key]); });
      p.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jumpToG(pinTargetG[key]); }
      });
    });

    var captionForBeat = [1, 2, 3, 4, 5, 6, 7];   // frame index 0..6 -> data-beat value shown (1:1)
    function setCaption(idx) {
      var want = String(captionForBeat[clamp(idx, 0, 6)]);
      beats.forEach(function(b) { b.classList.toggle('active', b.getAttribute('data-beat') === want); });
    }
    function setPin(pin, op) {
      pin.style.opacity = op;
      pin.style.transform = 'scale(' + (0.6 + 0.4 * op) + ')';
      var on = op > 0.05;                         // only visible dots are tappable / focusable
      pin.style.pointerEvents = on ? 'auto' : 'none';
      pin.setAttribute('tabindex', on ? '0' : '-1');
    }

    function render(g) {                       // g in [0..7]
      // Line draw-on. The gray "typical" stress line STARTS at dot 1 (g=0) and reaches one dot per
      // frame (dot N at g=N-1), so dots 1..5 land at g 0,1,2,3,4 and each text flips as the line arrives.
      // After dot 5 the chart holds (g 4..5), then the accent "Premodel" line draws its early branch
      // (frame 6, g 5..6) and the rest through Plan/Build (frame 7, g 6..7).
      var gDraw = lerpSeg(g, [[0,gFrac[0]],[1,gFrac[1]],[2,gFrac[2]],[3,gFrac[3]],[4,gFrac[4]]]);
      gline.style.strokeDashoffset = gTotal * (1 - gDraw);
      bline.style.strokeDashoffset = bTotal * (1 - lerpSeg(g, [[5,0],[6,bFracEarly],[7,1]]));
      // Dim the gray path slightly once the Premodel path starts (frame 6), so the accent reads first.
      var grayDim = clamp(1 - (g - 5) / 0.5 * 0.5, 0.5, 1);
      gline.style.opacity = grayDim;
      // Gray emotion pins land with the line at each dot (dot 1 is shown from the very start) and
      // accumulate, then fade out COMPLETELY as the Premodel line animates in (frame 6).
      var grayPinFade = clamp(1 - (g - 5) / 0.5, 0, 1);
      setPin(pins.g1, clamp((g + 0.2) / 0.2, 0, 1) * grayPinFade);
      setPin(pins.g2, clamp((g - 0.8) / 0.2, 0, 1) * grayPinFade);
      setPin(pins.g3, clamp((g - 1.8) / 0.2, 0, 1) * grayPinFade);
      setPin(pins.g4, clamp((g - 2.8) / 0.2, 0, 1) * grayPinFade);
      setPin(pins.g5, clamp((g - 3.8) / 0.2, 0, 1) * grayPinFade);
      // Frame 6: image/reveal marker + Excited pin appear as the accent line branches, and stay
      var imgShow = clamp((g - 5.15) / 0.5, 0, 1);
      setPin(pins.img, imgShow);
      photo.style.opacity = imgShow;
      // Old-way fill (.cc-wedge): revealed left-to-right in step with the gray line's growth
      // (frames 0→4), so the shaded area fills in under the line as it climbs and then holds.
      var oldTipX = lerpSeg(g, [[0,150],[1,254],[2,307],[3,348],[4,405]]);
      wedgeClip.setAttribute('width', oldTipX);
      wedge.style.opacity = 1;
      // Frame 7: Aligned end pin, the Premodel area fill (under the accent line), and the risk label
      var gap = clamp((g - 6.1) / 0.6, 0, 1);
      fill.style.opacity = gap;
      risk.style.opacity = clamp((g - 6.3) / 0.5, 0, 1);
      setPin(pins.end, clamp((g - 6.0) / 0.5, 0, 1));
      setCaption(Math.floor(g));
    }

    function sizeTrack() { track.style.height = (scrollEl.clientHeight * 6.5) + 'px'; }
    function stickyTop() { var t = parseFloat(getComputedStyle(sticky).top); return isNaN(t) ? 0 : t; }
    // Progress over the sticky's ACTUAL pin window. The pinned composition (chart + guides +
    // founder cards) is taller than the viewport, so the sticky unpins once box.bottom passes
    // sticky.bottom — which is box.height - stickyHeight of scroll, NOT box.height - viewportHeight.
    // Measuring against viewport height (the old formula) overran the pin: progress only reached
    // ~0.9 by the time the lock released, so the blue line was still mid-draw. Anchoring the runway
    // to the sticky's own height makes p hit 1 exactly as the lock releases.
    // Unclamped: values >1 mean the sticky has unlocked and the composition is scrolling normally.
    function progress() {
      var host = scrollEl.getBoundingClientRect();
      var box = scrolly.getBoundingClientRect();
      var runway = box.height - sticky.offsetHeight;
      if (runway <= 0) return 0;
      return ((host.top + stickyTop()) - box.top) / runway;
    }
    var ticking = false;
    // Finish the chart just shy of the unlock (COMPLETE_AT) so the blue Premodel line reaches the
    // contented emoji while the screen is still locked, holds a beat fully drawn, then releases.
    var COMPLETE_AT = 0.92;
    function update() {
      var p = progress();
      render(clamp(p / COMPLETE_AT * 7, 0, 7));
      // Founder cards drift vertically apart only AFTER the sticky unlocks (p > 1 = freeze ends),
      // eased out (quart) over the next stretch of scroll so the finish is barely perceptible.
      if (founders) {
        var t = clamp((p - 1) / 0.07, 0, 1);
        founders.style.setProperty('--spread', 1 - Math.pow(1 - t, 4));
      }
      ticking = false;
    }
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

    scrolly.classList.add('cc-ready');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { render(7); return; }          // show the completed chart, final caption
    sizeTrack();
    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function() { sizeTrack(); update(); });
    update();
  })();

  var sizeSelect = document.getElementById('size-select');
  var wrapper = document.querySelector('.prototype-wrapper');
  // Scale-to-fit: tablet/desktop frames keep their true LAYOUT width (so the
  // container-query breakpoints fire correctly) and shrink only visually via
  // transform when wider than the window. Negative margins give back the
  // layout space the transform doesn't, so the page never side-scrolls.
  function fitFrames() {
    // Bare preview lets the frame fill the viewport via CSS; skip scale-to-fit.
    if (document.documentElement.classList.contains('bare')) return;
    var opt = sizeSelect.options[sizeSelect.selectedIndex];
    var w = parseFloat(opt.getAttribute('data-w'));
    var h = parseFloat(opt.getAttribute('data-h'));
    var avail = document.documentElement.clientWidth - 40;
    phoneFrames.forEach(function(f) {
      if (f.getAttribute('data-layout') === 'b') return; // B stays phone-width
      // Fit to height as well as width so the whole device frame stays within the window —
      // otherwise a frame taller than the viewport scrolls and the page shows below an open
      // modal (the modal is absolutely positioned inside the frame, not the viewport).
      var topY = 0, el = f;
      while (el) { topY += el.offsetTop; el = el.offsetParent; }
      var availH = document.documentElement.clientHeight - topY - 20;
      var s = Math.min(1, avail / w, availH / h);
      if (s < 1) {
        f.style.transform = 'scale(' + s + ')';
        f.style.transformOrigin = 'top center';
        f.style.marginLeft = f.style.marginRight = ((w * s - w) / 2) + 'px';
        f.style.marginBottom = (h * s - h) + 'px';
      } else {
        f.style.transform = '';
        f.style.transformOrigin = '';
        f.style.marginLeft = f.style.marginRight = '';
        f.style.marginBottom = '';
      }
    });
  }
  function applySize() {
    var opt = sizeSelect.options[sizeSelect.selectedIndex];
    wrapper.style.setProperty('--frame-width', opt.getAttribute('data-w') + 'px');
    wrapper.style.setProperty('--frame-height', opt.getAttribute('data-h') + 'px');
    wrapper.setAttribute('data-bp', opt.getAttribute('data-bp') || 'mobile');
    fitFrames();
    syncHeroLoop();
  }
  sizeSelect.addEventListener('change', applySize);
  window.addEventListener('resize', fitFrames);
  // The frame's width animates (0.2s), so the container query — and with it the hero
  // loop's clone visibility — can flip mid-transition. Re-sync once the width settles.
  var frameA = document.querySelector('.phone-frame[data-layout="a"]');
  if (frameA) frameA.addEventListener('transitionend', function(e) {
    if (e.propertyName === 'width') syncHeroLoop();
  });
  applySize();

})();

// ── Reveal Form ───────────────────────────────────────
(function() {

  // ── Room labels ────────────────────────────────────────────────────────────
  var ROOM_LABELS = {
    kitchen: 'Kitchen', primary_bath: 'Primary / master bath',
    secondary_bath: 'Secondary bath', living: 'Living room',
    dining: 'Dining room', office: 'Home office',
    bedroom: 'Bedroom', entry_mudroom: 'Entry / mudroom', basement_adu: 'Basement ADU',
    entire_home: 'Entire home'
  };

  // ── Construction cost tables (summed, no discounts, round to $1k) ──────────
  // Layout A: 2-type (combined cosmetic+pull, gut/reconfigure)
  var CONSTRUCTION_COSTS = {
    refresh_replace: {
      kitchen:        [12000,  90000],
      primary_bath:   [8000,   95000],
      secondary_bath: [6000,   50000],
      living:         [6000,   50000],
      dining:         [4000,   28000],
      office:         [3000,   30000],
      bedroom:        [3000,   25000],
      entry_mudroom:  [3000,   25000],
      basement_adu:   [90000, 350000],
      entire_home:    [80000, 400000]
    },
    reconfigure: {
      kitchen:        [90000,  175000],
      primary_bath:   [95000,  160000],
      secondary_bath: [50000,   80000],
      living:         [50000,  100000],
      dining:         [30000,   65000],
      office:         [28000,   60000],
      bedroom:        [22000,   50000],
      entry_mudroom:  [20000,   45000],
      basement_adu:  [150000,  350000],
      entire_home:   [300000,  900000]
    }
  };

  // Layout B: 3-type (cosmetic update, style makeover, functional fix)
  var CONSTRUCTION_COSTS_3 = {
    refresh: {
      kitchen:        [12000,  30000],
      primary_bath:   [8000,   18000],
      secondary_bath: [6000,   14000],
      living:         [6000,   16000],
      dining:         [4000,   10000],
      office:         [3000,    9000],
      bedroom:        [3000,    9000],
      entry_mudroom:  [3000,    8000],
      basement_adu:   [15000,  40000],
      entire_home:    [60000, 150000]
    },
    replace: {
      kitchen:        [45000,  90000],
      primary_bath:   [50000,  95000],
      secondary_bath: [22000,  50000],
      living:         [20000,  50000],
      dining:         [12000,  28000],
      office:         [12000,  30000],
      bedroom:        [10000,  25000],
      entry_mudroom:  [10000,  25000],
      basement_adu:   [90000, 175000],
      entire_home:   [150000, 400000]
    },
    reconfigure: {
      kitchen:        [90000,  175000],
      primary_bath:   [95000,  160000],
      secondary_bath: [50000,   80000],
      living:         [50000,  100000],
      dining:         [30000,   65000],
      office:         [28000,   60000],
      bedroom:        [22000,   50000],
      entry_mudroom:  [20000,   45000],
      basement_adu:  [150000,  350000],
      entire_home:   [300000,  900000]
    }
  };

  // ── Premodel service prices (per room, bundle discounts by sort order) ──────
  // RC tier = Style update / cosmetic; RCP tier = Functional fix
  var PM_PRICES_RC = {
    kitchen: 1850, primary_bath: 1400, secondary_bath: 912,
    living: 912, dining: 912, office: 912,
    bedroom: 650, entry_mudroom: 912, basement_adu: 1850,
    entire_home: 6000
  };
  var PM_PRICES_RCP = {
    kitchen: 2775, primary_bath: 2100, secondary_bath: 1275,
    living: 1275, dining: 1275, office: 1275,
    bedroom: 900, entry_mudroom: 1275, basement_adu: 2775,
    entire_home: 9500
  };
  var PM_BASE  = {
    refresh_replace: 1500, gut_reconfigure: 2500,  // Layout B (2-tier)
    refresh: 1500, replace: 1500, reconfigure: 2500  // Layout A (3-tier)
  };
  // RC pricing: cosmetic tiers; RCP pricing: functional fix
  var PM_RCP_TIERS = { gut_reconfigure: true, reconfigure: true };
  var PM_DISC  = [0, 0.20, 0.25, 0.30]; // anchor, 2nd, 3rd, 4th+

  var BUDGET_RANGES = {
    under_50k:   { lo: 0,      hi: 50000   },
    '50k_100k':  { lo: 50000,  hi: 100000  },
    '100k_200k': { lo: 100000, hi: 200000  },
    '200k_400k': { lo: 200000, hi: 400000  },
    '400k_plus': { lo: 400000, hi: 9999999 },
    not_sure:    null
  };

  var STEP_LABELS = ['', '', 'Your estimate', 'Your info', ''];
  var TOTAL_STEPS = 3; // three displayed steps: estimate (s2) → contact (s3) → confirm (s4)

  // ── Formatting helpers ─────────────────────────────────────────────────────
  function roundNearest(val, nearest) { return Math.round(val / nearest) * nearest; }

  function fmtMoney(n) {
    if (n >= 1000000) { var m = n / 1000000; return '$' + (m % 1 === 0 ? m : m.toFixed(1)) + 'm'; }
    if (n >= 100000)  { return '$' + Math.round(n / 1000) + 'k'; }
    return '$' + n.toLocaleString('en-US');
  }
  function fmtRange(lo, hi) { return fmtMoney(lo) + ' – ' + fmtMoney(hi); }
  function fmtDollars(n) { return '$' + n.toLocaleString('en-US'); }

  // ── Lead submission ─────────────────────────────────────────────────────────
  // Both layouts funnel their final submit through submitLead(), which recomputes
  // the estimate from the shared calculators (so it's layout-agnostic) and POSTs
  // to the serverless intake endpoint. The endpoint posts the lead to Slack.
  var TIER_LABELS = {
    refresh: 'Refresh (cosmetic update)',
    replace: 'Replace (style makeover)',
    reconfigure: 'Reconfigure (functional fix)',
    refresh_replace: 'Refresh / Replace',
    gut_reconfigure: 'Gut / Reconfigure'
  };
  var BUDGET_LABELS = {
    under_50k: 'Under $50k', '50k_100k': '$50k – $100k', '100k_200k': '$100k – $200k',
    '200k_400k': '$200k – $400k', '400k_plus': '$400k+', not_sure: 'Not sure yet'
  };
  function budgetLabelFor(budget) {
    if (budget == null || budget === '') return null;
    if (BUDGET_LABELS[budget]) return BUDGET_LABELS[budget];
    var n = Number(budget);
    return isFinite(n) && n > 0 ? fmtMoney(n) : String(budget);
  }
  function getUtm() {
    var out = {};
    try {
      new URLSearchParams(location.search).forEach(function(v, k) {
        if (/^utm_/i.test(k) && v) out[k] = v;
      });
    } catch (e) {}
    return out;
  }
  function buildLeadPayload(id, rooms, tier, budget) {
    function v(f) { var el = document.getElementById('rfi-' + f + '-' + id); return el ? el.value.trim() : ''; }
    var ackEl = document.getElementById('rf-ack-' + id);
    var est = calcConstruction(rooms, tier);
    var pm  = (rooms.length && tier) ? buildPmBreakdown(rooms, tier) : null;
    return {
      contact: { firstName: v('first'), lastName: v('last'), email: v('email'), phone: v('phone'), zip: v('zip') },
      project: {
        rooms: rooms.slice(),
        roomLabels: rooms.map(function(r) { return ROOM_LABELS[r] || r; }),
        tier: tier || null,
        tierLabel: tier ? (TIER_LABELS[tier] || tier) : null,
        budget: budget != null ? String(budget) : null,
        budgetLabel: budgetLabelFor(budget),
        acknowledged: ackEl ? !!ackEl.checked : true
      },
      estimate: {
        pmTotal: pm ? pm.total : null,
        pmTotalFormatted: pm ? fmtDollars(pm.total) : null,
        constructionLo: est ? est.lo : null,
        constructionHi: est ? est.hi : null,
        constructionRangeFormatted: est ? fmtRange(est.lo, est.hi) : null,
        designFeeRangeFormatted: est ? fmtRange(roundNearest(est.lo * 0.05, 500), roundNearest(est.hi * 0.10, 500)) : null
      },
      meta: { layout: id, pageUrl: location.href, utm: getUtm(), submittedAt: new Date().toISOString() }
    };
  }
  // Resolves true when the lead was accepted by the server.
  function submitLead(id, rooms, tier, budget) {
    return fetch('/api/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildLeadPayload(id, rooms, tier, budget))
    }).then(function(r) { return r.ok; }).catch(function() { return false; });
  }
  function showFormError(id, msg) {
    var host = document.getElementById('rf-s3-' + id) || document.getElementById('rfc-contact1-' + id);
    if (!host) { return; }
    var el = document.getElementById('rf-formerr-' + id);
    if (!el) {
      el = document.createElement('p');
      el.id = 'rf-formerr-' + id;
      el.setAttribute('role', 'alert');
      el.style.cssText = 'color:#b42318;font-size:var(--fs-small,13px);line-height:1.5;margin:var(--space-3,12px) 0 0';
      host.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = '';
  }
  function clearFormError(id) {
    var el = document.getElementById('rf-formerr-' + id);
    if (el) { el.style.display = 'none'; el.textContent = ''; }
  }
  var SUBMIT_ERR = 'Something went wrong sending your request. Please try again, or email hello@premodel.design.';

  // ── Calculators ────────────────────────────────────────────────────────────
  function calcConstruction(rooms, tier) {
    if (!rooms.length || !tier) return null;
    var tbl = CONSTRUCTION_COSTS[tier] || CONSTRUCTION_COSTS_3[tier];
    if (!tbl) return null;
    var lo = 0, hi = 0;
    rooms.forEach(function(r) { if (tbl[r]) { lo += tbl[r][0]; hi += tbl[r][1]; } });
    return { lo: roundNearest(lo, 1000), hi: roundNearest(hi, 1000) };
  }

  function getBudgetState(lo, hi, budget) {
    if (!budget || budget === 'not_sure' || !BUDGET_RANGES[budget]) return 'not_sure';
    var b = BUDGET_RANGES[budget];
    if (lo > b.hi) return 'too_low';
    if (b.lo > 0 && hi < b.lo * 0.8) return 'has_room';
    var bottomQuarter = lo + (hi - lo) * 0.25;
    if (b.hi <= bottomQuarter) return 'tight';
    return 'aligned';
  }

  // ── HTML builders ──────────────────────────────────────────────────────────

  // Budget alignment chip — four states, all always rendered
  function buildCmpHtml(state) {
    if (state === 'not_sure') {
      return '<div style="background:var(--bg-surface);border-radius:8px;padding:var(--space-3) var(--space-3-5)">'
        + '<p style="font-size: var(--fs-small);font-weight:500;color:var(--text-primary);margin:0 0 var(--space-1)">Not sure what to budget?</p>'
        + '<p style="font-size: var(--fs-small);color:var(--text-secondary);line-height:1.55;margin:0">That’s okay — most homeowners aren’t sure at this stage. Premodel helps you build a realistic budget baseline before you sit down with a contractor.</p>'
        + '</div>';
    }
    var cfg = {
      aligned: {
        bg: '#edf7ed', border: 'rgba(56,142,60,0.25)', color: '#1b5e20', stroke: '#2e7d32',
        svg: '<polyline points="20 6 9 17 4 12"></polyline>',
        main: 'Your budget looks realistic for this scope.',
        sub: null
      },
      too_low: {
        bg: '#fff8e1', border: 'rgba(245,167,0,0.3)', color: '#bf360c', stroke: '#e65100',
        svg: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
        main: 'Your budget may be on the low side for this scope.',
        sub: 'Scope adjustments or phasing can help — Premodel can walk you through the options before you commit to anything.'
      },
      tight: {
        bg: '#fff8e1', border: 'rgba(245,167,0,0.3)', color: '#7a4500', stroke: '#e65100',
        svg: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
        main: 'Your budget could work at the lower end of this scope.',
        sub: 'Expect to make some tradeoffs on materials and finishes. Premodel can help you figure out where to prioritize.'
      },
      has_room: {
        bg: '#eaf2fb', border: 'rgba(59,110,181,0.2)', color: '#2a5490', stroke: '#2a5490',
        svg: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>',
        main: 'Your budget has room beyond this scope.',
        sub: 'That headroom can go toward higher-end finishes, contingency, or expanding the project.'
      }
    };
    var c = cfg[state];
    if (!c) return '';
    var subHtml = c.sub ? '<br><span style="font-weight:400">' + c.sub + '</span>' : '';
    return '<div style="display:flex;align-items:flex-start;gap:var(--space-2);background:' + c.bg
      + ';border:0.5px solid ' + c.border + ';border-radius:8px;padding:var(--space-2-5) var(--space-3)">'
      + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="' + c.stroke
      + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:var(--space-0-5)">' + c.svg + '</svg>'
      + '<span style="font-size: var(--fs-small);color:' + c.color + ';line-height:1.4">'
      + '<strong style="font-weight:500">' + c.main + '</strong>' + subHtml
      + '</span></div>';
  }

  // Premodel service estimate with bundle-discount breakdown
  // Returns { html, total } so callers can display the total as a hero price
  function buildPmBreakdown(rooms, tier) {
    var prices    = PM_RCP_TIERS[tier] ? PM_PRICES_RCP : PM_PRICES_RC;
    var base      = PM_BASE[tier] || 1500;
    var baseLabel = 'Premodel base fee';

    // Sort rooms by price high-to-low (anchor room gets no discount)
    var sorted = rooms.slice().sort(function(a, b) {
      return (prices[b] || 0) - (prices[a] || 0);
    });

    var total = base;
    var html  = '<div class="rf-br-row">'
      + '<span class="rf-br-room">' + baseLabel + '</span>'
      + '<span class="rf-br-price">' + fmtDollars(base) + '</span>'
      + '</div>';

    sorted.forEach(function(r, i) {
      var d     = i < PM_DISC.length ? PM_DISC[i] : 0.30;
      var price = Math.round((prices[r] || 0) * (1 - d));
      total += price;
      var badge = d > 0 ? '<span class="rf-br-badge">–' + (d * 100) + '%</span>' : '';
      html += '<div class="rf-br-row">'
        + '<span class="rf-br-room">' + ROOM_LABELS[r] + badge + '</span>'
        + '<span class="rf-br-price">' + fmtDollars(price) + '</span>'
        + '</div>';
    });

    html += '<div class="rf-br-row"><span class="rf-br-room">Total</span>'
      + '<span class="rf-br-price">' + fmtDollars(total) + '</span></div>';

    return { html: html, total: total };
  }

  // ── Per-sheet logic ────────────────────────────────────────────────────────

  // ── In-page black-card stepper (Layout A) ───────────────────────────────────
  // One card, six progressively-disclosed screens: rooms → type → budget →
  // estimate → contact → success. Reuses every shared calculator above.
  function initRevealCard(id) {
    var card        = document.getElementById('rf-card-' + id);
    if (!card) return;
    var backBtn     = document.getElementById('rf-card-back-' + id);     // front: back arrow
    var nextBtn     = document.getElementById('rf-card-next-' + id);     // front: next arrow
    var dots        = document.querySelectorAll('#rf-dots-' + id + ' .rf-dot');
    var backNav     = document.getElementById('rf-back-nav-' + id);      // back face nav
    var backBackBtn = document.getElementById('rf-back-back-' + id);     // back: back arrow (unflip)
    var submitBtn   = document.getElementById('rf-submit-' + id);        // back: labeled submit
    var roomChips   = document.querySelectorAll('#rf-card-chips-' + id + ' .rf-room');
    var changeBtns  = document.querySelectorAll('#rf-card-changes-' + id + ' .rf-tier');
    var noteTrigger = document.getElementById('rf-note-trigger-' + id);
    var noteOverlay = document.getElementById('rf-note-overlay-' + id);
    var noteInput   = document.getElementById('rf-note-input-' + id);
    var noteDone    = document.getElementById('rf-note-done-' + id);
    var noteCancel  = document.getElementById('rf-note-cancel-' + id);
    var projectNote = '';   // optional internal field; never affects the estimate
    var slider      = document.getElementById('rf-budget-slider-' + id);
    var sliderOut   = document.getElementById('rf-slider-val-' + id);
    var presetBtns  = document.querySelectorAll('#rf-budget-presets-' + id + ' .rf-budget-chip');
    var planValEl   = document.getElementById('rf-meter-plan-val-' + id);
    var planPctEl   = document.getElementById('rf-meter-plan-pct-' + id);
    var planCell    = document.getElementById('rf-meter-plan-' + id);
    var buildValEl  = document.getElementById('rf-meter-build-val-' + id);
    var meterEl     = document.getElementById('rf-meter-' + id);          // estimate strip (always mounted)
    var backBody    = document.getElementById('rf-card-body-back-' + id); // back face body (faded on confirm)
    var ctaBtn      = document.querySelector('.phone-frame[data-layout="' + id + '"] .cta-button');
    var ctaBarWrap  = document.querySelector('.phone-frame[data-layout="' + id + '"] .cta-bar');
    var scrollEl    = document.querySelector('.phone-frame[data-layout="' + id + '"] .phone-scroll');
    var frame       = document.querySelector('.phone-frame[data-layout="' + id + '"]');

    // Step model: 1 rooms · 2 type · 3 budget (front) → 4 contact · 5 success (back).
    // Budget flips straight to contact; no interstitial. FRONT_STEPS is the front-face
    // question count: to add a signal question back in this slot later, add its panel
    // here, add a dot in the markup, and bump FRONT_STEPS.
    var PANELS = ['rooms', 'type', 'budget', 'contact1', 'success'];
    var FRONT_STEPS = 3;
    var LAST = PANELS.length;
    var step = 1, rooms = [], tier = null, budget = null, budgetTouched = false, advanceTimer = null;
    var prefersReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function panel(n) { return document.getElementById('rfc-' + PANELS[n - 1] + '-' + id); }
    function val(f) { return document.getElementById('rfi-' + f + '-' + id).value.trim(); }

    function fieldsValid() {
      var phone = val('phone');
      return !!(val('first') && val('last')
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('email'))
        && /^\d{5}$/.test(val('zip'))
        && (phone === '' || phone.replace(/\D/g, '').length >= 10)); // phone optional
    }

    // ── Money formatters (compact) ──────────────────────────────────────────────
    function fmtBudgetK(n) { return n >= 1000000 ? '$1M+' : '$' + Math.round(n / 1000) + 'k'; }
    // Compact range: "$15–40k" / "$120k–$1M+". The top caps at $1M+ per the benchmark.
    function rangeCompact(lo, hi) {
      if (hi >= 1000000) {
        var loStr = lo >= 1000000 ? '$1M+' : '$' + Math.round(lo / 1000) + 'k';
        return loStr + '–$1M+';
      }
      return '$' + Math.round(lo / 1000) + '–' + Math.round(hi / 1000) + 'k';
    }

    // ── Estimate strip config ───────────────────────────────────────────────────
    var PM_PCT   = { lo: 0.03, hi: 0.05 }; // PLACEHOLDER Premodel Plan share of build (to be supplied)
    var PM_FLOOR = 1000;                   // PLACEHOLDER floor (e.g. $1,000 minimum)
    var STRIP_DASH = '—';
    var SCOPE_LABEL = { refresh: 'Refresh', replace: 'Replacement', reconfigure: 'Reconfigure' };

    // ── Build benchmark (Seattle / Eastside construction costs, typical bands) ─────
    // Per-room construction cost by scope tier (what a contractor charges, not our
    // fee). Wet rooms + tier do most of the work; soft-room tier scaling is loose by
    // design. ADU and Entire home are special-cased below.
    var BUILD_BENCH = {
      kitchen:        { refresh: [15000, 40000], replace: [45000, 95000], reconfigure: [100000, 200000] },
      primary_bath:   { refresh: [10000, 20000], replace: [25000, 45000], reconfigure: [50000, 95000] },
      secondary_bath: { refresh: [7000, 15000],  replace: [15000, 30000], reconfigure: [30000, 50000] },
      living:         { refresh: [3000, 10000],  replace: [10000, 25000], reconfigure: [25000, 55000] },
      dining:         { refresh: [3000, 8000],   replace: [8000, 20000],  reconfigure: [20000, 45000] },
      bedroom:        { refresh: [3000, 8000],   replace: [10000, 22000], reconfigure: [20000, 45000] },
      office:         { refresh: [3000, 8000],   replace: [8000, 20000],  reconfigure: [18000, 40000] },
      entry_mudroom:  { refresh: [2000, 7000],   replace: [7000, 18000],  reconfigure: [15000, 35000] }
    };
    var BUILD_ADU  = [120000, 400000];   // new construction: flat band, tier-independent; adds on top
    var BUILD_HOME = { refresh: [120000, 250000], replace: [300000, 600000], reconfigure: [500000, 1000000] };

    // Aggregate the selected rooms at a tier into one [lo, hi] Build band.
    function buildBenchAt(roomList, t) {
      var lo, hi;
      if (roomList.indexOf('entire_home') !== -1) {       // priced per sqft; overrides rooms
        var h = BUILD_HOME[t] || BUILD_HOME.refresh; lo = h[0]; hi = h[1];
      } else {
        lo = 0; hi = 0;
        roomList.forEach(function(r) {
          if (r === 'basement_adu' || r === 'entire_home') return;
          var b = BUILD_BENCH[r]; if (b && b[t]) { lo += b[t][0]; hi += b[t][1]; }
        });
      }
      if (roomList.indexOf('basement_adu') !== -1) { lo += BUILD_ADU[0]; hi += BUILD_ADU[1]; } // separate structure
      lo = roundNearest(lo, 5000);                                          // low → nearest $5k
      hi = hi >= 100000 ? roundNearest(hi, 10000) : roundNearest(hi, 5000); // high → $10k / $5k
      return { lo: lo, hi: hi };
    }

    // Build range from scope. Rooms alone (no type yet) → widest plausible band:
    // the cheapest tier's low to the priciest tier's high. A type narrows it (upper
    // drops for a refresh, lower rises for a reconfigure). No rooms → null.
    function scopeRange() {
      if (!rooms.length) return null;
      if (tier) return buildBenchAt(rooms, tier);
      return { lo: buildBenchAt(rooms, 'refresh').lo, hi: buildBenchAt(rooms, 'reconfigure').hi };
    }

    // ── Plan sub: industry norm until a type is known, then Premodel's lower % ──────
    function setPlanSubNorm() {
      planPctEl.textContent = 'Typically 10%+ of budget';
      planPctEl.classList.remove('rf-meter-plan-pct--pm');
    }
    function setPlanSubPremodel() {
      planPctEl.textContent = Math.round(PM_PCT.lo * 100) + '–' + Math.round(PM_PCT.hi * 100)
        + '% of budget (typically 10%+)';
      planPctEl.classList.add('rf-meter-plan-pct--pm');
    }

    // ── Range animator: tweens both endpoints from their last values to the new ──────
    // ones (counts up on first appearance, counts the upper end down as Q2 narrows).
    // setTimeout fallback lands the final value when rAF is throttled (hidden preview).
    function makeRangeAnim(el) {
      var curLo = 0, curHi = 0, raf = null, timer = null;
      function clear() { if (raf) { cancelAnimationFrame(raf); raf = null; } if (timer) { clearTimeout(timer); timer = null; } }
      return {
        reset: function() { clear(); curLo = 0; curHi = 0; el.textContent = STRIP_DASH; },
        set: function(lo, hi) {
          clear();
          if (prefersReduced) { curLo = lo; curHi = hi; el.textContent = rangeCompact(lo, hi); return; }
          var fromLo = curLo, fromHi = curHi, t0 = null, dur = 460;
          function frame(ts) {
            if (t0 === null) t0 = ts;
            var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
            el.textContent = rangeCompact(fromLo + (lo - fromLo) * e, fromHi + (hi - fromHi) * e);
            if (p < 1) raf = requestAnimationFrame(frame); else { curLo = lo; curHi = hi; el.textContent = rangeCompact(lo, hi); }
          }
          raf = requestAnimationFrame(frame);
          timer = setTimeout(function() { clear(); curLo = lo; curHi = hi; el.textContent = rangeCompact(lo, hi); }, dur + 80);
        }
      };
    }
    var planAnim  = makeRangeAnim(planValEl);
    var buildAnim = makeRangeAnim(buildValEl);

    function updateMeter() {
      var br = scopeRange();
      if (!br) {                            // nothing selected in Q1: reset + the norm
        planAnim.reset();
        buildAnim.reset();
        setPlanSubNorm();
        return;
      }
      buildAnim.set(br.lo, br.hi);
      var pl = Math.max(PM_FLOOR, roundNearest(br.lo * PM_PCT.lo, 500));
      var ph = Math.max(PM_FLOOR, roundNearest(br.hi * PM_PCT.hi, 500));
      planAnim.set(pl, ph);
      if (tier) setPlanSubPremodel(); else setPlanSubNorm();   // % of build only once type is known
    }


    function applyNav(n) {
      if (n <= FRONT_STEPS) {
        // Front face: back arrow + step dots + next arrow
        backBtn.disabled = (n === 1);
        var nd = false;
        if (n === 1)      nd = rooms.length === 0;   // need a room
        else if (n === 2) nd = !tier;                // need a remodel type
        else if (n === 3) nd = !budgetTouched;       // need to engage budget (incl. "Not sure")
        nextBtn.disabled = nd;
        for (var i = 0; i < dots.length; i++) dots[i].classList.toggle('active', i === (n - 1));
      } else {
        // Back face (contact / success): labeled submit, hidden on the confirmation
        backNav.hidden = (n === LAST);
        submitBtn.disabled = !fieldsValid();
      }
    }

    function showStep(n) {
      step = n;
      for (var i = 1; i <= LAST; i++) panel(i).hidden = (i !== n);
      card.classList.toggle('flipped', n > FRONT_STEPS);   // flip to the light contact side
      // Estimate strip stays mounted through every step, including the confirmation.
      applyNav(n);
      if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }

    // Q1 — rooms (multi-select; advance via the next arrow). "Entire home" is exclusive
    // with the individual rooms (ADU can still ride alongside, since it's a separate
    // structure): selecting it clears the others; selecting a room clears it.
    function chipByRoom(r) { return document.querySelector('#rf-card-chips-' + id + ' [data-room="' + r + '"]'); }
    roomChips.forEach(function(chip) {
      chip.addEventListener('click', function() {
        var r = chip.getAttribute('data-room');
        var nowOn = chip.classList.toggle('sel');
        if (nowOn) {
          if (r === 'entire_home') {
            roomChips.forEach(function(c) {
              var cr = c.getAttribute('data-room');
              if (cr !== 'entire_home' && cr !== 'basement_adu') c.classList.remove('sel');
            });
          } else if (r !== 'basement_adu') {
            var eh = chipByRoom('entire_home'); if (eh) eh.classList.remove('sel');
          }
        }
        rooms = Array.prototype.filter.call(roomChips, function(c) {
          return c.classList.contains('sel');
        }).map(function(c) { return c.getAttribute('data-room'); });
        updateMeter();
        if (step === 1) applyNav(1);
      });
    });

    // Q2 — scope (single-select). Each tier maps to exactly one Build cost band:
    // refresh = cosmetic (low), replace = mid, reconfigure = structural (high).
    changeBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        changeBtns.forEach(function(b) { b.classList.remove('sel'); });
        btn.classList.add('sel');
        tier = btn.getAttribute('data-tier');
        updateMeter();
        if (step === 2) applyNav(2);
      });
    });

    // Optional note: a quiet trigger opens the full-bleed note view (non-gating).
    // Done saves, Cancel discards. Stored as projectNote; never touches the estimate.
    function noteTriggerLabel() {
      if (!noteTrigger) return;
      noteTrigger.innerHTML = projectNote ? 'Note added' : 'Add a note <span class="rf-note-opt">(optional)</span>';
      noteTrigger.classList.toggle('has-note', !!projectNote);
    }
    function openNote() {
      if (!noteOverlay) return;
      if (noteInput) noteInput.value = projectNote;   // load the saved note for editing
      noteOverlay.hidden = false;
      if (noteInput) noteInput.focus();
    }
    function saveNote() {                              // Done
      projectNote = noteInput ? noteInput.value.trim() : '';
      noteTriggerLabel();
      if (noteOverlay) noteOverlay.hidden = true;
    }
    function cancelNote() {                            // Cancel: discard edits
      if (noteInput) noteInput.value = projectNote;
      if (noteOverlay) noteOverlay.hidden = true;
    }
    if (noteTrigger) noteTrigger.addEventListener('click', openNote);
    if (noteDone) noteDone.addEventListener('click', saveNote);
    if (noteCancel) noteCancel.addEventListener('click', cancelNote);

    // The consent "Privacy Policy" link opens the footer privacy modal (its own
    // data-modal-open handler does the opening); preventDefault stops the surrounding
    // label from toggling the SMS checkbox and the href="#" jump.
    var privacyLink = document.getElementById('rf-privacy-link-' + id);
    if (privacyLink) privacyLink.addEventListener('click', function(e) { e.preventDefault(); });

    // Q3 — budget: slider for precision + quick presets. No auto-advance; the user
    // must engage one (slider/preset/Not sure) before Continue enables.
    function setSliderOut(v) { sliderOut.textContent = fmtBudgetK(v); }
    if (slider) {
      setSliderOut(+slider.value);
      slider.addEventListener('input', function() {
        budgetTouched = true; budget = +slider.value; setSliderOut(budget);
        presetBtns.forEach(function(b) { b.classList.remove('sel'); });
        if (step === 3) applyNav(3);   // budget is triage only; strip runs off scope
      });
    }
    presetBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var raw = btn.getAttribute('data-budget');
        presetBtns.forEach(function(b) { b.classList.remove('sel'); });
        btn.classList.add('sel');
        budgetTouched = true;
        if (raw === 'not_sure') { budget = 'not_sure'; }
        else { budget = +raw; if (slider) { slider.value = String(budget); setSliderOut(budget); } }
        if (step === 3) applyNav(3);   // budget is triage only; strip runs off scope
      });
    });

    // Contact fields — live-validate Next (step 5) + blur errors
    ['first', 'last', 'email', 'phone', 'zip'].forEach(function(f) {
      var el = document.getElementById('rfi-' + f + '-' + id);
      if (!el) return;
      el.addEventListener('input', function() { if (step === FRONT_STEPS + 1) applyNav(FRONT_STEPS + 1); });
      el.addEventListener('blur', function() {
        var fld = document.getElementById('rff-' + f + '-' + id);
        var v = el.value.trim(), ok = true;
        if (f === 'email') ok = !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        else if (f === 'phone') ok = !v || v.replace(/\D/g, '').length >= 10;
        else if (f === 'zip') ok = !v || /^\d{5}$/.test(v);
        else ok = !!v;
        fld.classList.toggle('err', !ok);
      });
    });
    // Front nav: next arrow advances (last front step → flips to contact); back steps back.
    nextBtn.addEventListener('click', function() { if (step <= FRONT_STEPS) showStep(step + 1); });
    backBtn.addEventListener('click', function() { if (step > 1) showStep(step - 1); });
    // Back nav: back arrow unflips to the budget step; labeled submit → confirmation.
    if (backBackBtn) backBackBtn.addEventListener('click', function() { showStep(FRONT_STEPS); });
    var submittingA = false;
    if (submitBtn) submitBtn.addEventListener('click', function() {
      if (!fieldsValid() || submittingA) return;
      submittingA = true;
      var prev = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      clearFormError(id);
      submitLead(id, rooms, tier, budget).then(function(ok) {
        submittingA = false;
        submitBtn.disabled = false;
        submitBtn.textContent = prev;
        if (ok) showStep(LAST);
        else showFormError(id, SUBMIT_ERR);
      });
    });

    // Bottom fixed CTA scrolls to the card; IntersectionObserver hides the bar
    // whenever the card is on screen so there's never a duplicate CTA.
    // Anchor on the "Ready for your reveal?" headline (not the "Start here" eyebrow)
    // so the eyebrow sits just off-screen above and the full estimate strip below the
    // card stays in view at Mobile M.
    var introEl = document.getElementById('start');
    function scrollToStart() {
      if (!scrollEl || !introEl) { if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      // Align the "Start here" eyebrow's bottom to the top edge: the eyebrow sits just
      // off-screen above, the headline tops the view, and the full strip stays visible.
      var eyebrow = introEl.querySelector('.section-eyebrow');
      var head = introEl.querySelector('.section-headline');
      var sr = scrollEl.getBoundingClientRect();
      var edge = eyebrow ? eyebrow.getBoundingClientRect().bottom
                         : (head ? head.getBoundingClientRect().top - 8 : introEl.getBoundingClientRect().top);
      var delta = edge - sr.top + 6;   // +6 pushes the eyebrow decisively off the top
      var maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
      var target = Math.max(0, Math.min(scrollEl.scrollTop + delta, maxScroll));
      scrollEl.scrollTo({ top: target, behavior: 'smooth' });
    }
    if (ctaBtn) ctaBtn.addEventListener('click', function() {
      requestAnimationFrame(scrollToStart);
      // Long smooth scrolls can drift short when content above settles; correct once.
      setTimeout(scrollToStart, 650);
    });
    if ('IntersectionObserver' in window && ctaBarWrap && card) {
      requestAnimationFrame(function() {
        var io = new IntersectionObserver(function(entries) {
          entries.forEach(function(e) {
            if (frame && frame.hidden) { ctaBarWrap.style.display = ''; return; }
            if (e.isIntersecting) { ctaBarWrap.style.display = 'none'; return; }
            // Stay hidden once the card has scrolled above the viewport (you're at/past it — the
            // footer). Only re-show while it's still below (not yet reached).
            var below = !e.rootBounds || (e.boundingClientRect.top >= e.rootBounds.bottom);
            ctaBarWrap.style.display = below ? '' : 'none';
          });
        }, { root: scrollEl, threshold: 0.04 });
        io.observe(card);
      });
    }

    showStep(1);
  }

  initRevealCard('a');

})();

// ── Info modals (Privacy, For builders) ────────────────
(function initInfoModals() {
  var openModal = null;
  var lastTrigger = null;

  function open(modal, trigger) {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    openModal = modal;
    lastTrigger = trigger || null;
    var closeBtn = modal.querySelector('[data-modal-close]');
    if (closeBtn) setTimeout(function() { closeBtn.focus(); }, 0);
  }

  function close() {
    if (!openModal) return;
    openModal.classList.remove('open');
    openModal.setAttribute('aria-hidden', 'true');
    var t = lastTrigger;
    openModal = null;
    lastTrigger = null;
    if (t && typeof t.focus === 'function') t.focus();
  }

  document.querySelectorAll('[data-modal-open]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var name  = btn.getAttribute('data-modal-open');
      var frame = btn.closest('.phone-frame');
      if (!frame) return;
      var modal = frame.querySelector('.info-modal[data-modal-name="' + name + '"]');
      open(modal, btn);
    });
  });

  document.querySelectorAll('.info-modal').forEach(function(modal) {
    modal.addEventListener('click', function(e) { if (e.target === modal) close(); });
    var closeBtn = modal.querySelector('[data-modal-close]');
    if (closeBtn) closeBtn.addEventListener('click', close);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && openModal) close();
  });

  // ── Palette picker ────────────────────────────────────────────────
  // The prototype is brand-styled by default now (tokens unified with the
  // style guide). Each swatch swaps just the accent quartet through the
  // shared engine (PremodelTokens.set) — which persists to localStorage and
  // broadcasts to any open style-guide tab — and toggles the .palette-active
  // re-skin. "Off" clears only the accent override, leaving any live editor
  // edits (type / spacing / other colors) intact.
  var PALETTES = {
    oxblood: {
      '--accent':    '#5e2c2e',
      '--accent-hover':   '#3f1c1d',
      '--accent-soft':    '#ecd0d0',
      '--accent-on-dark': '#a4666a'
    },
    sage: {
      '--accent':    '#7d8a72',
      '--accent-hover':   '#566052',
      '--accent-soft':    '#e4ecd6',
      '--accent-on-dark': '#a8b59c'
    },
    cyanotype: {
      '--accent':    '#2a5680',
      '--accent-hover':   '#16365a',
      '--accent-soft':    '#c8d8e8',
      '--accent-on-dark': '#6993bd'
    },
    aubergine: {
      '--accent':    '#4a2942',
      '--accent-hover':   '#2e1828',
      '--accent-soft':    '#d8c8d2',
      '--accent-on-dark': '#8e6a86'
    },
    saffron: {
      '--accent':    '#c89028',
      '--accent-hover':   '#966819',
      '--accent-soft':    '#f4e0b8',
      '--accent-on-dark': '#d8a84a'
    }
  };
  var ACCENT_CLEAR = { '--accent': null, '--accent-hover': null, '--accent-soft': null, '--accent-on-dark': null };

  var picker = document.querySelector('.palette-picker');
  if (picker) {
    var swatches = Array.prototype.slice.call(picker.querySelectorAll('.swatch'));

    function applyPalette(key) {
      var body = document.body;
      if (key === 'off') {
        // Clear only the accent override (revert to the default oxblood);
        // leave any live editor edits intact. Persists + broadcasts.
        if (window.PremodelTokens) PremodelTokens.set(ACCENT_CLEAR);
        body.classList.remove('palette-active');
        body.removeAttribute('data-palette');
        return;
      }
      var accent = PALETTES[key];
      if (accent && window.PremodelTokens) PremodelTokens.set(accent);
      body.classList.add('palette-active');
      body.setAttribute('data-palette', key);
    }

    function setActive(key) {
      swatches.forEach(function(btn) {
        var isActive = btn.getAttribute('data-palette') === key;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        btn.setAttribute('tabindex', isActive ? '0' : '-1');
        var wrap = btn.closest('.swatch-wrap');
        if (wrap) wrap.classList.toggle('active', isActive);
      });
    }

    function select(key) {
      applyPalette(key);
      setActive(key);
    }

    swatches.forEach(function(btn) {
      btn.addEventListener('click', function() {
        select(btn.getAttribute('data-palette'));
      });
    });

    picker.addEventListener('keydown', function(e) {
      var idx = swatches.indexOf(document.activeElement);
      if (idx === -1) return;
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % swatches.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + swatches.length) % swatches.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = swatches.length - 1;
      if (next === null) return;
      e.preventDefault();
      var target = swatches[next];
      target.focus();
      select(target.getAttribute('data-palette'));
    });
  }
})();
