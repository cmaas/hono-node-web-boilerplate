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


## How to use

Consider this project as a starting point or learning resource and customize to your needs. Clone the project, then init a new SQLite DB:

```bash
sqlite3 mydata.db < spec/data.sql
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
- Configurable timeouts
- cron jobs to delete expired tokens
- integrating an SMTP service to actually send emails

## Changelog

### 1.1.0 (2025-10-12)
* Removed Pico CSS for a very lightweight custom stylesheet