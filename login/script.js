 (() => {
    'use strict';

    // ---------- Config ----------
    const AFTER_SIGN_IN_URL = '/dashboard/';
    const SSO_CALLBACK_URL  = '/login/sso-callback/';

    // ---------- DOM ----------
    const $  = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];

    const form        = $('#login-form');
    const loading     = $('#clerk-loading');
    const emailEl     = $('#email');
    const passEl      = $('#password');
    const totpWrap    = $('#totp-wrap');
    const totpEl      = $('#totp');
    const formError   = $('#form-error');
    const btnSubmit   = $('#btn-submit');
    const btnGoogle   = $('#btn-google');
    const btnGithub   = $('#btn-github');

    // Reset password
    const btnForgot       = $('#btn-forgot');
    const forgotForm      = $('#forgot-form');
    const forgotEmailEl   = $('#forgot-email');
    const forgotError     = $('#forgot-error');
    const btnForgotSend   = $('#btn-forgot-send');
    const btnForgotCancel = $('#btn-forgot-cancel');

    const resetForm       = $('#reset-form');
    const resetCodeEl     = $('#reset-code');
    const resetPassEl     = $('#reset-password');
    const resetError      = $('#reset-error');
    const btnResetSubmit  = $('#btn-reset-submit');
    const btnResetCancel  = $('#btn-reset-cancel');
    const forgotSuccess   = $('#forgot-success');

    // ---------- UI helpers (CORRETTO) ----------
    const setLoading = (btn, on) => {
      if (!btn) return;
      btn.disabled = on;
      const label = $('[data-label]', btn);
      
      if (on) {
        if (label) btn.setAttribute('data-text', label.textContent);
        
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        spinner.setAttribute('data-label', '');
        
        if (label) label.replaceWith(spinner);
      } else {
        const savedText = btn.getAttribute('data-text');
        if (savedText) {
          const span = document.createElement('span');
          span.textContent = savedText;
          span.setAttribute('data-label', '');
          
          const currentLabel = $('[data-label]', btn);
          if (currentLabel) currentLabel.replaceWith(span);
        }
      }
    };

    const clearErrors = () => {
      $$('[data-error-for]').forEach((s) => { s.textContent = ''; s.classList.add('hidden'); });
      if (formError) { formError.textContent = ''; formError.classList.add('hidden'); }
      if (forgotError) { forgotError.textContent = ''; forgotError.classList.add('hidden'); }
      if (resetError) { resetError.textContent = ''; resetError.classList.add('hidden'); }
      [emailEl, passEl, totpEl, forgotEmailEl, resetCodeEl, resetPassEl].forEach((i) => i && i.classList.remove('border-red-400'));
    };

    const fieldError = (name, msg) => {
      const s = $(`[data-error-for="${name}"]`);
      if (s) { s.textContent = msg; s.classList.remove('hidden'); }
      const input = $(`#${name}`);
      if (input) input.classList.add('border-red-400');
    };

    const globalError = (msg) => { 
      if (formError) { formError.textContent = msg; formError.classList.remove('hidden'); }
    };

    // Mappa errori Clerk → campo + copy in italiano
    const CLERK_MESSAGES = {
      form_identifier_not_found: ['email', 'Nessun account associato a questa email.'],
      form_password_incorrect:   ['password', 'Password non corretta.'],
      form_code_incorrect:       ['totp', 'Codice non valido.'],
      too_many_requests:         [null, 'Troppi tentativi. Riprova tra qualche minuto.'],
      session_exists:            [null, 'Sei già autenticato.'],
    };

    const handleClerkError = (err) => {
      const e = err?.errors?.[0];
      if (!e) return globalError('Qualcosa non ha funzionato. Riprova.');
      const [field, msg] = CLERK_MESSAGES[e.code] || [null, e.longMessage || e.message];
      field ? fieldError(field, msg) : globalError(msg);
      console.error('[Clerk]', e.code, e);
    };

    const RESET_MESSAGES = {
      form_identifier_not_found:     'Nessun account associato a questa email.',
      form_code_incorrect:           'Codice non valido o scaduto.',
      form_password_pwned:           'Questa password è troppo comune: scegline una più sicura.',
      form_password_length_too_short:'La password deve avere almeno 8 caratteri.',
      too_many_requests:             'Troppi tentativi. Riprova tra qualche minuto.',
    };

    const showPanelError = (err, panelErrorEl) => {
      const e = err?.errors?.[0];
      const msg = (e && (RESET_MESSAGES[e.code] || e.longMessage || e.message)) || 'Qualcosa non ha funzionato. Riprova.';
      if (panelErrorEl) { panelErrorEl.textContent = msg; panelErrorEl.classList.remove('hidden'); }
      console.error('[Clerk]', e?.code, e);
    };

    const validate = () => {
      let ok = true;
      const email = emailEl ? emailEl.value.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldError('email', 'Inserisci un indirizzo email valido.'); ok = false; }
      if (passEl && !passEl.value) { fieldError('password', 'Inserisci la password.'); ok = false; }
      if (totpWrap && !totpWrap.classList.contains('hidden') && totpEl && totpEl.value.trim().length < 6) { 
        fieldError('totp', 'Inserisci il codice a 6 cifre.'); ok = false; 
      }
      return ok;
    };

    // ---------- Clerk ----------
    const finish = async (signIn) => {
      await Clerk.setActive({ session: signIn.createdSessionId });
      location.replace(AFTER_SIGN_IN_URL);
    };

    const onSubmit = async (ev) => {
      ev.preventDefault();
      clearErrors();
      if (!validate()) return;
      setLoading(btnSubmit, true);

      try {
        const signIn = Clerk.client.signIn;
        const inSecondFactor = totpWrap && !totpWrap.classList.contains('hidden');

        if (inSecondFactor) {
          const res = await signIn.attemptSecondFactor({ strategy: 'totp', code: totpEl.value.trim() });
          if (res.status === 'complete') return finish(res);
          return globalError('Verifica non completata. Riprova.');
        }

        const res = await signIn.create({ identifier: emailEl.value.trim(), password: passEl.value });

        if (res.status === 'complete') return finish(res);

        if (res.status === 'needs_second_factor') {
          totpWrap.classList.remove('hidden'); 
          totpWrap.classList.add('flex');
          totpEl.focus();
          btnSubmit.setAttribute('data-text', 'Verifica');
          const lbl = $('[data-label]', btnSubmit);
          if (lbl) lbl.textContent = 'Verifica';
          return;
        }

        globalError('Accesso non completato: stato "' + res.status + '".');
      } catch (err) {
        handleClerkError(err);
      } finally {
        setLoading(btnSubmit, false);
      }
    };

    const authWithRedirect = async (strategy, btn) => {
      clearErrors();
      setLoading(btn, true);
      try {
        await Clerk.client.signIn.authenticateWithRedirect({
          strategy,
          redirectUrl: SSO_CALLBACK_URL,
          redirectUrlComplete: AFTER_SIGN_IN_URL,
        });
      } catch (err) {
        handleClerkError(err);
        setLoading(btn, false);
      }
    };

    // ---------- Reset password ----------
    const showLoginPanel = () => {
      clearErrors();
      if (forgotForm) forgotForm.classList.add('hidden');
      if (resetForm) resetForm.classList.add('hidden');
      if (forgotSuccess) forgotSuccess.classList.add('hidden');
      if (form) form.classList.remove('hidden');
    };

    const showForgotPanel = () => {
      clearErrors();
      if (form) form.classList.add('hidden');
      if (resetForm) resetForm.classList.add('hidden');
      if (forgotEmailEl && emailEl) forgotEmailEl.value = emailEl.value.trim();
      if (forgotForm) forgotForm.classList.remove('hidden');
      if (forgotEmailEl) forgotEmailEl.focus({ preventScroll: true });
    };

    const showResetPanel = () => {
      clearErrors();
      if (forgotForm) forgotForm.classList.add('hidden');
      if (resetForm) resetForm.classList.remove('hidden');
      if (resetCodeEl) resetCodeEl.focus({ preventScroll: true });
    };

    const onForgotSubmit = async (ev) => {
      ev.preventDefault();
      clearErrors();
      const email = forgotEmailEl ? forgotEmailEl.value.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        fieldError('forgot-email', 'Inserisci un indirizzo email valido.');
        return;
      }
      setLoading(btnForgotSend, true);
      try {
        await Clerk.client.signIn.create({ identifier: email, strategy: 'reset_password_email_code' });
        showResetPanel();
      } catch (err) {
        showPanelError(err, forgotError);
      } finally {
        setLoading(btnForgotSend, false);
      }
    };

    const onResetSubmit = async (ev) => {
      ev.preventDefault();
      clearErrors();
      const code = resetCodeEl ? resetCodeEl.value.trim() : '';
      const newPassword = resetPassEl ? resetPassEl.value : '';
      let ok = true;
      if (code.length < 6) { fieldError('reset-code', 'Inserisci il codice a 6 cifre.'); ok = false; }
      if (!newPassword || newPassword.length < 8) { fieldError('reset-password', 'Almeno 8 caratteri.'); ok = false; }
      if (!ok) return;

      setLoading(btnResetSubmit, true);
      try {
        const signIn = Clerk.client.signIn;
        const verify = await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code });

        if (verify.status === 'needs_new_password') {
          const done = await signIn.resetPassword({ password: newPassword });
          if (done.status === 'complete') {
            if (resetForm) resetForm.classList.add('hidden');
            if (forgotSuccess) forgotSuccess.classList.remove('hidden');
            return finish(done);
          }
          showPanelError(null, resetError);
          return;
        }

        if (verify.status === 'complete') return finish(verify);

        if (resetError) {
          resetError.textContent = 'Codice non valido o scaduto.';
          resetError.classList.remove('hidden');
        }
      } catch (err) {
        showPanelError(err, resetError);
      } finally {
        setLoading(btnResetSubmit, false);
      }
    };

    const boot = async () => {
      try {
        await Clerk.load();

        if (Clerk.user) return location.replace(AFTER_SIGN_IN_URL);

        if (loading) loading.classList.add('hidden');
        if (form) form.classList.remove('hidden');
        if (form) form.addEventListener('submit', onSubmit);
        if (btnGoogle) btnGoogle.addEventListener('click', () => authWithRedirect('oauth_google', btnGoogle));
        if (btnGithub) btnGithub.addEventListener('click', () => authWithRedirect('oauth_github', btnGithub));

        if (btnForgot) btnForgot.addEventListener('click', showForgotPanel);
        if (btnForgotCancel) btnForgotCancel.addEventListener('click', showLoginPanel);
        if (btnResetCancel) btnResetCancel.addEventListener('click', showLoginPanel);
        if (forgotForm) forgotForm.addEventListener('submit', onForgotSubmit);
        if (resetForm) resetForm.addEventListener('submit', onResetSubmit);

        if (emailEl) emailEl.focus({ preventScroll: true });
      } catch (err) {
        if (loading) loading.textContent = 'Impossibile inizializzare l\'autenticazione. Ricarica la pagina.';
        console.error('[Clerk.load]', err);
      }
    };

    if (window.Clerk?.loaded) boot();
    else window.addEventListener('load', boot);
  })();
