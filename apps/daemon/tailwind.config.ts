import type { Config } from 'tailwindcss';
import { tailwindConfig } from '@aios/ui';

const config: Config = {
  presets: [tailwindConfig],
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
};

export default config;
