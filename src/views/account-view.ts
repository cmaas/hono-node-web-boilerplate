import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { Account } from '../models/account.js';
import type { SessionToken } from '../models/token.js';
import type { FormValues } from '../types.js';
import { Main, MainReduced } from './main.js';

export function AccountView(props: { account: Account; session: SessionToken; activeSessions: Array<SessionToken> }): HtmlEscapedString | Promise<HtmlEscapedString> {
	return Main(
		html`
		<h1>Your Account</h1>
		<p>Email:
			<span style="padding:1px 5px;border-radius:20px;background-color:${props.account.emailVerified > 0 ? 'oklch(93.8% 0.127 124.321)' : 'oklch(88.5% 0.062 18.334)'}">${props.account.email}</span>
		</p>
		<p><a href="/account/change-email">change email</a> <a href="/account/change-password">change password</a></p>
		${
			props.account.emailVerified <= 0 &&
			html`
			<form action="/account/request-verification" method="post">
				<button style="width:auto;" type="submit">Request email verification</button>
			</form>
		`
		}
		<div style="display: flex; gap: 0.5rem;">
			<form action="/account/logout" method="post">
				<button style="width:auto;" type="submit">Logout</button>
			</form>
			${
				props.activeSessions.length > 1 &&
				html`
			<form action="/account/logout/all" method="post">
				<button style="width:auto;" type="submit">Logout all devices</button>
			</form>
		</div>
		`
			}

		<hr>
		<h2>Active Sessions</h2>
		<ul>
			${props.activeSessions.map(
				(session) => html`
				<li>
					Session ID: ${session.id} <br>
					First seen: ${new Date(session.created).toLocaleString()}<br>
					Last seen: ${new Date(session.payload?.lastActivity || 0).toLocaleString()}<br>
					${session.payload?.previousVisit ? `Previous visit: ${new Date(session.payload?.previousVisit).toLocaleString()}<br>` : ''}
					Device: ${session.payload?.userAgent} <br>
					Expires: ${new Date(session.expires).toLocaleString()} <br>
					${
						session.id === props.session.id
							? html`<strong>(Current Session)</strong>`
							: html`
							<form action="/account/revoke-session/${session.id}" method="post" style="display:inline;" onsubmit="return confirmRevoke(event)">
								<button type="submit" style="width:auto;background-color:#d32f2f;">Revoke Session</button>
							</form>
						`
					}
				</li>
			`,
			)}
		</ul>

		<script>
			function confirmRevoke(event) {
				if (!confirm('Are you sure you want to revoke this session? The device will be logged out immediately.')) {
					event.preventDefault();
					return false;
				}
				return true;
			}

			function showModal(id) {
				const dialog = document.getElementById(id);
				if (dialog) {
					dialog.showModal();
				}
			}
		</script>
		`,
		{ title: 'Your Account' },
		{ account: props.account },
	);
}

export function ChangePasswordForm({ values, errors }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(
		html`
		<form action="/account/change-password" method="post">
			<article class="stack">
				<h1>Change Password</h1>
				${errors.length > 0 ? html`<ul class="error" style="color:red;">${errors.map((err) => html`<li>${err.message}</li>`)}</ul>` : ''}
				<label for="password">New Password:</label>
				<input style="--spacing-md: 0.5rem;" type="text" name="password" id="password" value="${values.password}" placeholder="New Password" required>
				<label for="current-password">Current Password:</label>
				<input style="--spacing-md: 0.5rem;" type="text" name="currentPassword" id="current-password" value="${values.currentPassword}" placeholder="Current Password" required>
				<footer>
					<a href="/account">Cancel</a>
					<button style="width:auto;" type="submit">Change Password</button>
				</footer>
			</article>
		</form>
		`,
		{ title: 'Change Password' },
	);
}

export function ChangeEmailForm({ values, errors }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(
		html`
		<form action="/account/change-email" method="post">
			<article class="stack">
				<h1>Change Email Address</h1>
				${errors.length > 0 ? html`<ul class="error" style="color:red;">${errors.map((err) => html`<li>${err.message}</li>`)}</ul>` : ''}
				<label for="password">New Email:</label>
				<input style="--spacing-md: 0.5rem;" type="text" name="email" id="email" value="${values.email}" placeholder="New Email" required>
				<label for="current-password">Current Password:</label>
				<input style="--spacing-md: 0.5rem;" type="text" name="currentPassword" id="current-password" value="${values.currentPassword}" placeholder="Current Password" required>
				<footer>
					<a href="/account">Cancel</a>
					<button type="submit">Change Email</button>
				</footer>
			</article>
		</form>
		`,
		{ title: 'Change Password' },
	);
}
