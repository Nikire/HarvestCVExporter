const parseLinkHeader = require('./parseLinkHeader');

module.exports = async function getAllAttachments(axios, accessToken) {
	const baseUrl =
		'https://harvest.greenhouse.io/v3/attachments?per_page=500&type=resume' +
		'&fields=' +
		encodeURIComponent('id,application_id,candidate_id,url,type,created_at');

	const headers = {
		accept: 'application/json',
		authorization: 'Bearer ' + accessToken,
	};

	const byId = new Map(); // <-- únicos por id
	const duplicates = []; // <-- para diagnosticar si hay repetidos
	let nextUrl = baseUrl;
	let totalFetched = 0; // todos los items recibidos (incluyendo repetidos)
	let page = 0;

	while (nextUrl) {
		try {
			page += 1;
			const options = {method: 'GET', url: nextUrl, headers};
			const res = await axios.request(options);

			const items = Array.isArray(res.data) ? res.data : [];
			totalFetched += items.length;

			for (const it of items) {
				const id = it?.id;
				if (id == null) continue;
				if (byId.has(id)) {
					duplicates.push(id);
				} else {
					byId.set(id, it);
				}
			}

			console.log(
				`✅ ATTATCHMENTS - Página ${page}: recibidos=${items.length}, acumulados(unicos)=${byId.size}, duplicados=${duplicates.length}`
			);

			const links = parseLinkHeader(res.headers?.link);
			nextUrl = links['next'] ?? null;
		} catch (err) {
			// Rate limit handling
			if (err?.response?.status === 429) {
				const retryAfter = Number(err.response.headers?.['retry-after']);
				if (!Number.isNaN(retryAfter) && retryAfter > 0) {
					await new Promise((r) => setTimeout(r, retryAfter * 1000));
					continue; // reintenta misma URL
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

	const list = Array.from(byId.values());

	return list;
};
