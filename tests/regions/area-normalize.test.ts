import { describe, expect, it } from 'vitest';
import {
  normalizeAreaName,
  normalizeStationLabel,
  stripRailOperatorPrefix,
  toComparableAreaNames,
} from '@/lib/regions/area-normalize';

describe('normalizeAreaName', () => {
  it('政令指定都市は行政区まで残し、親市へもまとめられる', () => {
    expect(normalizeAreaName('名古屋市中村区')).toEqual({
      city: '名古屋市中村区',
      municipality: '名古屋市',
      ward: '中村区',
    });
    expect(normalizeAreaName('横浜市西区桜木町')).toEqual({
      city: '横浜市西区',
      municipality: '横浜市',
      ward: '西区',
    });
  });

  it('町名・丁目・番地を取り除く', () => {
    expect(normalizeAreaName('名古屋市中村区椿町')?.city).toBe('名古屋市中村区');
    expect(normalizeAreaName('さいたま市大宮区高鼻町1-20-1')?.city).toBe('さいたま市大宮区');
    expect(normalizeAreaName('町田市中町2丁目8')?.city).toBe('町田市');
    expect(normalizeAreaName('藤沢市湘南台')?.city).toBe('藤沢市');
    expect(normalizeAreaName('田原市野田町')?.city).toBe('田原市');
    expect(normalizeAreaName('豊田市陣中町')?.city).toBe('豊田市');
  });

  it('先頭の都道府県名を取り除く', () => {
    expect(normalizeAreaName('愛知県刈谷市')?.city).toBe('刈谷市');
    expect(normalizeAreaName('東京都千代田区神田三崎町')?.city).toBe('千代田区');
  });

  it('特別区の末尾の町名を自治体名と誤認しない', () => {
    expect(normalizeAreaName('千代田区神田三崎町')?.city).toBe('千代田区');
    expect(normalizeAreaName('渋谷区代々木')?.city).toBe('渋谷区');
    expect(normalizeAreaName('豊島区南池袋')?.city).toBe('豊島区');
  });

  it('郡＋町村と郡のみを区別する', () => {
    expect(normalizeAreaName('北足立郡伊奈町')?.city).toBe('北足立郡伊奈町');
    expect(normalizeAreaName('知多郡武豊町')?.city).toBe('知多郡武豊町');
    expect(normalizeAreaName('足柄下郡')?.city).toBe('足柄下郡');
    expect(normalizeAreaName('中郡')?.city).toBe('中郡');
  });

  it('市名が「市」「町」で始まっても崩れない', () => {
    expect(normalizeAreaName('市川市')?.city).toBe('市川市');
    expect(normalizeAreaName('町田市')?.city).toBe('町田市');
    expect(normalizeAreaName('廿日市市')?.city).toBe('廿日市市');
    expect(normalizeAreaName('四日市市')?.city).toBe('四日市市');
    expect(normalizeAreaName('大町市')?.city).toBe('大町市');
    expect(normalizeAreaName('村山市')?.city).toBe('村山市');
  });

  it('空文字は null を返す', () => {
    expect(normalizeAreaName('')).toBeNull();
    expect(normalizeAreaName(null)).toBeNull();
    expect(normalizeAreaName('   ')).toBeNull();
  });
});

describe('toComparableAreaNames', () => {
  it('行政区と親市の両方で照合できる', () => {
    expect(toComparableAreaNames('横浜市西区桜木町')).toEqual(['横浜市西区', '横浜市']);
  });

  it('政令市以外は1件だけ返す', () => {
    expect(toComparableAreaNames('藤沢市湘南台')).toEqual(['藤沢市']);
  });
});

describe('normalizeStationLabel', () => {
  it('路線名と駅名を分解する', () => {
    expect(normalizeStationLabel('JR総武線 飯田橋駅')).toEqual({
      station: '飯田橋駅',
      lines: ['JR総武線'],
    });
  });

  it('路線名がなければ駅名だけを返す', () => {
    expect(normalizeStationLabel('岡山駅')).toEqual({ station: '岡山駅', lines: [] });
  });

  it('区切りのない路線名も駅名から切り離す', () => {
    expect(normalizeStationLabel('西武新宿線所沢駅')).toEqual({
      station: '所沢駅',
      lines: ['西武新宿線'],
    });
    expect(normalizeStationLabel('東急田園都市線溝の口駅')).toEqual({
      station: '溝の口駅',
      lines: ['東急田園都市線'],
    });
  });

  it('路線名のない事業者名付き登録値はそのまま返す', () => {
    expect(normalizeStationLabel('JR名古屋駅')).toEqual({ station: 'JR名古屋駅', lines: [] });
  });

  it('空文字は null を返す', () => {
    expect(normalizeStationLabel('  ')).toBeNull();
  });
});

describe('stripRailOperatorPrefix', () => {
  it('事業者名を外した駅名を返す', () => {
    expect(stripRailOperatorPrefix('JR名古屋駅')).toBe('名古屋駅');
    expect(stripRailOperatorPrefix('地下鉄栄駅')).toBe('栄駅');
    expect(stripRailOperatorPrefix('名鉄東岡崎駅')).toBe('東岡崎駅');
  });

  it('事業者名がなければ null を返す', () => {
    expect(stripRailOperatorPrefix('立川駅')).toBeNull();
    expect(stripRailOperatorPrefix('溝の口駅')).toBeNull();
  });

  it('事業者名だけの値は駅名を空にしない', () => {
    expect(stripRailOperatorPrefix('JR駅')).toBeNull();
  });
});
