(function () {
  var C = window.GEO_CONFIG || {};
  var META = (window.GEO_PRACTICE || {}).meta || {};
  var Q = (window.GEO_PRACTICE || {}).questions || [];
  var params = new URLSearchParams(location.search);
  var MOCK = params.get("mock") === "1" || C.DEMO === true;
  var token = null, login = "", fullName = "";
  var STORE = "geo-practice:" + (META.week || "x");
  var $ = function (id) { return document.getElementById(id); };
  var form = $("exam"), N = Q.length, btn = null;

  document.title = (META.title ? META.title + " · " : "") + "Intro to Geometry";
  if (META.title) $("page-title").textContent = META.title;
  if (META.blurb) $("intro").textContent = META.blurb;
  if (C.DEMO) {
    $("demo-banner").hidden = false;
    $("demo-banner").textContent = "Example data only — this is a 3-question sample used to test the page. The answer key is not included in a real student page.";
  }

  function render(list) {
    Q = list || Q; N = Q.length;
    var html = "";
    Q.forEach(function (q, i) {
      var chip = q.type === "test-style" ? '<span class="chip">Test-style</span>' : "";
      var fig = q.diagram ? '<div class="q-fig">' + q.diagram + "</div>" : "";
      html += '<section class="q-card" id="card-' + q.id + '"><fieldset>' +
        '<legend class="q-text"><span class="q-num">Question ' + (i + 1) + "</span>" + chip +
        "<br>" + q.prompt + "</legend>" + fig +
        '<div class="q-options">' + (q.options || []).map(function (o) {
          return '<label class="opt"><input type="radio" name="' + q.id + '" value="' + o.id +
            '"><span>' + o.html + "</span></label>";
        }).join("") + "</div></fieldset></section>";
    });
    html += '<div class="submit-row"><span class="hint" id="hint"></span>' +
      '<button class="btn" type="submit" id="submit">Submit</button></div>';
    form.innerHTML = html;
    btn = $("submit");
    $("w-count").textContent = N;
    $("ptrack").setAttribute("aria-valuemax", N);
    refresh();
  }
  render(Q);

  function answers() {
    var a = {};
    Q.forEach(function (q) {
      var c = form.querySelector('input[name="' + q.id + '"]:checked');
      if (c) a[q.id] = c.value;
    });
    return a;
  }
  function refresh() {
    var n = Object.keys(answers()).length;
    if ($("hint")) $("hint").textContent = n === N ? "All " + n + " answered. Ready to submit." : n + " of " + N + " answered";
    $("pcount").textContent = n + " of " + N + " answered";
    $("pfill").style.width = (100 * n / Math.max(N, 1)) + "%";
    $("ptrack").setAttribute("aria-valuenow", n);
    form.querySelectorAll(".opt").forEach(function (l) {
      l.classList.toggle("is-selected", l.querySelector("input").checked);
    });
  }
  function save() { try { localStorage.setItem(STORE + ":" + login, JSON.stringify(answers())); } catch (e) {} }
  function restore() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE + ":" + login) || "{}");
      Object.keys(saved).forEach(function (k) {
        var el = form.querySelector('input[name="' + k + '"][value="' + saved[k] + '"]');
        if (el) el.checked = true;
      });
    } catch (e) {}
    refresh();
  }
  form.addEventListener("change", function () { save(); refresh(); });

  function show(which) {
    ["signin", "welcome", "thanks"].forEach(function (id) { $(id).hidden = id !== which; });
    form.hidden = which !== "exam";
    $("progressbar").hidden = which !== "exam";
  }
  function signinMsg(m) {
    $("signin-msg").hidden = !m;
    $("signin-msg").textContent = m || "";
  }

  function post(payload) {
    if (payload.action !== "login") payload.token = token;
    payload.week = META.week;
    if (MOCK) return mockBackend(payload);
    if (!C.APPS_SCRIPT_URL || /PASTE_/.test(C.APPS_SCRIPT_URL)) {
      return Promise.reject(new Error("This practice page is not connected yet. Mr. Levy still needs to paste the Apps Script URL into config.js."));
    }
    // text/plain avoids a CORS preflight, which Apps Script cannot answer
    return fetch(C.APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function mockBackend(payload) {
    var key = (window.GEO_DEMO_KEY || {});
    if (payload.action === "login") {
      return Promise.resolve({ ok: true, token: "mock", name: payload.name || "Riley (example)", role: "student" });
    }
    if (payload.action === "status") return Promise.resolve({ ok: true, name: fullName });
    if (payload.action === "submit") {
      var s = 0, results = [];
      Q.forEach(function (q) {
        var yours = (payload.answers || {})[q.id];
        var correct = key[q.id] && key[q.id].correct;
        var ok = yours === correct;
        if (ok) s++;
        results.push({
          id: q.id, ok: ok, yours: yours, correct: correct,
          explanation: (key[q.id] && key[q.id].explanation) || ""
        });
      });
      return Promise.resolve({
        ok: true, name: fullName, score: s, total: N,
        submittedAt: new Date().toISOString(), results: results,
        note: "scored locally on the example page only"
      });
    }
    return Promise.resolve({ ok: false, error: "unknown action" });
  }

  $("signin-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("si-name").value.trim(), pass = $("si-pass").value.trim();
    if (!name || !pass) { signinMsg("Please enter your name and password."); return; }
    var sb = $("si-submit"); sb.disabled = true; sb.textContent = "Signing in…"; signinMsg("");
    post({ action: "login", name: name, password: pass }).then(function (r) {
      if (!r || !r.ok) { signinMsg((r && r.error) || "That name or password did not match."); return; }
      token = r.token; login = name.toLowerCase(); fullName = r.name || name;
      $("w-name").textContent = fullName.split(/[ @]/)[0];
      restore();
      var n = Object.keys(answers()).length;
      $("begin").textContent = n ? "Continue practice (" + n + " of " + N + " answered)" : "Begin practice";
      show("welcome");
    }).catch(function (err) {
      signinMsg(err.message || "Could not reach the server.");
    }).then(function () { sb.disabled = false; sb.textContent = "Sign In"; });
  });

  $("begin").addEventListener("click", function () { show("exam"); window.scrollTo(0, 0); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (btn.disabled) return;
    var missing = N - Object.keys(answers()).length;
    if (missing) {
      $("status").hidden = false; $("status").className = "notice err";
      $("status-msg").textContent = missing + (missing === 1 ? " question is" : " questions are") + " still unanswered.";
      var first = Q.filter(function (q) { return !answers()[q.id]; })[0];
      if (first) { $("card-" + first.id).classList.add("is-missing"); $("card-" + first.id).scrollIntoView({ behavior: "smooth", block: "center" }); }
      return;
    }
    if (!confirm("Submit your answers? You can review how you did after they are scored.")) return;
    btn.disabled = true; btn.textContent = "Sending…";
    post({ action: "submit", answers: answers() }).then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.error) || "Submission failed.");
      try { localStorage.removeItem(STORE + ":" + login); } catch (e) {}
      $("t-name").textContent = (r.name || fullName).split(/[ @]/)[0];
      $("t-score").textContent = "Score: " + r.score + " / " + r.total;
      if (r.results && r.results.length) showReview(r.results);
      show("thanks"); window.scrollTo(0, 0);
    }).catch(function (err) {
      btn.disabled = false; btn.textContent = "Submit";
      $("status").hidden = false; $("status").className = "notice err";
      $("status-msg").textContent = err.message || "Could not reach the server. Your answers are still saved on this device.";
    });
  });

  function showReview(results) {
    var box = $("review"); box.hidden = false;
    var html = "<h3>How you did</h3>";
    results.forEach(function (r, i) {
      html += '<div class="review-item"><div>' + (r.ok ? '<span class="ok">Correct</span>' : '<span class="bad">Incorrect</span>') +
        " · Question " + (i + 1) + (r.ok ? "" : " (you chose " + (r.yours || "—") + ", the answer is " + r.correct + ")") +
        "</div>" + (r.explanation ? "<p>" + r.explanation + "</p>" : "") + "</div>";
    });
    box.innerHTML = html;
  }

  if (MOCK && params.get("auto") === "1") {
    $("si-name").value = params.get("name") || "Riley";
    $("si-pass").value = "demo";
    $("si-submit").click();
  }
})();
