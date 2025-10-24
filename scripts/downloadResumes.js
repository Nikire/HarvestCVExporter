const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

const OUTPUT_DIR = path.resolve(__dirname, '../output');
const CSV_PATH = path.resolve(OUTPUT_DIR, 'resumes.csv');

function pad2(n) {
	return String(n).padStart(2, '0');
}

function sanitize(name) {
	return (
		String(name ?? '')
			.replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 120) || 'unnamed'
	);
}

function ensureCsvHeader() {
	const dir = path.dirname(CSV_PATH);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});

	const HEADER =
		'candidate_id,full_name,job_name,uploaded_at,url,local_path,file_size,sha256\n';
	if (!fs.existsSync(CSV_PATH)) {
		fs.writeFileSync(CSV_PATH, HEADER, 'utf8');
	}
}

function guessExtFromContentType(ct) {
	if (!ct) return null;
	const mime = ct.split(';')[0].trim().toLowerCase();
	switch (mime) {
		case 'application/pdf':
			return 'pdf';
		case 'application/msword':
			return 'doc';
		case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
			return 'docx';
		case 'application/rtf':
			return 'rtf';
		case 'text/plain':
			return 'txt';
		default:
			return null;
	}
}

function guessExtFromUrl(url) {
	try {
		const u = new URL(url);
		const base = path.basename(u.pathname);
		const ext = path.extname(base).replace('.', '');
		return ext || null;
	} catch (_) {
		return null;
	}
}

async function sha256File(filePath) {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('sha256');
		const rs = fs.createReadStream(filePath);
		rs.on('error', reject);
		rs.on('data', (chunk) => hash.update(chunk));
		rs.on('end', () => resolve(hash.digest('hex')));
	});
}

async function downloadTo(fileUrl, destPath) {
	const res = await axios.get(fileUrl, {responseType: 'stream'});
	await fsp.mkdir(path.dirname(destPath), {recursive: true});
	const ws = fs.createWriteStream(destPath);
	await new Promise((resolve, reject) => {
		res.data.pipe(ws);
		res.data.on('error', reject);
		ws.on('finish', resolve);
		ws.on('error', reject);
	});
	const stat = await fsp.stat(destPath);
	const hash = await sha256File(destPath);
	return {
		size: stat.size,
		sha256: hash,
		contentType: res.headers['content-type'],
	};
}

function csvEscape(value) {
	const s = String(value ?? '');
	if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
	return s;
}

async function appendCsvRow(row) {
	const line =
		[
			row.candidateId,
			row.fullName,
			row.jobName,
			row.uploadedAt,
			row.url,
			row.localPath,
			row.fileSize,
			row.sha256,
		]
			.map(csvEscape)
			.join(',') + '\n';
	await fsp.appendFile(CSV_PATH, line, 'utf8');
}

async function withRetries(fn, {retries = 3, baseMs = 500} = {}) {
	let lastErr;
	for (let i = 0; i <= retries; i++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			const status = err?.response?.status;
			const ms =
				status === 429 || (status >= 500 && status <= 599)
					? baseMs * Math.pow(2, i)
					: baseMs;
			if (i < retries) await new Promise((r) => setTimeout(r, ms));
		}
	}
	throw lastErr;
}

/**
 * Descarga CVs organizados en output/YYYY/MM/<job-name>/archivo,
 * con concurrencia configurable.
 * rows: [{ resumeUrl, fullName, uploadedAt, candidateId, jobName }]
 */
async function downloadResumes(rows, concurrency = 20) {
	ensureCsvHeader();

	const total = rows.length;
	console.log(
		`Descargando ${total} currículums con concurrencia ${concurrency}...\n`
	);

	let completed = 0;
	const queue = [...rows];

	async function worker(workerId) {
		while (queue.length > 0) {
			const r = queue.shift();
			const index = ++completed;

			try {
				// Fecha → año/mes (fallback si uploadedAt inválido)
				const d = r.uploadedAt ? new Date(r.uploadedAt) : new Date();
				const year = isNaN(d.getTime()) ? '0000' : d.getUTCFullYear();
				const month = isNaN(d.getTime()) ? '00' : pad2(d.getUTCMonth() + 1);

				// Carpeta por job
				const jobDirName = sanitize((r.jobName || 'unknown_job').toLowerCase());

				let ext = guessExtFromUrl(r.resumeUrl);
				if (!ext) {
					try {
						const head = await withRetries(() => axios.head(r.resumeUrl), {
							retries: 2,
							baseMs: 400,
						});
						ext =
							guessExtFromContentType(head.headers['content-type']) || 'pdf';
					} catch {
						ext = 'pdf';
					}
				}

				const safeName = sanitize(
					(r.fullName || 'unnamed').replace(/\s+/g, '_').toLowerCase()
				);
				const fileName = `${safeName}.${ext}`;

				const destPath = path.join(
					OUTPUT_DIR,
					String(year),
					String(month),
					jobDirName,
					fileName
				);

				const {size, sha256} = await withRetries(
					() => downloadTo(r.resumeUrl, destPath),
					{retries: 2, baseMs: 800}
				);

				await appendCsvRow({
					candidateId: r.candidateId,
					fullName: r.fullName,
					jobName: r.jobName,
					uploadedAt: r.uploadedAt,
					url: r.resumeUrl,
					localPath: path
						.relative(OUTPUT_DIR, destPath)
						.replaceAll(path.sep, '/'),
					fileSize: size,
					sha256,
				});

				console.log(
					`(${index}/${total}) ✅ [W${workerId}] ${destPath} (${size} bytes)`
				);
			} catch (e) {
				console.error(
					`(${index}/${total}) ❌ [W${workerId}] candidate=${r?.candidateId}:`,
					e?.message || e
				);
			}
		}
	}

	const workers = Array.from({length: concurrency}, (_, i) => worker(i + 1));
	await Promise.all(workers);

	console.log(`\nDescarga completada. ${completed} archivos procesados.`);
}

module.exports = {downloadResumes, OUTPUT_DIR, CSV_PATH};
