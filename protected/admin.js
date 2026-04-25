const searchForm = document.getElementById("searchForm");
const searchField = document.getElementById("searchField");
const searchInput = document.getElementById("search");
const resetSearch = document.getElementById("resetSearch");

const auditLogTableBody = document.querySelector("#auditLogTable tbody");
const usersTableBody = document.querySelector("#usersTable tbody");
const extraInfoTableBody = document.querySelector("#extraInfoTable tbody");
const feedbackTableBody = document.querySelector("#feedbackTable tbody");

function renderAuditLog(auditLog) {
  auditLogTableBody.innerHTML = "";

  if (auditLog.length === 0) {
    auditLogTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-value">No audit log records found.</td>
      </tr>
    `;
    return;
  }

  auditLog.forEach(function(log) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatValue(log.id)}</td>
      <td>${formatValue(log.action)}</td>
      <td>${formatValue(log.user_id)}</td>
      <td class="feedback-cell">${formatValue(log.details)}</td>
      <td class="created-cell">${formatValue(log.created_at)}</td>
    `;

    auditLogTableBody.appendChild(row);
  });
}

async function loadAuditLog(search = "") {
  const response = await fetch(`/api/audit-log?search=${encodeURIComponent(search)}`);

  if (!response.ok) {
    auditLogTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-value">Failed to load audit log.</td>
      </tr>
    `;
    return;
  }

  const auditLog = await response.json();

  renderAuditLog(auditLog);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return `<span class="empty-value">—</span>`;
  }

  return escapeHTML(value);
}

function formatPasswordStatus(passwordHash) {
  if (passwordHash) {
    return `<span class="password-status hashed">Hashed</span>`;
  }

  return `<span class="password-status missing">Missing</span>`;
}

function formatGenres(genres) {
  if (!genres) {
    return `<span class="empty-value">—</span>`;
  }

  try {
    const parsedGenres = JSON.parse(genres);

    if (parsedGenres.length === 0) {
      return `<span class="empty-value">—</span>`;
    }

    return parsedGenres
      .map(function(genre) {
        return `<span class="genre-badge">${escapeHTML(genre)}</span>`;
      })
      .join("");
  } catch {
    return formatValue(genres);
  }
}

function formatLink(link) {
  if (!link) {
    return `<span class="empty-value">—</span>`;
  }

  const safeLink = escapeHTML(link);

  return `<a href="${safeLink}" target="_blank">Open link</a>`;
}

function renderUsers(users) {
  usersTableBody.innerHTML = "";

  if (users.length === 0) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-value">No users found.</td>
      </tr>
    `;
    return;
  }

  users.forEach(function(user) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatValue(user.id)}</td>
      <td>${formatValue(user.first_name)}</td>
      <td>${formatValue(user.last_name)}</td>
      <td class="email-cell">${formatValue(user.email)}</td>
      <td>${formatPasswordStatus(user.password_hash)}</td>
      <td>${formatValue(user.country)}</td>
      <td>${formatValue(user.age)}</td>
      <td>${formatValue(user.phone)}</td>
      <td class="created-cell">${formatValue(user.created_at)}</td>
      <td>
        <button type="button" class="delete-btn" onclick="deleteUser(${user.id})">
          Delete
        </button>
      </td>
    `;

    usersTableBody.appendChild(row);
  });
}

function renderExtraInfo(extraInfo) {
  extraInfoTableBody.innerHTML = "";

  if (extraInfo.length === 0) {
    extraInfoTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-value">No extra information found.</td>
      </tr>
    `;
    return;
  }

  extraInfo.forEach(function(info) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatValue(info.id)}</td>
      <td>${formatValue(info.user_id)}</td>
      <td>${formatGenres(info.genres)}</td>
      <td>${formatValue(info.platform)}</td>
      <td>${formatValue(info.bans)}</td>
      <td class="link-cell">${formatLink(info.steam_link)}</td>
    `;

    extraInfoTableBody.appendChild(row);
  });
}

function renderFeedback(feedback) {
  feedbackTableBody.innerHTML = "";

  if (feedback.length === 0) {
    feedbackTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-value">No feedback found.</td>
      </tr>
    `;
    return;
  }

  feedback.forEach(function(item) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatValue(item.id)}</td>
      <td>${formatValue(item.user_id)}</td>
      <td class="feedback-cell">${formatValue(item.message)}</td>
      <td class="created-cell">${formatValue(item.created_at)}</td>
    `;

    feedbackTableBody.appendChild(row);
  });
}

async function loadAdminData(search = "", field = "all") {
  const response = await fetch(
    `/api/admin-search?search=${encodeURIComponent(search)}&field=${encodeURIComponent(field)}`
  );

  if (!response.ok) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-value">Failed to load users.</td>
      </tr>
    `;

    extraInfoTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="empty-value">Failed to load extra information.</td>
      </tr>
    `;

    feedbackTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-value">Failed to load feedback.</td>
      </tr>
    `;

    return;
  }

  const data = await response.json();

  renderUsers(data.users);
  renderExtraInfo(data.extraInfo);
  renderFeedback(data.feedback);
}

searchForm.addEventListener("submit", function(event) {
  event.preventDefault();

  loadAdminData(searchInput.value.trim(), searchField.value);
  loadAuditLog(searchInput.value.trim());
});

resetSearch.addEventListener("click", function() {
  searchInput.value = "";
  searchField.value = "all";

  loadAdminData();
  loadAuditLog();
});

async function deleteUser(id) {
  const isConfirmed = confirm("Are you sure you want to delete this user?");

  if (!isConfirmed) {
    return;
  }

  const response = await fetch(`/api/users/${id}`, {
    method: "DELETE"
  });

  const result = await response.json();

  alert(result.message);

  if (response.ok) {
    loadAdminData(searchInput.value.trim(), searchField.value);
    loadAuditLog(searchInput.value.trim());
  }
}

loadAdminData();
loadAuditLog();