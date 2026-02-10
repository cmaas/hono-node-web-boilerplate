import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { FormValues } from '../domain/form.js';
import { Main, MainReduced } from './main.js';

export function LoginForm({ values, errors }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	const siteMetaData = { title: 'Login', description: 'Login to your account' };
	return Main(
		html`
		<h1>Login</h1>
		<form method="POST" action="/login" class="stack">
			<input type="text" name="email" value="${values.email || ''}" placeholder="Email" aria-invalid="${!!errors.find((e) => e.field === 'email')}"/>
			${errors.find((e) => e.field === 'email') ? html`<div class="error" style="color:red;">${errors.find((e) => e.field === 'email')?.message}</div>` : ''}
			<input type="password" name="password" placeholder="Password" aria-invalid="${!!errors.find((e) => e.field === 'password')}"/>
			${errors.find((e) => e.field === 'password') ? html`<div class="error" style="color:red;">${errors.find((e) => e.field === 'password')?.message}</div>` : ''}
			<button type="submit">Login</button>
		</form>
		<p>Don't have an account? <a href="/signup">Sign up</a> &middot; <a href="/reset-password">Forgot your password?</a></p>
		`,
		siteMetaData,
	);
}

export function LoginWithTokenForm({ values, errors }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	const tokenError = errors.find((e) => e.field === 'token');

	return MainReduced(
		html`
		<article class="stack">
			<h1>Login</h1>
			${tokenError ? html`<p style="color:red;">${tokenError.message}</p>` : ''}
			<form id="token-login-form" method="POST" action="/login/t">
				<input type="hidden" name="token" value="${values.token || ''}">
				<button type="submit">Login</button>
			</form>
		</article>
		<script>
			window.addEventListener('DOMContentLoaded', function() {
				document.getElementById('token-login-form')?.submit();
			});
		</script>
		`,
		{ title: 'Login' },
	);
}
