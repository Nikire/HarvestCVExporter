/**
 * Construye filas a partir de Applications, cruzando con Candidates, Jobs y Attachments (resume).
 * @param {Array} candidates - [{ id, first_name, last_name, ... }]
 * @param {Array} attachments - [{ id, candidate_id, url, type, created_at, ... }]
 * @param {Array} applications - [{ id, candidate_id, job_id, ... }]
 * @param {Array} jobs - [{ id, name, ... }]
 * @returns {Array<{resumeUrl:string|null, fullName:string, uploadedAt:string|null, candidateId:number|string, applicationId:number|string, jobName:string}>}
 */
module.exports = function buildResumeIndex(
	candidates,
	attachments,
	applications,
	jobs
) {
	const candidatesById = new Map(candidates.map((c) => [c.id, c]));
	const jobsById = new Map(jobs.map((j) => [j.id, j]));

	const latestResumeByCandidate = new Map();
	for (const a of attachments) {
		if (a?.type !== 'resume' || !a?.url || !a?.candidate_id || !a?.created_at)
			continue;
		const prev = latestResumeByCandidate.get(a.candidate_id);
		if (!prev || new Date(a.created_at) > new Date(prev.created_at)) {
			latestResumeByCandidate.set(a.candidate_id, a);
		}
	}

	// Generamos una fila por Application
	const rows = [];
	for (const app of applications) {
		const cand = candidatesById.get(app.candidate_id);
		const job = jobsById.get(app.job_id);
		const resume = latestResumeByCandidate.get(app.candidate_id);

		if (!resume) continue;

		const fullName =
			[cand?.first_name?.trim(), cand?.last_name?.trim()]
				.filter(Boolean)
				.join(' ') || `Candidate ${app.candidate_id}`;

		rows.push({
			resumeUrl: resume?.url ?? null,
			fullName,
			uploadedAt: resume?.created_at ?? null,
			candidateId: app.candidate_id,
			applicationId: app.id,
			jobName: job?.name ?? `Job ${app.job_id}`,
			applicationAppliedAt: app.applied_at ?? null,
		});
	}

	rows.sort((a, b) => {
		const A = a.applicationAppliedAt || a.uploadedAt;
		const B = b.applicationAppliedAt || b.uploadedAt;
		if (!A && !B) return 0;
		if (!A) return 1;
		if (!B) return -1;
		return new Date(B) - new Date(A);
	});
	console.log('• Filas generadas para currículums:', rows.length);

	return rows;
};
