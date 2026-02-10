export type AccountRole = 'admin' | 'user';

export interface Account {
	id: string;
	created: number;
	updated: number;
	email: string;
	password: string;
	emailVerified: number;
	role: AccountRole;
}

export interface PaginatedAccounts {
	accounts: Array<Account>;
	totalCount: number;
}
