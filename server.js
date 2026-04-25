const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");

const app = express();

const publicDir = path.join(__dirname, "public");
const protectedDir = path.join(__dirname, "protected");
const dataDir = path.join(__dirname, "data");

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "database.db"));

app.use(express.static(publicDir));
db.pragma("foreign_keys = ON");

app.use(cors());
app.use(express.json());

app.use(express.urlencoded({ extended: false }));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const ADMIN_COOKIE_NAME = "admin_access";
const ADMIN_COOKIE_VALUE = "local_admin_access";

function getCookie(req, cookieName) {
  const cookies = req.headers.cookie;

  if (!cookies) {
    return null;
  }

  const cookieList = cookies.split(";");

  for (const cookie of cookieList) {
    const [name, value] = cookie.trim().split("=");

    if (name === cookieName) {
      return value;
    }
  }

  return null;
}

function isAdmin(req) {
  return getCookie(req, ADMIN_COOKIE_NAME) === ADMIN_COOKIE_VALUE;
}

function requireAdminPage(req, res, next) {
  if (!isAdmin(req)) {
    return res.redirect("/admin-login.html");
  }

  next();
}

function requireAdminApi(req, res, next) {
  if (!isAdmin(req)) {
    return res.status(401).json({ message: "Admin access required." });
  }

  next();
}


app.post("/admin-login", function(req, res) {
  const password = req.body.password;

  if (password !== ADMIN_PASSWORD) {
  return res.redirect("/admin-login.html?error=wrong_password");
  }

  res.cookie(ADMIN_COOKIE_NAME, ADMIN_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax"
  });

  res.redirect("/admin.html");
});

app.post("/admin-logout", function(req, res) {
  res.clearCookie(ADMIN_COOKIE_NAME);
  res.redirect("/admin-login.html");
});

app.get("/admin.html", requireAdminPage, function(req, res) {
  res.sendFile(path.join(protectedDir, "admin.html"));
});

app.get("/admin.js", requireAdminPage, function(req, res) {
  res.sendFile(path.join(protectedDir, "admin.js"));
});

