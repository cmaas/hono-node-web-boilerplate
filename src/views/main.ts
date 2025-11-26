import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { Account } from '../models/account.js';
import { Layout, type SiteMetaData } from './layout.js';

export function Main(children: HtmlEscapedString | Promise<HtmlEscapedString>, siteMetaData: SiteMetaData, props?: { account: Account }): HtmlEscapedString | Promise<HtmlEscapedString> {
	return Layout(
		html`
		<header>
			<nav class="container">
				<ul>
					<li><a href="/">Home</a></li>
					${props?.account ? html`<li><a href="/account">Account</a></li>${props.account.role === 'admin' ? html`<li><a href="/admin">Admin</a></li>` : ''}` : html`<li><a href="/signup">Signup</a></li><li><a href="/login">Login</a></li>`}
				</ul>
			</nav>
		</header>
		<main class="stack container">
			${raw(children)}
		</main>
		<footer class="container">Created with <a target="_blank" href="https://github.com/cmaas/hono-node-web-boilerplate?ref=template-footer">Hono Node Web Boilerplate</a></footer>
		`,
		siteMetaData,
	);
}

export function MainReduced(children: HtmlEscapedString | Promise<HtmlEscapedString>, siteMetaData: SiteMetaData): HtmlEscapedString | Promise<HtmlEscapedString> {
	return Layout(
		html`
		<header>
			<nav class="container">
				<ul>
					<li><a href="/">Home</a></li>
				</ul>
			</nav>
		</header>
		<main class="stack container">
			${raw(children)}
		</main>
		<footer class="container">Created with <a target="_blank" href="https://github.com/cmaas/hono-node-web-boilerplate?ref=template-footer">Hono Node Web Boilerplate</a></footer>
		`,
		siteMetaData,
	);
}
