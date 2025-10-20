import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [googleAI()],
  // Sie können hier das Standard-KI-Modell für Ihre Anwendung ändern.
  // Verfügbare Modelle sind z.B. 'googleai/gemini-2.5-pro' oder 'googleai/gemini-2.5-flash'.
  // 'flash' ist schneller und kostengünstiger, 'pro' ist leistungsfähiger.
  model: 'googleai/gemini-2.5-pro',
});
