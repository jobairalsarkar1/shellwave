export function formatDate(value: string): string {
	if (!value) {
		return 'unknown date';
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return 'unknown date';
	}

	return new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	}).format(date);
}
