module.exports = async function generateAccessToken(axios, HARVEST_API_KEY) {
	const encodedKey = Buffer.from(`${HARVEST_API_KEY}:`).toString('base64');
	const options = {
		method: 'POST',
		url: 'https://harvest.greenhouse.io/auth/token',
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			authorization: 'Basic ' + encodedKey,
		},
	};

	return axios
		.request(options)
		.then((res) => res.data.access_token)
		.catch((err) => console.error(err));
};
