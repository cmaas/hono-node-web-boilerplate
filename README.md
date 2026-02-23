# Hono Node Web Boilerplate

This is a small boilerplate / starter project for Hono with the focus on:

- SQLite as DB (via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3))
- Server-side rendering using Hono's [htmlHelper](https://hono.dev/docs/helpers/html)
- Nested HTML layouts (beware of props drilling, wouldn't recommend nesting too deeply)
- Basic account functionality:
	- signup (with or without password), hashing via bcryptjs
	- login (with classic server-side session / remember me token)
	- logout
	- forgot password
	- verify email
- Basic admin role and very basic admin dashboard (view recent users, view user details, search by id, email or role)
- CSRF protection via cookie sameSite=lax + state-changing actions performed as POST requests
- No magic middleware, just plain controllers to keep [cognitive load](https://github.com/zakirullin/cognitive-load) simple. Optionally a middleware that does the basic "has account" check


## How to use & Setup

Consider this project as a starting point or learning resource and customize to your needs. Clone the project, then init a new SQLite DB:

```bash
sqlite3 mydata.db < spec/data.sql
```

Init a new .env file:
```bash
echo "CRON_API_KEY=\"$(openssl rand -hex 32)\"" > .env
```

Then start the Hono Node server via:

```
npm run dev
```

Open [localhost:3000](http://localhost:3000/) in your browser and sign up a new user. If you want an admin user, change the user's role to `admin` manually with your favorite SQLite browser / editor.


## Security

- Critical routes should be rate-limited by your web server


## Next steps (not implemented)

- Full admin functionality to edit users, resend verification tokens etc.
- integrating an SMTP service to actually send emails


## Changelog

### 1.6.0 (2026-02-23)
- Added: seed.sql to automatically seed a DB with required data
- Changed: lots of small changes and improvements


### 1.5.0 (2026-02-17)
- Refactored `audit()` function to use `level` and removed `ok` from `data` prop

### 1.4.0 (2026-02-10)
- Major refactor after having used this in a project. Backported best practices.
- Added: login by token
- Added: trivial password check and loading script
- Changed: folder structure now better separates responsibilities and shows app layers
- Changed: change password, change email, delete account require current password, but we now have an "elevated privilege" mode and a specific form that elevates privileges
- Changed: EventEmitter replaced with simple `audit()`

### 1.3.0 (2026-01-12)
- Added: Privilege elevation when changing password so that the user doesn't have to enter their current password again after a critical operation. Applies to: change email, change password, reset password

### 1.2.0 (2025-11-26)
- Added: pagination utils, session last visit tracking, better logging, more events in user flow, session management, logout all sessions

### 1.1.0 (2025-10-12)
- Removed Pico CSS for a very lightweight custom stylesheet