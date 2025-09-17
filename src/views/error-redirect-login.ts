import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { Main } from './main.js';

export function ErrorRedirectLogin(): HtmlEscapedString | Promise<HtmlEscapedString> {
	return Main(html`
		<p>Please login first: <a href="/login">Login</a></p>
		`, { title: 'Auth Required', description: 'Login first to access the page' }
	);
}
