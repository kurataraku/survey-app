import { describe, expect, it } from 'vitest';
import { payloadHash, stableJson } from '../../lib/seo-loop/hash';

describe('stableJson', () => {
  it('オブジェクトのキー順に依存しない', () => {
    const left = { z: 1, nested: { b: 2, a: 1 }, a: 0 };
    const right = { a: 0, nested: { a: 1, b: 2 }, z: 1 };

    expect(stableJson(left)).toBe(stableJson(right));
    expect(payloadHash(left)).toBe(payloadHash(right));
  });

  it('配列の順序は維持する', () => {
    expect(payloadHash({ values: [1, 2] })).not.toBe(payloadHash({ values: [2, 1] }));
  });

  it('入力を破壊しない', () => {
    const input = {
      z: [{ y: 2, x: 1 }],
      a: { d: 4, c: 3 },
    };
    const before = JSON.stringify(input);

    stableJson(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(Object.keys(input)).toEqual(['z', 'a']);
    expect(Object.keys(input.z[0]!)).toEqual(['y', 'x']);
  });

  it('nullとプリミティブを決定論的に直列化する', () => {
    expect(stableJson({ nil: null, bool: false, number: 0, text: '' })).toBe(
      '{"bool":false,"nil":null,"number":0,"text":""}'
    );
  });
});
