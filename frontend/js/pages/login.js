(() => {
  const view = $("#view");
  if (Auth.token()) { location.replace("profile.html"); return; }
  let mode = "login";

  function destination() {
    const next = new URLSearchParams(location.search).get("next") || "";
    if (/^[a-z-]+\.html(\?[\w=&%.\-]*)?(#[\w-]*)?$/i.test(next)) return next === "index.html" ? "../index.html" : next;
    return "../index.html";
  }

  function paint(error = "") {
    const reg = mode === "register";
    view.innerHTML =
      `<div class="tabs" role="tablist" aria-label="Account"><button type="button" role="tab" data-mode="login" aria-selected="${!reg}">Log in</button><button type="button" role="tab" data-mode="register" aria-selected="${reg}">Create account</button></div>` +
      `<div class="sheet"><h1 style="font-size:1.6rem;margin-bottom:6px">${reg ? "Join GCE Learning" : "Welcome back"}</h1><p class="muted" style="margin-bottom:18px">${reg ? "Earn XP, keep a streak and chat with other students." : "Log in to pick up where you stopped."}</p>` +
      `<form id="authForm" novalidate><label class="field"><span>Username</span><input class="input" name="username" autocomplete="username" required${reg ? ' maxlength="20"' : ""}>${reg ? "<small>3 to 20 characters: letters, numbers, . _ or -</small>" : ""}</label>` +
      `<label class="field"><span>Password</span><input class="input" type="password" name="password" autocomplete="${reg ? "new-password" : "current-password"}" required>${reg ? "<small>At least 6 characters</small>" : ""}</label>` +
      `<div id="authErr">${error ? `<div class="notice error" role="alert">${esc(error)}</div>` : ""}</div><button class="btn lg" style="width:100%" type="submit">${reg ? "Create account" : "Log in"}</button></form></div>`;
    $('input[name="username"]').focus();
  }

  view.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mode]");
    if (b) { mode = b.dataset.mode; paint(); }
  });
  view.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, username = f.elements.username.value.trim(), password = f.elements.password.value;
    const err = $("#authErr"), btn = $("button[type=submit]", f);
    if (!username || !password) return showError(err, "Enter your username and password.");
    btn.disabled = true;
    try {
      if (mode === "register") await api("/auth/register", { method: "POST", body: { username, password } });
      const data = await api("/auth/login", { method: "POST", body: { username, password } });
      Auth.set(data);
      location.href = destination();
    } catch (ex) { btn.disabled = false; showError(err, ex.message); }
  });
  paint();
})();
