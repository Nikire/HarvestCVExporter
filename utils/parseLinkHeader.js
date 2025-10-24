module.exports = function parseLinkHeader(link) {
	if (!link) return {};
	const parts = link.split(',');
	const rels = {};
	for (const p of parts) {
		const match = p.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
		if (match) {
			const [, url, rel] = match;
			rels[rel] = url;
		}
	}
	return rels;
};
