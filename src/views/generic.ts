import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { MainReduced } from './main.js';

export function ErrorView(props: { title?: string; message: string; showAccountButton?: boolean; showLoginButton?: boolean }): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(
		html`
		<article class="stack">
			<h1>${props.title ? props.title : 'Error'}</h1>
			<p>${props.message}</p>
			${props.showAccountButton ? html`<p><a href="/account">Go to Account</a></p>` : ''}
			${props.showLoginButton ? html`<p><a href="/login">Go to Login</a></p>` : ''}
			${!props.showAccountButton && !props.showLoginButton ? html`<p>Go to <a href="/">Home</a>.</p>` : ''}
		</article>
		`,
		{ title: props.title ? props.title : 'Error' },
	);
}

export function SuccessView(props: { title?: string; message: string; showAccountButton?: boolean; showLoginButton?: boolean }): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(
		html`
		<article class="stack">
			<h1>${props.title ? props.title : 'Success'}</h1>
			<p>${props.message}</p>
			${props.showAccountButton ? html`<p><a href="/account">Go to Account</a></p>` : ''}
			${props.showLoginButton ? html`<p><a href="/login">Go to Login</a></p>` : ''}
			${!props.showAccountButton && !props.showLoginButton ? html`<p>Go to <a href="/">Home</a>.</p>` : ''}
		</article>
		`,
		{ title: props.title ? props.title : 'Success' },
	);
}
