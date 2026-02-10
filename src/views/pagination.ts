import { html } from 'hono/html';
import type { HtmlEscapedString } from 'hono/utils/html';
import { generatePageNumbers } from '../utils/util.js';

export interface PaginationProps {
	page: number;
	pageCount: number;
	baseUrl?: string;
	queryParams?: Record<string, string>;
}

export function Pagination(props: PaginationProps): HtmlEscapedString | Promise<HtmlEscapedString> {
	const { page, pageCount, baseUrl = '', queryParams = {} } = props;

	const buildUrl = (pageNum: number): string => {
		const params = new URLSearchParams({ ...queryParams, page: pageNum.toString() });
		return `${baseUrl}?${params.toString()}`;
	};

	if (pageCount <= 1) {
		return html``;
	}

	const pages = generatePageNumbers(page, pageCount);
	const prevDisabled = page <= 1;
	const nextDisabled = page >= pageCount;

	return html`
		<nav aria-label="Page navigation" class="pagination">
			<ul>
				<li>
					${
						prevDisabled
							? html`<a href="${buildUrl(1)}" class="pagination-item disabled pointer-events-none">
								<span class="sr-only">Previous Page</span>
								<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
									<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 1 1 5l4 4"/>
								</svg>
							</a>`
							: html`<a href="${buildUrl(page - 1)}" class="pagination-item">
								<span class="sr-only">Previous Page</span>
								<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
									<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 1 1 5l4 4"/>
								</svg>
							</a>`
					}
				</li>
				${pages.map((pageNum: number) => {
					if (pageNum === 0) {
						return html`<li class="px-2">...</li>`;
					}
					if (pageNum === page) {
						return html`<li><a aria-current="page" class="pagination-item current-page" href="${buildUrl(pageNum)}">${pageNum}</a></li>`;
					}
					return html`<li><a class="pagination-item" href="${buildUrl(pageNum)}">${pageNum}</a></li>`;
				})}
				<li>
					${
						nextDisabled
							? html`<a href="${buildUrl(pageCount)}" class="pagination-item disabled pointer-events-none">
								<span class="sr-only">Next Page</span>
								<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
									<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4"/>
								</svg>
							</a>`
							: html`<a href="${buildUrl(page + 1)}" class="pagination-item">
								<span class="sr-only">Next Page</span>
								<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 10">
									<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 9 4-4-4-4"/>
								</svg>
							</a>`
					}
				</li>
			</ul>
		</nav>
	`;
}
