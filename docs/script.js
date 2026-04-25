const form = document.getElementById("registrationForm");
const message = document.getElementById("formMessage");

form.addEventListener("submit", function(event) {
  event.preventDefault();

  message.textContent = "Static demo only. Backend registration works locally with npm start.";
  message.style.color = "green";
});