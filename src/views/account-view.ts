import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { Account } from '../domain/account.js';
import type { FormValues } from '../domain/form.js';
import type { SessionToken } from '../domain/token.js';
import { Main, MainReduced } from './main.js';

/**
 * Format remaining elevation time as "Xm Ys" or "Ys" if less than a minute
 */
function formatElevationTime(remainingMs: number): string {
	if (remainingMs <= 0) return '';
	const totalSeconds = Math.ceil(remainingMs / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}m ${seconds}s`;
	}
	return `${seconds}s`;
}

export function AccountView(props: {
	account: Account;
	session: SessionToken;
	activeSessions: Array<SessionToken>;
	flash?: { type: 'success' | 'error' | 'info'; message: string };
}): HtmlEscapedString | Promise<HtmlEscapedString> {
	return Main(
		html`
		${props.flash ? html`<div style="padding: 0.75rem 1rem; margin-bottom: 1rem; border-radius: 4px; background-color: ${props.flash.type === 'success' ? 'oklch(93.8% 0.127 124.321)' : props.flash.type === 'error' ? 'oklch(88.5% 0.062 18.334)' : 'oklch(93% 0.1 220)'}">${props.flash.message}</div>` : ''}
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
					${session.payload?.previousVisit ? html`Previous visit: ${new Date(session.payload?.previousVisit).toLocaleString()}<br>` : ''}
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

		<hr>
		<p><a href="/account/delete" style="color:#d32f2f;">Delete account</a></p>

		<script>
			function confirmRevoke(event) {
				if (!confirm('Are you sure you want to revoke this session? The device will be logged out immediately.')) {
					event.preventDefault();
					return false;
				}
				return true;
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
				<input style="--spacing-md: 0.5rem;" type="password" name="password" id="password" value="${values.password}" placeholder="New Password" required>
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
				<label for="email">New Email:</label>
				<input style="--spacing-md: 0.5rem;" type="email" name="email" id="email" value="${values.email}" placeholder="New Email" required>
				<footer>
					<a href="/account">Cancel</a>
					<button type="submit">Change Email</button>
				</footer>
			</article>
		</form>
		`,
		{ title: 'Change Email' },
	);
}
