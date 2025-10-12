import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { FormValues } from '../types.js';
import { Main } from './main.js';

export function LoginForm({ values, errors }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	const siteMetaData = { title: 'Login', description: 'Login to your account' };
	return Main(html`
		<h1>Login</h1>
		<form method="POST" action="/login" class="stack">
			<input type="text" name="email" value="${values.email || ""}" placeholder="Email" aria-invalid="${!!errors.find(e => e.field === 'email')}"/>
			${errors.find(e => e.field === 'email') ? html`<div class="error" style="color:red;">${errors.find(e => e.field === 'email')?.message}</div>` : ''}
			<input type="password" name="password" placeholder="Password" aria-invalid="${!!errors.find(e => e.field === 'password')}"/>
			${errors.find(e => e.field === 'password') ? html`<div class="error" style="color:red;">${errors.find(e => e.field === 'password')?.message}</div>` : ''}
			<button type="submit">Login</button>
		</form>
		<p>Don't have an account? <a href="/signup">Sign up</a> &middot; <a href="/reset-password">Forgot your password?</a></p>
		`,
		siteMetaData
	);
}
