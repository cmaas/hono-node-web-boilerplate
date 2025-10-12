import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { Account } from '../models/account.js';
import { MainReduced } from './main.js';

export function AdminView(props: { accounts: Array<Account>, query: string | null }): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(html`
		<h1>Admin Dashboard</h1>
		<form action="/admin" method="get">
			<input type="search" name="q" placeholder="Search by ID, email, role" value="${props.query || ''}">
		</form>
		${props.accounts.length === 0 ? html`<p>No accounts found.</p>` : html`
			<table>
				<thead>
					<tr>
						<th>ID</th>
						<th>Created</th>
						<th>Email</th>
						<th>Role</th>
					</tr>
				</thead>
				<tbody>
					${props.accounts.map(account => html`
						<tr>
							<td><a href="/admin/account-details?id=${account.id}">${account.id}</a></td>
							<td>${new Date(account.created).toLocaleString()}</td>
							<td><span style="padding:1px 5px;border-radius:20px;background-color:${account.emailVerified > 0 ? 'oklch(93.8% 0.127 124.321)' : 'oklch(88.5% 0.062 18.334)'}">${account.email}</span></td>
							<td>${account.role}</td>
						</tr>
					`)}
				</tbody>
			</table>
		`}
		`,
		{ title: 'Admin Dashboard' }
	);
}

export function AdminAccountDetailsView(props: { account: Account }): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(html`
		<h1>Account Details</h1>
		<p>ID: ${props.account.id}</p>
		<p>Email: <span style="padding:1px 5px;border-radius:20px;background-color:${props.account.emailVerified > 0 ? 'oklch(93.8% 0.127 124.321)' : 'oklch(88.5% 0.062 18.334)'}">${props.account.email}</span></p>
		<p>Role: ${props.account.role}</p>
		<p>Created: ${new Date(props.account.created).toLocaleString()}</p>
		<p>Updated: ${new Date(props.account.updated).toLocaleString()}</p>
		<a href="/admin">Back to Admin Dashboard</a>
		`,
		{ title: 'Account Details' }
	);
}