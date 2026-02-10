import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { MainReduced } from './main.js';

export function ElevateView(props: { next: string; error?: string }): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(
		html`
		<form action="/account/elevate" method="post">
			<article class="stack">
				<h1>Confirm Your Password</h1>
				<p>Please enter your current password to continue.</p>
				${props.error ? html`<p style="color:red;">${props.error}</p>` : ''}
				<input type="hidden" name="next" value="${props.next}">
				<label for="currentPassword">Current Password:</label>
				<input type="password" name="currentPassword" id="currentPassword" placeholder="Current Password" required autofocus>
				<footer>
					<a href="/account">Cancel</a>
					<button style="width:auto;" type="submit">Confirm</button>
				</footer>
			</article>
		</form>
		`,
		{ title: 'Confirm Password' },
	);
}
