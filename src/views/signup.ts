import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import type { FormValues } from '../types.js';
import { Main } from './main.js';


export function SignupForm({ values, errors }: FormValues): HtmlEscapedString | Promise<HtmlEscapedString> {
	return Main(html`
		<h1>Create an account</h1>
		<form method="POST" action="/signup" class="stack">
			${errors.length > 0 ? html`<ul class="error" style="color:red;">${errors.map(err => html`<li>${err.message}</li>`)}</ul>` : ''}
			<fieldset class="stack">
				<input type="text" name="email" placeholder="Email" value="${values.email || ""}" aria-invalid="${!!errors.find(e => e.field === 'email')}"/>
				<input type="password" name="password" placeholder="Password" value="${values.password || ""}" aria-invalid="${!!errors.find(e => e.field === 'password')}"/>
				<label>
	    			<input name="show-password" type="checkbox" role="switch" onchange="document.getElementsByName('password')[0].type = this.checked ? 'text' : 'password'"> Show password
  				</label>
			</fieldset>
      		<button type="submit">Sign Up</button>
    	</form>
		<p>Already have an account? <a href="/login">Login</a></p>
		`, { title: 'Sign Up', description: 'Create a new account' }
	);
}
