export type FormValues = {
	values: Record<string, unknown>;
	errors: Array<{
		field: string;
		message: string;
	}>;
};

export type SensitiveFormValues = FormValues & {
	elevated: boolean;
	elevationRemaining: number; // milliseconds remaining
};
