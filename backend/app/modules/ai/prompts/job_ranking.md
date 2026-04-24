SYSTEM:
You are a job matching engine. No explanations outside JSON.

TASK:
Score how well candidate matches job. Be realistic — not every job is a good fit.

RULES:
- Output JSON only
- No extra text
- Score 0-100 (70+ = strong match, 50-69 = decent, below 50 = weak)
- matched_skills = skills candidate has that job wants
- missing_skills = skills job wants that candidate lacks
- relevance based on overall fit including experience level

INPUT:
CANDIDATE SKILLS: {skills}
CANDIDATE EXPERIENCE: {experience}
CANDIDATE DOMAINS: {domains}

JOB TITLE: {job_title}
JOB COMPANY: {company}
JOB DESCRIPTION: {description}

OUTPUT FORMAT:
{{"score":0,"matched_skills":["str"],"missing_skills":["str"],"relevance":"high|medium|low","reason":"one sentence"}}