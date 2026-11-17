// Spec 3 Testing Decisions › Build-time check; #144
import { LESSONS, lessonProblems } from '../src';

const problems = lessonProblems(LESSONS);
for (const problem of problems) console.error(problem);
if (problems.length > 0) process.exit(1);
