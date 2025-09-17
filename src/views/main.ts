import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { Account } from '../models/account.js';
import { Layout, type SiteMetaData } from './layout.js';

export function Main(children: HtmlEscapedString | Promise<HtmlEscapedString>, siteMetaData: SiteMetaData, props?: { account: Account }): HtmlEscapedString | Promise<HtmlEscapedString> {
	return Layout(html`
		<header>
			<nav>
				<ul>
					<li><a href="/">Home</a></li>
					${props?.account
						? html`<li><a href="/account">Account</a></li>${props.account.role === 'admin' ? html`<li><a href="/admin">Admin</a></li>` : ''}`
						: html`<li><a href="/signup">Signup</a></li><li><a href="/login">Login</a></li>`}
				</ul>
			</nav>
		</header>
		<main>
			${raw(children)}
		</main>
		`, siteMetaData
	);
}

export function MainReduced(children: HtmlEscapedString | Promise<HtmlEscapedString>, siteMetaData: SiteMetaData): HtmlEscapedString | Promise<HtmlEscapedString> {
	return Layout(html`
		<header>
			<nav>
				<ul>
					<li><a href="/">Home</a></li>
				</ul>
			</nav>
		</header>
		<main>
			${raw(children)}
		</main>
		`, siteMetaData
	);
}
