import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { FormValues } from '../types.js';
import { MainReduced } from './main.js';

export function PasswordResetRequestForm({ values, errors }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(html`
		<h1>Forgot Password?</h1>
		<form method="POST" action="/reset-password">
			${errors.length > 0 ? html`<ul class="error" style="color:red;">${errors.map(err => html`<li>${err.message}</li>`)}</ul>` : ''}
			<input type="text" name="email" placeholder="Email" value="${values.email || ""}" aria-invalid="${!!errors.find(e => e.field === 'email')}"/>
			<button type="submit">Send password reset email</button>
		</form>
		`, { title: 'Password Reset', description: 'Reset your password' }
	);
}

export function PasswordResetRequestSucess(): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(html`
		<h1>Reset Your Password</h1>
		<p>We've send you an email with a link to reset your password.</p>
		`, { title: 'Password Reset', description: 'Reset your password' }
	);
}

export function NewPasswordForm({ values, errors }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	return MainReduced(html`
		<h1>Enter New Password</h1>
		<form method="POST" action="/set-password">
			${errors.length > 0 ? html`<ul class="error" style="color:red;">${errors.map(err => html`<li>${err.message}</li>`)}</ul>` : ''}
			<fieldset>
				<input type="text" name="password" value="" placeholder="New Password" aria-invalid="${!!errors.find(e => e.field === 'password')}"/>
				<label>
	    			<input name="show-password" type="checkbox" role="switch" onchange="document.getElementsByName('password')[0].type = this.checked ? 'text' : 'password'"> Show password
  				</label>
			</fieldset>
			<input type="hidden" name="token" value="${values.token}">
			<button type="submit">Save new password</button>
		</form>
		`, { title: 'New Password', description: 'Set a new password' }
	);
}