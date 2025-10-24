const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const archiver = require('archiver');

async function zipDirectory(srcDir, zipPath) {
	await fsp.mkdir(path.dirname(zipPath), {recursive: true});

	const output = fs.createWriteStream(zipPath);
	const archive = archiver('zip', {zlib: {level: 9}});

	const done = new Promise((resolve, reject) => {
		output.on('close', resolve);
		archive.on('warning', (err) => {
			if (err.code === 'ENOENT') console.warn('WARN:', err);
			else reject(err);
		});
		archive.on('error', reject);
	});

	archive.pipe(output);
	archive.directory(srcDir, false); // empaqueta el contenido de srcDir (no el directorio raíz)
	archive.finalize();

	await done;
	return {bytes: archive.pointer()};
}

module.exports = {zipDirectory};
