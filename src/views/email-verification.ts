import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { FormValues } from '../types.js';
import { Main } from './main.js';

export function EmailVerifyForm({ values }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	return Main(html`
		<h1>Verify Your Email</h1>
		<p>Click the button to verify your email.</p>
		<form id="verify-email-form" method="POST" action="/verify-email">
			<input type="hidden" name="token" value="${values.token}">
			<button type="submit">Verify Email</button>
		</form>
		<script>
			document.addEventListener('DOMContentLoaded', () => document.getElementById('verify-email-form').submit());
		</script>
		`, { title: 'Verify Email' }
	);
}