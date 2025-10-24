require('dotenv').config();
const axios = require('axios');
const path = require('path');

const generateAccessToken = require('./utils/generateAccessToken');
const getAllCandidates = require('./utils/getAllCandidates');
const getAllAttachments = require('./utils/getAllAttachments');
const getAllJobs = require('./utils/getAllJobs');
const getAllApplications = require('./utils/getAllApplications');
const buildResumeIndex = require('./utils/buildResumeIndex');

const HARVEST_API_KEY = process.env.HARVEST_API_KEY;

/* const {
	downloadResumes,
	OUTPUT_DIR,
	CSV_PATH,
} = require('./scripts/downloadResumes'); */
const {zipDirectory} = require('./scripts/zipOutput');
const {
	downloadResumesFlat,
	OUTPUT_DIR,
	CSV_PATH,
} = require('./scripts/downloadResumesFlat');

if (!HARVEST_API_KEY) {
	console.error('Falta HARVEST_API_KEY en .env');
	process.exit(1);
}

async function main() {
	const accessToken = await generateAccessToken(axios, HARVEST_API_KEY);
	const candidates = await getAllCandidates(axios, accessToken);
	const attachments = await getAllAttachments(axios, accessToken);
	const jobs = await getAllJobs(axios, accessToken, {status: 'open'}, [
		'id',
		'name',
	]);
	const applications = await getAllApplications(axios, accessToken, [
		'id',
		'candidate_id',
		'job_id',
		'applied_at',
	]);

	const resumeRows = buildResumeIndex(
		candidates,
		attachments,
		applications,
		jobs
	);

	// await downloadResumes(resumeRows);
	await downloadResumesFlat(resumeRows, 50);

	console.log(`• CSV generado en:: ${CSV_PATH}`);
	console.log(`• Archivos en: ${OUTPUT_DIR}`);

	const zipPath = path.resolve(OUTPUT_DIR, '../resumes_export.zip');
	const {bytes} = await zipDirectory(OUTPUT_DIR, zipPath);
	console.log(`• ZIP: ${zipPath} (${bytes} bytes)`);
}

main().catch((err) => {
	console.error('Error en main: ', err);
	process.exit(1);
});
