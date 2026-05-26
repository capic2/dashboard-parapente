import { describe, expect, it } from 'vitest';
import {
  formatConfidence,
  groupEmagramAnnotations,
  parseEmagramAnnotationModel,
  type EmagramImageAnnotation,
} from './emagramAnnotations';

const validAnnotation = {
  id: 'thermal-profile',
  type: 'point',
  label: 'Thermiques',
  priority: 'important',
  category: 'thermal',
  display_order: 1,
  confidence: 0.84,
  x: 42,
  y: 58,
  visual_cue: 'Le point est sur la courbe qui monte regulierement.',
  weather_reading: 'La masse d air permet des ascendances.',
  flight_impact: 'Les thermiques devraient etre exploitables.',
};

function rawResponse(annotations: unknown[]) {
  return JSON.stringify({
    explication_analyse: {
      locale: 'fr',
      resume: 'Conditions correctes.',
      indices: ['Plafond utile.'],
      par_source: {
        meteociel: ['Observation ancienne utile.'],
      },
      annotations_image: {
        meteociel: annotations,
      },
    },
  });
}

describe('parseEmagramAnnotationModel', () => {
  it('keeps valid high-confidence annotations as precise markers', () => {
    const model = parseEmagramAnnotationModel(
      rawResponse([validAnnotation]),
      'meteociel'
    );

    expect(model.preciseAnnotations).toHaveLength(1);
    expect(model.preciseAnnotations[0]).toMatchObject({
      id: 'thermal-profile',
      confidence: 0.84,
      priority: 'important',
    });
    expect(model.panelExplanations).toHaveLength(1);
  });

  it('moves low-confidence annotations to the panel', () => {
    const model = parseEmagramAnnotationModel(
      rawResponse([{ ...validAnnotation, confidence: 0.54 }]),
      'meteociel'
    );

    expect(model.preciseAnnotations).toHaveLength(0);
    expect(model.panelExplanations[0]).toMatchObject({
      reason: 'low_confidence',
      confidence: 0.54,
    });
  });

  it('rejects large zones as non-localized explanations', () => {
    const model = parseEmagramAnnotationModel(
      rawResponse([
        {
          ...validAnnotation,
          id: 'large-zone',
          type: 'zone',
          width: 60,
          height: 20,
        },
      ]),
      'meteociel'
    );

    expect(model.preciseAnnotations).toHaveLength(0);
    expect(model.panelExplanations[0]?.reason).toBe('invalid_zone');
  });

  it('limits precise markers to the six most important annotations', () => {
    const annotations = Array.from({ length: 8 }, (_, index) => ({
      ...validAnnotation,
      id: `annotation-${index}`,
      display_order: index,
      x: 10 + index,
    }));

    const model = parseEmagramAnnotationModel(
      rawResponse(annotations),
      'meteociel'
    );

    expect(model.preciseAnnotations).toHaveLength(6);
    expect(
      model.panelExplanations.some((item) => item.reason === 'overflow')
    ).toBe(true);
  });
});

describe('groupEmagramAnnotations', () => {
  const base: EmagramImageAnnotation = {
    id: 'a',
    source: 'meteociel',
    type: 'point',
    label: 'A',
    priority: 'important',
    category: 'thermal',
    displayOrder: 1,
    confidence: 0.8,
    x: 10,
    y: 10,
    visualCue: 'cue',
    weatherReading: 'reading',
    flightImpact: 'impact',
  };

  it('groups nearby annotations using screen distance', () => {
    const groups = groupEmagramAnnotations(
      [base, { ...base, id: 'b', x: 12, y: 10 }],
      { imageWidth: 1000, imageHeight: 500, zoom: 1, thresholdPx: 44 }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].annotations).toHaveLength(2);
  });

  it('can separate annotations after zoom changes displayed distance', () => {
    const groups = groupEmagramAnnotations(
      [base, { ...base, id: 'b', x: 12, y: 10 }],
      { imageWidth: 1000, imageHeight: 500, zoom: 2, thresholdPx: 32 }
    );

    expect(groups).toHaveLength(2);
  });
});

describe('formatConfidence', () => {
  it('rounds confidence to an integer percentage', () => {
    expect(formatConfidence(0.734)).toBe('73 %');
  });
});
