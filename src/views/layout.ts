import { html, raw } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';

export interface SiteMetaData {
	title: string;
	description?: string;
}

export function Layout(children: HtmlEscapedString | Promise<HtmlEscapedString>, siteMetaData?: SiteMetaData): HtmlEscapedString | Promise<HtmlEscapedString> {
	return html`
		<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1">
				${siteMetaData?.description && siteMetaData.description?.length > 0 && html`<meta name="description" content="${siteMetaData.description}">`}
				<title>${siteMetaData?.title || 'Title missing'}</title>
				<!-- <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2.1.1/css/pico.classless.pink.min.css"> -->
				<link rel="stylesheet" href="/style.css">
			</head>
			<body>${raw(children)}</body>
		</html>
	`;
}
