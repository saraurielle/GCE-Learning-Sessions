(async () => {
  const view = $("#view");
  if (!Auth.token()) { location.replace("login.html?next=profile.html"); return; }
  try {
    const { user, avatars } = await api("/profile");
    Auth.setUser(user);
    const form = { avatar: user.avatar, bio: user.bio, dailyGoal: user.dailyGoal, prefs: { ...user.prefs } };
    view.innerHTML =
      `<div class="page-head"><div class="profile-head"><span class="avatar lg" id="bigAvatar">${esc(form.avatar)}</span><div><h1>${esc(user.username)}</h1><p>${user.isAdmin ? '<span class="chip red">Admin</span> ' : ""}${user.createdAt ? "Member since " + esc(new Date(user.createdAt).toLocaleDateString([], { month: "long", year: "numeric" })) : ""}</p></div></div><a class="btn outline" href="progress.html">${Icons.chart} My progress</a></div>` +
      `<div class="grid-2"><section class="sheet"><h2>Profile</h2><span class="field"><span>Avatar</span><span class="avatars" id="avatars" role="group" aria-label="Choose an avatar">${avatars.map((a) => `<button type="button" data-av="${esc(a)}" aria-pressed="${a === form.avatar}" aria-label="Avatar ${esc(a)}">${esc(a)}</button>`).join("")}</span></span>` +
      `<label class="field"><span>Bio</span><textarea class="textarea" id="bio" rows="2" maxlength="160" placeholder="What are you studying for?">${esc(form.bio)}</textarea><small>Up to 160 characters</small></label>` +
      `<div class="field"><span>Daily goal</span><div class="stepper"><button type="button" id="goalMinus" aria-label="Fewer activities">−</button><output id="goalVal" aria-live="polite">${form.dailyGoal}</output><button type="button" id="goalPlus" aria-label="More activities">+</button><span class="muted">activities a day (quiz, challenge or paper)</span></div></div>` +
      `<div class="switch"><span><b>Mention alerts</b><small>Notify me when someone @mentions or replies to me</small></span><input type="checkbox" id="pMentions" role="switch" aria-label="Mention alerts"${form.prefs.mentions ? " checked" : ""}></div>` +
      `<div class="switch"><span><b>Streak reminders</b><small>A nudge in the afternoon if your streak is at risk</small></span><input type="checkbox" id="pReminders" role="switch" aria-label="Streak reminders"${form.prefs.reminders ? " checked" : ""}></div>` +
      `<div id="saveMsg" class="mt"></div><button type="button" class="btn mt" id="saveBtn">Save changes</button></section>` +
      `<section class="sheet"><h2>Change password</h2><form id="pwForm" novalidate><label class="field"><span>Current password</span><input class="input" type="password" name="cur" autocomplete="current-password"></label>` +
      `<label class="field"><span>New password</span><input class="input" type="password" name="next" autocomplete="new-password"><small>At least 6 characters</small></label><div id="pwMsg"></div><button class="btn outline" type="submit">Update password</button></form>` +
      `<hr style="border:0;border-top:1px solid var(--line);margin:26px 0"><button type="button" class="btn danger" id="outBtn">${Icons.logout} Log out</button></section></div>`;

    $("#avatars").addEventListener("click", (e) => {
      const b = e.target.closest("[data-av]"); if (!b) return;
      form.avatar = b.dataset.av; $("#bigAvatar").textContent = form.avatar;
      $$("#avatars button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    });
    const setGoal = (n) => { form.dailyGoal = Math.max(1, Math.min(10, n)); $("#goalVal").textContent = form.dailyGoal; };
    $("#goalMinus").addEventListener("click", () => setGoal(form.dailyGoal - 1));
    $("#goalPlus").addEventListener("click", () => setGoal(form.dailyGoal + 1));

    $("#saveBtn").addEventListener("click", async () => {
      const btn = $("#saveBtn"), msg = $("#saveMsg"); btn.disabled = true; msg.innerHTML = "";
      try {
        const r = await api("/profile", { method: "PATCH", body: { avatar: form.avatar, bio: $("#bio").value, dailyGoal: form.dailyGoal, prefs: { mentions: $("#pMentions").checked, reminders: $("#pReminders").checked } } });
        Auth.setUser(r.user); sessionStorage.removeItem("gce_stats");
        const chip = $(".userchip .avatar"); if (chip) chip.textContent = r.user.avatar;
        msg.innerHTML = '<div class="notice">Saved.</div>';
      } catch (err) { showError(msg, err.message); }
      btn.disabled = false;
    });

    $("#pwForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target, out = $("#pwMsg"), btn = $("button", f); btn.disabled = true; out.innerHTML = "";
      try {
        await api("/auth/password", { method: "POST", body: { currentPassword: f.elements.cur.value, newPassword: f.elements.next.value } });
        out.innerHTML = '<div class="notice">Password updated.</div>'; f.reset();
      } catch (err) { showError(out, err.message); }
      btn.disabled = false;
    });
    $("#outBtn").addEventListener("click", logout);
  } catch (err) {
    if (err.status === 401) { location.replace("login.html?next=profile.html"); return; }
    showError(view, err.message);
  }
})();
