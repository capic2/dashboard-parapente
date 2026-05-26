import preview from '../../../.storybook/preview';
import { expect } from 'storybook/test';
import { AnnotatedEmagramLightbox } from './AnnotatedEmagramLightbox';

const emagramSvg = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <rect width="900" height="620" fill="#f8fafc"/>
  <g stroke="#cbd5e1" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${80 + i * 65}" y1="40" x2="${80 + i * 65}" y2="560"/>`).join('')}
    ${Array.from({ length: 9 }, (_, i) => `<line x1="70" y1="${70 + i * 55}" x2="820" y2="${70 + i * 55}"/>`).join('')}
  </g>
  <polyline points="250,540 300,470 335,390 355,315 350,250 390,190 410,115" fill="none" stroke="#dc2626" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="190,545 230,480 260,420 280,350 315,290 330,230 345,165" fill="none" stroke="#16a34a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <polyline points="310,540 350,470 385,390 405,330 430,265 455,205 485,145" fill="none" stroke="#7c3aed" stroke-width="4" stroke-dasharray="12 10" stroke-linecap="round"/>
  <g fill="#334155" font-family="Arial" font-size="18">
    <text x="80" y="35">Emagramme test</text>
    <text x="835" y="570">Vent</text>
  </g>
  <g stroke="#0284c7" stroke-width="3">
    <line x1="805" y1="150" x2="850" y2="130"/><line x1="805" y1="250" x2="850" y2="245"/><line x1="805" y1="360" x2="850" y2="380"/>
  </g>
