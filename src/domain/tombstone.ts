export interface Tombstone {
	id: string;
	email?: string;
	reason?: string;
	created: number; // UNIX timestamp - when account was created
	deleted: number; // UNIX timestamp - when account was deleted
	pruned: number; // UNIX timestamp - when data was pruned
}
