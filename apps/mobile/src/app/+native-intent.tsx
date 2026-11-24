// docs/decisions/lessons-entry-points.md (old links)
import { withCurrentLessonPaths } from '@/lessons/routes';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return withCurrentLessonPaths(path);
  } catch {
    return path;
  }
}
