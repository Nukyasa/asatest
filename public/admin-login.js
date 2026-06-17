const loginForm = document.querySelector("#admin-login-form");
const loginStatus = document.querySelector("#admin-login-status");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "";
  const formData = new FormData(loginForm);

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: formData.get("password") })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Login nije uspio.");
    window.location.href = "/admin.html";
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});
