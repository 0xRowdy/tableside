// docs/decisions/press-feedback.md; design/Tableside.pen TlHUq, RsrEO
import { palette } from './tokens';

export const pressStyle = {
  brass: { backgroundColor: palette.primaryPressed, borderColor: palette.primaryPressed },
  feltShadow: { backgroundColor: palette.muted },
  edgeless: { backgroundColor: palette.muted, borderColor: palette.controlBorder },
  row: { backgroundColor: palette.secondary },
  paper: { backgroundColor: palette.coachPressed },
  ink: { backgroundColor: palette.inkPressed, borderColor: palette.inkPressed },
} as const;
