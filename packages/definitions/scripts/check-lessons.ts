// Spec 3 Testing Decisions › Build-time check; #144, #146
import { HINTS, hintProblems, LESSONS, lessonProblems } from '../src';

const problems = [...lessonProblems(LESSONS), ...hintProblems(Object.values(HINTS))];
for (const problem of problems) console.error(problem);
if (problems.length > 0) process.exit(1);