</svg>`);

const image = {
  src: `data:image/svg+xml,${emagramSvg}`,
  alt: 'Meteociel',
  source: 'meteociel',
};

const secondImage = {
  ...image,
  alt: 'Météo-Parapente',
  source: 'meteo-parapente',
};

const annotatedResponse = JSON.stringify({
  explication_analyse: {
    locale: 'fr',
    resume:
      'La masse d air est exploitable, mais le plafond et le vent demandent de la vigilance.',
    indices: [
      'Thermiques utilisables en milieu de jour.',
      'Vent plus sensible au-dessus du plafond.',
    ],
    par_source: {
      meteociel: ['La courbe rouge reste assez inclinée en basses couches.'],
    },
    annotations_image: {
      meteociel: [
        {
          id: 'thermals',
          type: 'point',
          label: 'Thermiques',
          priority: 'important',
          category: 'thermal',
          display_order: 1,
          confidence: 0.86,
          x: 38,
          y: 58,
          visual_cue:
            'Le point est placé sur la pente régulière de la courbe rouge.',
          weather_reading: 'L air se refroidit assez vite avec l altitude.',
          flight_impact:
            'Les ascendances devraient être présentes et lisibles.',
          term: 'Gradient thermique',
          term_definition:
            'Vitesse à laquelle l air se refroidit quand on monte.',
          uncertainty_note: null,
        },
        {
          id: 'inversion',
          type: 'zone',
          label: 'Couche stable',
          priority: 'watch',
          category: 'stability',
          display_order: 2,
          confidence: 0.78,
          x: 39,
          y: 34,
          width: 12,
          height: 12,
          visual_cue:
            'La zone couvre la partie où la courbe rouge se redresse.',
          weather_reading: 'Cette forme indique une couche plus stable.',
          flight_impact: 'Les thermiques peuvent ralentir sous cette couche.',
          term: 'Inversion',
          term_definition: 'Couche qui freine ou bloque les ascendances.',
          uncertainty_note: 'Lecture assez fiable, mais la courbe est serrée.',
        },
        {
          id: 'wind',
          type: 'point',
          label: 'Vent altitude',
          priority: 'important',
          category: 'wind',
          display_order: 3,
          confidence: 0.81,
          x: 91,
          y: 40,
          visual_cue: 'Le point vise les barbules de vent sur la droite.',
          weather_reading: 'Le vent semble plus marqué avec l altitude.',
          flight_impact: 'Prévoir de la dérive et une rentrée moins directe.',
          term: null,
          term_definition: null,
          uncertainty_note: null,
        },
      ],
      'meteo-parapente': [
        {
          id: 'ceiling',
          type: 'point',
          label: 'Plafond',
          priority: 'important',
          category: 'ceiling',
          display_order: 1,
          confidence: 0.83,
          x: 48,
          y: 32,
          visual_cue:
            'Le point est placé près du niveau où les courbes se rapprochent.',
          weather_reading: 'L humidité peut limiter la hauteur exploitable.',
          flight_impact: 'Le plafond pourrait rester sous cette zone.',
        },
      ],
    },
  },
});

const fallbackResponse = JSON.stringify({
  explication_analyse: {
    locale: 'fr',
    resume: 'Analyse utile mais sans point assez fiable sur l image.',
    indices: ['Le plafond semble limité.', 'Le vent doit être surveillé.'],
    par_source: {
      meteociel: ['Observation globale sans coordonnées précises.'],
    },
    annotations_image: {
      meteociel: [
        {
          id: 'low-confidence',
          type: 'point',
          label: 'Humidité',
          priority: 'watch',
          category: 'humidity',
          display_order: 1,
          confidence: 0.52,
          x: 34,
          y: 45,
          visual_cue:
            'Les courbes semblent proches, mais la lecture est peu sûre.',
          weather_reading: 'L air pourrait être humide.',
          flight_impact: 'La base nuageuse peut être plus basse.',
        },
      ],
    },
  },
});

const meta = preview.meta({
  title: 'Components/Complex/AnnotatedEmagramLightbox',
  component: AnnotatedEmagramLightbox,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
});

export const Default = meta.story({
  args: {
    isOpen: true,
    onClose: () => undefined,
    images: [image],
    aiRawResponse: annotatedResponse,
  },
});

Default.test(
  'opens marker details and toggles annotations',
  async ({ canvas, userEvent }) => {
    await expect(
      await canvas.findByRole('button', { name: 'Thermiques' })
    ).toBeInTheDocument();
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Thermiques' })
    );
    await expect(await canvas.findByText('Repère visuel')).toBeInTheDocument();
    await expect(await canvas.findByText('Lecture météo')).toBeInTheDocument();
    await expect(await canvas.findByText('Impact vol')).toBeInTheDocument();
    await expect(
      await canvas.findByText('Confiance : 86 %')
    ).toBeInTheDocument();
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Masquer les explications' })
    );
    await expect(
      canvas.queryByRole('button', { name: 'Thermiques' })
    ).toBeNull();
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Afficher les explications' })
    );
    await expect(
      await canvas.findByRole('button', { name: 'Thermiques' })
    ).toBeInTheDocument();
  }
);

export const Fallback = meta.story({
  args: {
    isOpen: true,
    onClose: () => undefined,
    images: [image],
    aiRawResponse: fallbackResponse,
  },
});

Fallback.test(
  'opens the fallback panel when no precise marker exists',
  async ({ canvas }) => {
    await expect(
      await canvas.findByText('Résumé et autres explications')
    ).toBeInTheDocument();
    await expect(
      await canvas.findByText(
        'Analyse utile mais sans point assez fiable sur l image.'
      )
    ).toBeInTheDocument();
  }
);

export const MultipleSources = meta.story({
  args: {
    isOpen: true,
    onClose: () => undefined,
    images: [image, secondImage],
    aiRawResponse: annotatedResponse,
  },
});

MultipleSources.test(
  'resets active annotation and zoom when changing source',
  async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Thermiques' })
    );
    await expect(
      await canvas.findByText('Gradient thermique')
    ).toBeInTheDocument();
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Zoom +' })
    );
    await expect(
      await canvas.findByRole('button', { name: /Réinitialiser \(1.5x\)/u })
    ).toBeInTheDocument();
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Suivant' })
    );
    await expect(canvas.queryByText('Gradient thermique')).toBeNull();
    await expect(
      await canvas.findByRole('button', { name: /Réinitialiser \(1x\)/u })
    ).toBeInTheDocument();
  }
);

export const GroupedMarkers = meta.story({
  args: {
    isOpen: true,
    onClose: () => undefined,
    images: [image],
    aiRawResponse: JSON.stringify({
      explication_analyse: {
        annotations_image: {
          meteociel: [
            {
              ...JSON.parse(annotatedResponse).explication_analyse
                .annotations_image.meteociel[0],
              x: 42,
              y: 44,
            },
            {
              ...JSON.parse(annotatedResponse).explication_analyse
                .annotations_image.meteociel[1],
              x: 42.5,
              y: 44.2,
            },
          ],
        },
      },
    }),
  },
});

GroupedMarkers.test(
  'opens grouped marker explanations',
  async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: '2 explications' })
    );
    await expect(await canvas.findByText('Thermiques')).toBeInTheDocument();
    await expect(await canvas.findByText('Couche stable')).toBeInTheDocument();
  }
);

export const MobileDense = meta.story({
  args: {
    isOpen: true,
    onClose: () => undefined,
    images: [image],
    aiRawResponse: JSON.stringify({
      explication_analyse: {
        annotations_image: {
          meteociel: [
            {
              ...JSON.parse(annotatedResponse).explication_analyse
                .annotations_image.meteociel[0],
              x: 42,
              y: 44,
            },
            {
              ...JSON.parse(annotatedResponse).explication_analyse
                .annotations_image.meteociel[1],
              x: 42.5,
              y: 44.2,
            },
          ],
        },
      },
    }),
  },
  parameters: { layout: 'fullscreen' },
});

export const Zoom = meta.story({
  args: {
    isOpen: true,
    onClose: () => undefined,
    images: [image],
    aiRawResponse: annotatedResponse,
  },
});

Zoom.test(
  'keeps annotations interactive after zoom',
  async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Zoom +' })
    );
    await expect(
      await canvas.findByRole('button', { name: /Réinitialiser \(1.5x\)/u })
    ).toBeInTheDocument();
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Thermiques' })
    );
    await expect(
      await canvas.findByText('Confiance : 86 %')
    ).toBeInTheDocument();
    await userEvent.click(
      await canvas.findByRole('button', { name: /Réinitialiser \(1.5x\)/u })
    );
    await expect(
      await canvas.findByRole('button', { name: /Réinitialiser \(1x\)/u })
    ).toBeInTheDocument();
  }
);
