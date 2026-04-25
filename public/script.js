const form = document.getElementById("registrationForm");
const message = document.getElementById("formMessage");

form.addEventListener("submit", async function(event) {
  event.preventDefault();

  const firstName = document.getElementById("fname").value.trim();
  const lastName = document.getElementById("lname").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("pwd").value;
  const country = document.getElementById("country").value;
  const age = Number(document.getElementById("age").value);

  const platform = document.getElementById("platform").value.trim();
  const bans = Number(document.getElementById("bans").value);
  const phone = document.getElementById("phone").value.trim();
  const link = document.getElementById("link").value.trim();
  const feedback = document.getElementById("feedback").value.trim();

  const terms = document.querySelector('input[name="terms"]:checked');

  const selectedGenres = [];

  document.querySelectorAll('input[name="genres"]:checked').forEach(function(checkbox) {
    selectedGenres.push(checkbox.value);
  });

  if (firstName === "" || lastName === "" || email === "" || password === "") {
    message.textContent = "Please fill in all required fields.";
    message.style.color = "red";
    return;
  }

  if (password.length < 8) {
    message.textContent = "Password must be at least 8 characters.";
    message.style.color = "red";
    return;
  }

  if (country === "") {
    message.textContent = "You must choose one of the countries.";
    message.style.color = "red";
    return;
  }

  if (age < 13 || age > 120) {
    message.textContent = "Age must be between 13 and 120.";
    message.style.color = "red";
    return;
  }

  if (!terms || terms.value !== "yes") {
    message.textContent = "You must agree to the terms and conditions.";
    message.style.color = "red";
    return;
  }

  const userData = {
    firstName: firstName,
    lastName: lastName,
    email: email,
    password: password,
    country: country,
    age: age,
    genres: selectedGenres,
    platform: platform,
    bans: bans,
    phone: phone,
    link: link,
    feedback: feedback
  };

  try {
    const response = await fetch("/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userData)
    });

    const result = await response.json();

    message.textContent = result.message;

    if (response.ok) {
      message.style.color = "green";
      form.reset();
    } else {
      message.style.color = "red";
    }
  } catch (error) {
    message.textContent = "Cannot connect to the server.";
    message.style.color = "red";
  }
});