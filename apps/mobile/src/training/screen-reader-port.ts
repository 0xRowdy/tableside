// Spec 3 Attempt lifecycle › Automatic pacing; #136
export interface ScreenReaderSpeech {
  announce(message: string): void;
  speaking(): boolean;
}

export const NO_SCREEN_READER: ScreenReaderSpeech = { announce: () => undefined, speaking: () => false };
