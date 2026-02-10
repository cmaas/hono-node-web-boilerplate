import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { FormValues } from '../domain/form.js';
import { MainReduced } from './main.js';

export function DeleteAccountForm({ values, errors }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(
		html`
		<form action="/account/delete" method="post">
			<article class="stack">
				<h1 style="color:#d32f2f;">Delete Account</h1>
				<p>Your account will be <strong>permanently deleted</strong>. This action cannot be undone.</p>
				<p>To confirm, type <strong>DELETE</strong> below:</p>
				${errors.length > 0 ? html`<ul class="error" style="color:red;">${errors.map((err) => html`<li>${err.message}</li>`)}</ul>` : ''}
				<input type="text" name="confirm" id="confirm" placeholder="DELETE" value="${values.confirm || ''}" required autofocus>
				<footer>
					<a href="/account">Cancel</a>
					<button style="width:auto;background-color:#d32f2f;" type="submit">Delete Account</button>
				</footer>
			</article>
		</form>
		`,
		{ title: 'Delete Account' },
	);
}
