export const EMAIL_VERIFY = {
	subject: 'Please verify your email',
	body: (token: string) => `Click the link to verify your email: http://localhost:3000/verify-email?token=${token}`,
};

export function sendEmail(to: string, subject: string, body: string): void {
	console.log(`Sending email to ${to} with subject "${subject}" and body:\n${body}`);
}
