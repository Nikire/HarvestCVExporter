const parseLinkHeader = require('./parseLinkHeader');

module.exports = async function getAllCandidates(axios, accessToken) {
	const baseUrl =
		'https://harvest.greenhouse.io/v3/candidates?per_page=500' +
		'&fields=' +
		encodeURIComponent('id,first_name,last_name');

	const headers = {
		accept: 'application/json',
		authorization: 'Bearer ' + accessToken,
	};

	const byId = new Map();
	const duplicates = [];
	let nextUrl = baseUrl;
	let totalFetched = 0;
	let page = 0;

	while (nextUrl) {
		try {
			page += 1;
			const res = await axios.get(nextUrl, {headers});
			const items = Array.isArray(res.data) ? res.data : [];
			totalFetched += items.length;

			for (const it of items) {
				const id = it?.id;
				if (id == null) continue;
				if (byId.has(id)) duplicates.push(id);
				else byId.set(id, it);
			}

			console.log(
				`✅ CANDIDATES - Página ${page}: recibidos=${items.length}, únicos=${byId.size}, duplicados=${duplicates.length}`
			);

			const links = parseLinkHeader(res.headers?.link);
			nextUrl = links?.next ?? null;
		} catch (err) {
			if (err?.response?.status === 429) {
				const retryAfter = Number(err.response.headers?.['retry-after']);
				if (!Number.isNaN(retryAfter) && retryAfter > 0) {
					await new Promise((r) => setTimeout(r, retryAfter * 1000));
					continue;
				}
				const reset = Number(err.response.headers?.['x-ratelimit-reset']);
				if (!Number.isNaN(reset) && reset * 1000 > Date.now()) {
					await new Promise((r) => setTimeout(r, reset * 1000 - Date.now()));
					continue;
				}
			}
			throw err;
		}
	}

	return Array.from(byId.values());
};