</script>

  <!-- ============ CANVAS NIDO D'API — confinato al solo riquadro destro ============ -->
  <script>
    (() => {
      'use strict';

      const section = document.getElementById('login-visual');
      const canvas  = document.getElementById('loginCanvas');
      if (!section || !canvas) return;

      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return; // nessuna animazione: sfondo statico

      const ctx = canvas.getContext('2d');

      // Stessa icona Boxworks usata come "esagono" del pattern, come in Homepage
      const LOGO_PATH_STR = "M530,611.69l41.33,23.86,98.34,56.78,119.77,69.15,102.84,59.38C909,830.52,925.5,841,942.65,850c.24.12.47.27.7.4v-33.1l-36.31,21-87.22,50.36-106,61.19-90.92,52.49c-14.8,8.55-30.18,16.53-44.59,25.75l-.62.35,28.84,16.55V626.59c0-19.33.86-38.88,0-58.2,0-.26,0-.53,0-.8l-9.49,16.54,41.33-23.86,98.34-56.77,119.77-69.15L959.33,375c16.74-9.66,34.1-18.71,50.4-29.1l.7-.4-28.84-16.55v370c0,17.1-.78,34.41,0,51.49,0,.24,0,.48,0,.71l28.84-16.54L969.1,710.73,870.77,654,751,584.8,648.15,525.42c-16.74-9.66-33.24-20.19-50.4-29.1-.24-.12-.47-.27-.7-.4l9.49,16.55V94.14c0-19.33.85-38.88,0-58.2,0-.27,0-.54,0-.8L577.7,51.68l36.32,21L701.24,123l106,61.2,90.92,52.49c14.81,8.55,29.41,17.89,44.6,25.75.21.1.41.23.61.35V229.7L902,253.56l-98.33,56.77L683.91,379.48,581.07,438.86c-16.74,9.66-34.1,18.7-50.4,29.1l-.7.4h19.35L508,444.5l-98.34-56.77L289.87,318.57,187,259.2c-16.74-9.67-33.24-20.18-50.4-29.1-.24-.12-.46-.27-.7-.4v33.09l36.31-21,87.23-50.36,106-61.19,90.91-52.49C471.18,69.24,486.56,61.26,501,52c.2-.13.41-.24.61-.36L472.75,35.14V453.46c0,19.33-.87,38.88,0,58.2,0,.27,0,.54,0,.81l9.49-16.55-41.33,23.86-98.34,56.78L222.8,645.71,120,705.08c-16.75,9.67-34.1,18.71-50.4,29.1-.23.15-.47.27-.7.41l28.83,16.54v-370c0-17.09.79-34.4,0-51.49,0-.23,0-.47,0-.71L68.86,345.47l41.32,23.86,98.34,56.78L328.3,495.26l102.84,59.37c16.74,9.67,33.24,20.2,50.4,29.1.24.12.47.27.7.4l-9.49-16.54V985.91c0,19.34-.85,38.88,0,58.2,0,.27,0,.54,0,.81l28.83-16.55-36.31-21-87.22-50.36-106-61.19-90.92-52.49c-14.8-8.55-29.4-17.89-44.59-25.75-.21-.11-.41-.24-.62-.36v33.1l41.33-23.86,98.34-56.78,119.77-69.15L498.22,641.2c16.77-9.69,33.89-19,50.4-29.1.22-.14.46-.27.7-.41,8.68-5,12.46-17.55,6.87-26.22S539.26,573.23,530,578.6l-41.33,23.86L390.3,659.23,270.53,728.39,167.69,787.76c-16.78,9.69-33.9,19-50.4,29.1l-.7.4c-12.44,7.18-12.44,25.92,0,33.1l36.31,21,87.22,50.36,106,61.19,90.92,52.5c14.84,8.57,29.52,17.57,44.59,25.74l.62.36c12.57,7.26,28.84-2,28.84-16.55V625.22c0-19,.75-38.07,0-57-.47-11.59-7.32-15.92-15.59-20.7l-25.34-14.63-93.46-54-119.17-68.8L149.87,348,91,314l-2.75-1.59c-12.57-7.26-28.84,2-28.84,16.55v370c0,17.14-.48,34.36,0,51.49,0,.24,0,.48,0,.71,0,14.59,16.27,23.81,28.84,16.55l41.33-23.86,99.17-57.25,119.79-69.16,103.19-59.58c16.4-9.47,33.35-18.36,49.36-28.5,9.75-6.17,10-14.37,10-23.9V35.14c0-14.59-16.27-23.81-28.84-16.55l-36.31,21L358.71,89.91l-106,61.19L161.8,203.59c-14.84,8.57-30,16.75-44.6,25.75l-.61.36c-12.44,7.17-12.44,25.91,0,33.09l41.33,23.86,98.33,56.78L376,412.58,478.87,472c16.78,9.68,33.38,19.83,50.4,29.09.24.13.47.27.7.41a19.38,19.38,0,0,0,19.35,0l41.32-23.86L689,420.82l119.78-69.15L911.6,292.29c16.77-9.68,33.89-19,50.4-29.09l.7-.41c12.43-7.18,12.43-25.92,0-33.09l-36.31-21-87.22-50.36-106-61.19L642.26,44.69c-14.85-8.57-29.52-17.58-44.59-25.75l-.62-.35c-12.57-7.26-28.84,2-28.84,16.55v419.7c0,18.94-.76,38.06,0,57,.47,11.59,7.31,15.92,15.59,20.69l25.34,14.63,93.46,54,119.17,68.8,107.65,62.16,58.91,34,2.76,1.59c12.57,7.26,28.83-2,28.83-16.55v-370c0-17.14.49-34.35,0-51.49v-.71c0-14.58-16.26-23.81-28.83-16.55l-41.33,23.86-99.17,57.26L730.8,462.65,627.61,522.22c-16.4,9.48-33.35,18.37-49.36,28.5-9.75,6.18-10,14.38-10,23.9v470.3c0,14.58,16.27,23.81,28.84,16.55l36.31-21,87.22-50.35,106-61.2,90.92-52.49c14.84-8.57,30-16.75,44.59-25.74.2-.13.41-.24.62-.36,12.43-7.18,12.43-25.92,0-33.1L921.37,793.4,823,736.63,703.26,667.48,600.42,608.1C583.63,598.41,567,588.26,550,579l-.69-.4c-8.69-5-21.37-2.31-26.23,6.87S520.7,606.34,530,611.69Z";
      const logoPath2D = new Path2D(LOGO_PATH_STR);
      const VB_W = 960.99, VB_H = 1047.95;

      // Pattern più marcato e visibile, sempre confinato al riquadro destro
      const WAVE_SPEED  = 0.00022;
      const REST_ALPHA  = 0.07;
      const PEAK_ALPHA  = 0.20;
      const SCALE_BASE  = 0.62;
      const SCALE_PEAK  = 0.88;
      const WAVE_WIDTH  = 0.16;

      let wavePos = 1.0, waveDir = -1;
      let points = [], cellD = 0, dpr = 1, hidden = false, resizeTimer, W = 0, H = 0, active = false;

      const isDesktop = () => window.innerWidth >= 768;

      function resize() {
        const rect = section.getBoundingClientRect();
        W = rect.width; H = rect.height;
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        buildHoneycomb(W, H);
      }

      function buildHoneycomb(w, h) {
        const COLS_TARGET = 13; // densità aumentata per un pattern più visibile nel riquadro
        cellD = w / COLS_TARGET;
        const colStep = cellD, rowStep = cellD * Math.sqrt(3) / 2;
        const totalCols = Math.ceil(w / colStep) + 2;
        const totalRows = Math.ceil(h / rowStep) + 2;
        const offsetX = -colStep, offsetY = -rowStep;
        points = [];
        for (let r = 0; r < totalRows; r++) {
          const xShift = r % 2 === 1 ? colStep * 0.5 : 0;
          for (let c = 0; c < totalCols; c++)
            points.push({ x: offsetX + c * colStep + xShift, y: offsetY + r * rowStep, normX: 0 });
        }
        const maxX = w + colStep;
        for (let i = 0; i < points.length; i++)
          points[i].normX = Math.max(0, Math.min(1, (points[i].x - offsetX) / (maxX - offsetX)));
      }

      function easeInOut(t) { return t * t * (3 - 2 * t); }
      function getProps(normX) {
        const d = Math.abs(normX - wavePos);
        if (d > WAVE_WIDTH * 2) return { alpha: REST_ALPHA, scale: SCALE_BASE };
        const t = easeInOut(1 - d / (WAVE_WIDTH * 2));
        return { alpha: REST_ALPHA + (PEAK_ALPHA - REST_ALPHA) * t, scale: SCALE_BASE + (SCALE_PEAK - SCALE_BASE) * t };
      }

      function drawLogo(cx, cy, alpha, scale) {
        if (alpha < 0.004) return;
        const s = (cellD * scale) / VB_W;
        ctx.save();
        ctx.globalAlpha = alpha; ctx.fillStyle = '#F8F9FA';
        ctx.translate(cx, cy); ctx.scale(s, s);
        ctx.translate(-VB_W * 0.5 + 59.15, -VB_H * 0.5 + 16.05);
        ctx.fill(logoPath2D); ctx.restore();
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);
        for (let i = 0; i < points.length; i++) {
          const p = points[i], { alpha, scale } = getProps(p.normX);
          drawLogo(p.x, p.y, alpha, scale);
        }
      }

      function tick() {
        if (active && !hidden) {
          wavePos += waveDir * WAVE_SPEED;
          if (wavePos <= 0) { wavePos = 0; waveDir = 1; }
          if (wavePos >= 1) { wavePos = 1; waveDir = -1; }
          draw();
        }
        requestAnimationFrame(tick);
      }

      function evaluateActive() {
        // Regola responsive: sotto i 768px l'animazione resta disattivata
        active = isDesktop();
        canvas.style.display = active ? 'block' : 'none';
        if (active) resize();
      }

      document.addEventListener('visibilitychange', () => { hidden = document.hidden; }, { passive: true });
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { ctx.setTransform(1, 0, 0, 1, 0, 0); evaluateActive(); }, 120);
      }, { passive: true });

      evaluateActive();
      tick();
    })();