app.get("/api/users", requireAdminApi, function(req, res) {
    try {
    const users = db.prepare(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        password_hash,
        country,
        age,
        phone,
        created_at
      FROM users
      ORDER BY id ASC
    `).all();

    res.json(users);
  } catch (error) {
    console.error("Error loading users:", error);
    res.status(500).json({ message: "Server error while loading users." });
  }
});

app.get("/api/user-extra-info", requireAdminApi, function(req, res) {
    try {
    const extraInfo = db.prepare(`
      SELECT
        id,
        user_id,
        genres,
        platform,
        bans,
        steam_link
      FROM user_extra_info
      ORDER BY id ASC
    `).all();

    res.json(extraInfo);
  } catch (error) {
    console.error("Error loading extra info:", error);
    res.status(500).json({ message: "Server error while loading extra info." });
  }
});

app.get("/api/user-feedback", requireAdminApi, function(req, res) {
    try {
    const feedback = db.prepare(`
      SELECT
        id,
        user_id,
        message,
        created_at
      FROM user_feedback
      ORDER BY id ASC
    `).all();

    res.json(feedback);
  } catch (error) {
    console.error("Error loading feedback:", error);
    res.status(500).json({ message: "Server error while loading feedback." });
  }
});

app.get("/api/audit-log", requireAdminApi, function(req, res) {
  try {
    const search = (req.query.search || "").trim();
    const searchValue = `%${search}%`;

    let auditLog;

    if (search === "") {
      auditLog = db.prepare(`
        SELECT
          id,
          action,
          user_id,
          details,
          created_at
        FROM audit_log
        ORDER BY id ASC
      `).all();
    } else {
      auditLog = db.prepare(`
        SELECT
          id,
          action,
          user_id,
          details,
          created_at
        FROM audit_log
        WHERE
          action LIKE ?
          OR CAST(user_id AS TEXT) LIKE ?
          OR details LIKE ?
          OR created_at LIKE ?
        ORDER BY id ASC
      `).all(searchValue, searchValue, searchValue, searchValue);
    }

    res.json(auditLog);
  } catch (error) {
    console.error("Error loading audit log:", error);
    res.status(500).json({ message: "Server error while loading audit log." });
  }
});

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    country TEXT NOT NULL,
    age INTEGER NOT NULL,
    phone TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS user_extra_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    genres TEXT,
    platform TEXT,
    bans INTEGER,
    steam_link TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS user_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    user_id INTEGER,
    details TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TRIGGER IF NOT EXISTS log_user_insert
  AFTER INSERT ON users
  BEGIN
    INSERT INTO audit_log (
      action,
      user_id,
      details
    )
    VALUES (
      'USER_REGISTERED',
      NEW.id,
      'New user registered: ' || NEW.first_name || ' ' || NEW.last_name || ', email: ' || NEW.email
    );
  END;
`).run();

db.prepare(`
  CREATE TRIGGER IF NOT EXISTS log_user_delete
  AFTER DELETE ON users
  BEGIN
    INSERT INTO audit_log (
      action,
      user_id,
      details
    )
    VALUES (
      'USER_DELETED',
      OLD.id,
      'Deleted user: ' || OLD.first_name || ' ' || OLD.last_name || ', email: ' || OLD.email
    );
  END;
`).run();

app.post("/register", async function(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      country,
      age,
      genres,
      platform,
      bans,
      phone,
      link,
      feedback
    } = req.body;

    if (!firstName || !lastName || !email || !password || !country || !age) {
      return res.status(400).json({ message: "Please fill in all required fields." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    if (age < 13 || age > 120) {
      return res.status(400).json({ message: "Age must be between 13 and 120." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const insertUser = db.prepare(`
      INSERT INTO users (
        first_name,
        last_name,
        email,
        password_hash,
        country,
        age,
        phone
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertExtraInfo = db.prepare(`
      INSERT INTO user_extra_info (
        user_id,
        genres,
        platform,
        bans,
        steam_link
      )
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertFeedback = db.prepare(`
      INSERT INTO user_feedback (
        user_id,
        message
      )
      VALUES (?, ?)
    `);

    const saveRegistration = db.transaction(function() {
      const userResult = insertUser.run(
        firstName,
        lastName,
        email,
        passwordHash,
        country,
        age,
        phone
      );

      const userId = userResult.lastInsertRowid;

      insertExtraInfo.run(
        userId,
        JSON.stringify(genres),
        platform,
        bans,
        link
      );

      if (feedback && feedback.trim() !== "") {
        insertFeedback.run(userId, feedback);
      }

      return userId;
    });

    saveRegistration();

    res.status(201).json({ message: "Registration successful." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "This email is already registered." });
    }

    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error." });
  }
});

app.delete("/api/users/:id", requireAdminApi, function(req, res) {
    try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const result = db.prepare(`
      DELETE FROM users
      WHERE id = ?
    `).run(id);

    if (result.changes === 0) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error while deleting user." });
  }
});

app.get("/api/admin-search", requireAdminApi, function(req, res) {
  try {
    const search = (req.query.search || "").trim();
    const field = req.query.field || "all";

    if (search === "") {
      const users = db.prepare(`
        SELECT
          id,
          first_name,
          last_name,
          email,
          password_hash,
          country,
          age,
          phone,
          created_at
        FROM users
        ORDER BY id ASC
      `).all();

      const extraInfo = db.prepare(`
        SELECT
          id,
          user_id,
          genres,
          platform,
          bans,
          steam_link
        FROM user_extra_info
        ORDER BY id ASC
      `).all();

      const feedback = db.prepare(`
        SELECT
          id,
          user_id,
          message,
          created_at
        FROM user_feedback
        ORDER BY id ASC
      `).all();

      return res.json({
        users: users,
        extraInfo: extraInfo,
        feedback: feedback
      });
    }

    const searchValue = `%${search}%`;

    let matchedUsers;

    if (field === "all") {
      matchedUsers = db.prepare(`
        SELECT id AS user_id
        FROM users
        WHERE
          CAST(id AS TEXT) LIKE ?
          OR first_name LIKE ?
          OR last_name LIKE ?
          OR email LIKE ?
          OR country LIKE ?
          OR CAST(age AS TEXT) LIKE ?
          OR phone LIKE ?
          OR created_at LIKE ?

        UNION

        SELECT user_id
        FROM user_extra_info
        WHERE
          CAST(id AS TEXT) LIKE ?
          OR CAST(user_id AS TEXT) LIKE ?
          OR genres LIKE ?
          OR platform LIKE ?
          OR CAST(bans AS TEXT) LIKE ?
          OR steam_link LIKE ?

        UNION

        SELECT user_id
        FROM user_feedback
        WHERE
          CAST(id AS TEXT) LIKE ?
          OR CAST(user_id AS TEXT) LIKE ?
          OR message LIKE ?
          OR created_at LIKE ?
      `).all(
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,

        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,
        searchValue,

        searchValue,
        searchValue,
        searchValue,
        searchValue
      );
    } else if (
      field === "first_name" ||
      field === "last_name" ||
      field === "email" ||
      field === "country" ||
      field === "age" ||
      field === "phone"
    ) {
      const allowedUserFields = {
        first_name: "first_name",
        last_name: "last_name",
        email: "email",
        country: "country",
        age: "CAST(age AS TEXT)",
        phone: "phone"
      };

      const column = allowedUserFields[field];

      matchedUsers = db.prepare(`
        SELECT id AS user_id
        FROM users
        WHERE ${column} LIKE ?
      `).all(searchValue);
    } else if (
      field === "genres" ||
      field === "platform" ||
      field === "bans" ||
      field === "steam_link"
    ) {
      const allowedExtraFields = {
        genres: "genres",
        platform: "platform",
        bans: "CAST(bans AS TEXT)",
        steam_link: "steam_link"
      };

      const column = allowedExtraFields[field];

      matchedUsers = db.prepare(`
        SELECT user_id
        FROM user_extra_info
        WHERE ${column} LIKE ?
      `).all(searchValue);
    } else if (field === "feedback") {
      matchedUsers = db.prepare(`
        SELECT user_id
        FROM user_feedback
        WHERE message LIKE ?
      `).all(searchValue);
    } else {
      return res.status(400).json({ message: "Invalid search field." });
    }

    const userIds = matchedUsers.map(function(row) {
      return row.user_id;
    });

    if (userIds.length === 0) {
      return res.json({
        users: [],
        extraInfo: [],
        feedback: []
      });
    }

    const placeholders = userIds.map(function() {
      return "?";
    }).join(",");

    const users = db.prepare(`
      SELECT
        id,
        first_name,
        last_name,
        email,
        password_hash,
        country,
        age,
        phone,
        created_at
      FROM users
      WHERE id IN (${placeholders})
      ORDER BY id ASC
    `).all(...userIds);

    const extraInfo = db.prepare(`
      SELECT
        id,
        user_id,
        genres,
        platform,
        bans,
        steam_link
      FROM user_extra_info
      WHERE user_id IN (${placeholders})
      ORDER BY id ASC
    `).all(...userIds);

    const feedback = db.prepare(`
      SELECT
        id,
        user_id,
        message,
        created_at
      FROM user_feedback
      WHERE user_id IN (${placeholders})
      ORDER BY id ASC
    `).all(...userIds);

    res.json({
      users: users,
      extraInfo: extraInfo,
      feedback: feedback
    });
  } catch (error) {
    console.error("Error in /api/admin-search:", error);
    res.status(500).json({ message: "Server error while searching admin data." });
  }
});

app.listen(3000, function() {
  console.log("Server is running on http://localhost:3000");
});